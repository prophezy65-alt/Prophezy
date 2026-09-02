// lib/assignment/services/pdf-render.util.ts
// Renders each page of a (scanned, text-less) PDF to a PNG buffer so it can
// be fed into the OCR pipeline (Tesseract + vision fallback), which both
// operate on raster images, not PDF structure.
//
// Peer dependencies:
//   npm install pdfjs-dist canvas
//
// pdfjs-dist does the PDF parsing/rendering to a canvas surface; the `canvas`
// package provides the Node-side CanvasRenderingContext2D implementation
// (native binding, prebuilt binaries available for standard Node runtimes).

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "canvas";

export interface RasterizedPage {
  pageNumber: number;
  pngBuffer: Buffer;
  widthPx: number;
  heightPx: number;
}

const RENDER_SCALE = 2.0; // ~144 DPI equivalent for legible OCR input without excessive memory use
const MAX_PAGES_TO_RASTERIZE = 60; // guard against pathologically large uploads

export async function rasterizePdfPages(pdfBuffer: Buffer): Promise<RasterizedPage[]> {
  const loadingTask = getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdfDocument = await loadingTask.promise;

  const pageCount = Math.min(pdfDocument.numPages, MAX_PAGES_TO_RASTERIZE);
  const results: RasterizedPage[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");

    await page.render({
      // pdfjs's Node canvas typing differs slightly from DOM's; the
      // `canvas` package's context/canvas are a compatible superset for rendering.
      canvasContext: context as unknown as CanvasRenderingContext2D,
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
    }).promise;

    results.push({
      pageNumber,
      pngBuffer: canvas.toBuffer("image/png"),
      widthPx: canvas.width,
      heightPx: canvas.height,
    });
  }

  // `loadingTask.destroy()` (not `pdfDocument.destroy()`) — this version's
  // PDFDocumentProxy type doesn't declare `destroy`, but destroying the
  // loading task tears down the underlying document as well.
  await loadingTask.destroy();
  return results;
}
