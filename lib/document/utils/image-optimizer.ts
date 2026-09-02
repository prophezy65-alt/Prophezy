/**
 * lib/document/utils/image-optimizer.ts
 * Real sharp-based optimization for extracted figures/images before they're
 * stored (separate from ocr/image-enhance.ts, which optimizes FOR OCR
 * accuracy — this optimizes for storage size/display, e.g. re-encoding to
 * webp and capping max dimensions for a thumbnail).
 */

import sharp from "sharp";

export interface OptimizeOptions {
  maxDimension?: number;
  quality?: number;
}

export async function optimizeForStorage(buffer: Buffer, options: OptimizeOptions = {}): Promise<Buffer> {
  const maxDimension = options.maxDimension ?? 1600;
  const quality = options.quality ?? 82;

  return sharp(buffer)
    .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

export async function generateThumbnail(buffer: Buffer, size = 300): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: size, height: size, fit: "cover" })
    .webp({ quality: 70 })
    .toBuffer();
}
