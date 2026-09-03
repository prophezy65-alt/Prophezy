// lib/polyfills/pdf-node-polyfill.ts
//
// pdf.js (used deep inside the syllabus ingestion pipeline for PDF parsing)
// expects a handful of browser globals to exist. In the Vercel Node.js
// serverless runtime the native canvas binding it normally relies on for
// these can fail to load ("Cannot find native binding"), which left
// DOMMatrix/ImageData/Path2D undefined and crashed requests with
// "ReferenceError: DOMMatrix is not defined".
//
// These are inert no-op shims — pdf.js only needs the classes to exist,
// not to actually render anything, since we only use it for text/data
// extraction here. No application logic is touched by this file.
//
// Import this file FIRST (before any other import) in any route that
// triggers the syllabus/paper ingestion pipeline.

if (typeof (globalThis as any).DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    constructor(_init?: unknown) {}
  };
}

if (typeof (globalThis as any).ImageData === "undefined") {
  (globalThis as any).ImageData = class ImageData {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    constructor(dataOrWidth: any, widthOrHeight?: number, height?: number) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data = dataOrWidth;
        this.width = widthOrHeight ?? 0;
        this.height = height ?? 0;
      } else {
        this.width = dataOrWidth ?? 0;
        this.height = widthOrHeight ?? 0;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
    }
  };
}

if (typeof (globalThis as any).Path2D === "undefined") {
  (globalThis as any).Path2D = class Path2D {
    constructor(_path?: unknown) {}
    addPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    rect() {}
  };
}

export {};
