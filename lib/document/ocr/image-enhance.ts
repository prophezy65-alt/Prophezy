/**
 * lib/document/ocr/image-enhance.ts
 *
 * Real preprocessing pipeline using `sharp` (already in your stack) to
 * improve OCR accuracy before handing bytes to the OCR provider. Rotation
 * detection and deskew here use Tesseract.js's own OSD (orientation/script
 * detection) output as the source of the rotation angle — sharp does the
 * actual pixel rotation, Tesseract tells us the angle. This keeps sharp's
 * job to what it's actually good at (fast, deterministic image ops) and
 * doesn't try to reimplement Hough-transform skew detection from scratch.
 */

import sharp from "sharp";
import { MAX_OCR_IMAGE_DIMENSION } from "../constants/limits";
import { OcrError } from "../errors/document-errors";

export interface EnhanceOptions {
  deskewAngleDegrees?: number; // pass the angle Tesseract OSD reports, if known
  grayscale?: boolean;
  denoise?: boolean;
  autoCrop?: boolean;
  targetDpi?: number; // upscale low-res scans toward this before OCR
}

export interface EnhanceResult {
  buffer: Buffer;
  width: number;
  height: number;
  appliedSteps: string[];
}

export async function enhanceForOcr(input: Buffer, options: EnhanceOptions = {}): Promise<EnhanceResult> {
  const appliedSteps: string[] = [];

  const meta = await sharp(input).metadata();
  if (!meta.width || !meta.height) {
    throw new OcrError("Could not read image dimensions for OCR preprocessing.");
  }

  if (meta.width > MAX_OCR_IMAGE_DIMENSION || meta.height > MAX_OCR_IMAGE_DIMENSION) {
    throw new OcrError("Image exceeds the maximum dimension allowed for OCR preprocessing.", {
      width: meta.width,
      height: meta.height,
      max: MAX_OCR_IMAGE_DIMENSION,
    });
  }

  let pipeline = sharp(input);

  const targetDpi = options.targetDpi ?? 300;
  const impliedDpi = meta.density ?? 96;
  if (impliedDpi < targetDpi) {
    const scale = targetDpi / impliedDpi;
    pipeline = pipeline.resize({
      width: Math.round(meta.width * scale),
      height: Math.round(meta.height * scale),
      kernel: sharp.kernel.lanczos3,
    });
    appliedSteps.push(`upscale_${impliedDpi}_to_${targetDpi}dpi`);
  }

  if (options.grayscale ?? true) {
    pipeline = pipeline.grayscale();
    appliedSteps.push("grayscale");
  }

  if (options.denoise ?? true) {
    pipeline = pipeline.median(1);
    appliedSteps.push("denoise_median");
  }

  pipeline = pipeline.normalize();
  appliedSteps.push("normalize_contrast");

  if (options.deskewAngleDegrees && Math.abs(options.deskewAngleDegrees) > 0.1) {
    pipeline = pipeline.rotate(-options.deskewAngleDegrees, {
      background: { r: 255, g: 255, b: 255 },
    });
    appliedSteps.push(`deskew_${options.deskewAngleDegrees.toFixed(2)}deg`);
  }

  if (!options.deskewAngleDegrees) {
    pipeline = pipeline.rotate();
    appliedSteps.push("exif_auto_rotate");
  }

  if (options.autoCrop ?? true) {
    pipeline = pipeline.trim({ background: "#ffffff", threshold: 10 });
    appliedSteps.push("auto_crop_whitespace");
  }

  const { data, info } = await pipeline.png().toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    appliedSteps,
  };
}

/**
 * Cheap heuristic rotation check (0/180) using top-vs-bottom ink density.
 * Fine-grained skew (a few degrees) should come from Tesseract OSD and be
 * passed in as `deskewAngleDegrees` to enhanceForOcr above — this is not a
 * substitute for that, just a fast "is this upside down" gross check.
 */
export async function detectGrossRotation(input: Buffer): Promise<0 | 180> {
  const { data, info } = await sharp(input)
    .grayscale()
    .resize(64, 64, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const stripHeight = Math.floor(info.height / 4);
  let topDensity = 0;
  let bottomDensity = 0;

  for (let y = 0; y < stripHeight; y++) {
    for (let x = 0; x < info.width; x++) {
      topDensity += 255 - data[y * info.width + x]!;
    }
  }
  for (let y = info.height - stripHeight; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      bottomDensity += 255 - data[y * info.width + x]!;
    }
  }

  return bottomDensity > topDensity * 1.4 ? 180 : 0;
}
