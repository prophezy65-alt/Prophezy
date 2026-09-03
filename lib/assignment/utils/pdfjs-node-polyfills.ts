// lib/assignment/utils/pdfjs-node-polyfills.ts
//
// pdfjs-dist's Node ("legacy") build assumes a couple of browser globals
// exist — most importantly `DOMMatrix` — and tries to self-polyfill them by
// internally `require("@napi-rs/canvas")`. On Vercel that internal require
// has been failing (native binding not found — a known npm optional-deps +
// platform-lockfile issue), which leaves `globalThis.DOMMatrix` undefined
// and crashes the first time pdfjs actually uses it:
//   ReferenceError: DOMMatrix is not defined
//
// Rather than depend on either `@napi-rs/canvas` or the `canvas` package's
// native DOMMatrix export being reliably available in Vercel's build (both
// have been flaky here), this is a small dependency-free polyfill covering
// only the 2D affine-matrix operations pdfjs's Node rendering path actually
// calls: the 6-value constructor, translate/scale, and both the mutating
// (*Self) and static multiply/invert forms.
//
// Import this module FIRST — before pdfjs-dist or anything that transitively
// imports it (pdf-parse, pdf-render.util.ts) — so `globalThis.DOMMatrix`
// exists before pdfjs's own top-level self-polyfill check runs.

class DOMMatrixPolyfill {
  a: number; b: number; c: number; d: number; e: number; f: number;

  constructor(init?: number[] | DOMMatrixPolyfill) {
    if (Array.isArray(init) && init.length === 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    } else if (init instanceof DOMMatrixPolyfill) {
      ({ a: this.a, b: this.b, c: this.c, d: this.d, e: this.e, f: this.f } = init);
    } else {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  }

  static multiply(m1: DOMMatrixPolyfill, m2: DOMMatrixPolyfill): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill([
      m1.a * m2.a + m1.c * m2.b,
      m1.b * m2.a + m1.d * m2.b,
      m1.a * m2.c + m1.c * m2.d,
      m1.b * m2.c + m1.d * m2.d,
      m1.a * m2.e + m1.c * m2.f + m1.e,
      m1.b * m2.e + m1.d * m2.f + m1.f,
    ]);
  }

  multiplySelf(other: DOMMatrixPolyfill): this {
    Object.assign(this, DOMMatrixPolyfill.multiply(this, other));
    return this;
  }

  preMultiplySelf(other: DOMMatrixPolyfill): this {
    Object.assign(this, DOMMatrixPolyfill.multiply(other, this));
    return this;
  }

  translate(tx: number, ty: number): DOMMatrixPolyfill {
    return DOMMatrixPolyfill.multiply(this, new DOMMatrixPolyfill([1, 0, 0, 1, tx, ty]));
  }

  scale(sx: number, sy: number = sx): DOMMatrixPolyfill {
    return DOMMatrixPolyfill.multiply(this, new DOMMatrixPolyfill([sx, 0, 0, sy, 0, 0]));
  }

  invertSelf(): this {
    const det = this.a * this.d - this.b * this.c;
    if (det === 0) {
      this.a = this.b = this.c = this.d = NaN;
      this.e = this.f = NaN;
      return this;
    }
    const { a, b, c, d, e, f } = this;
    this.a = d / det;
    this.b = -b / det;
    this.c = -c / det;
    this.d = a / det;
    this.e = (c * f - d * e) / det;
    this.f = (b * e - a * f) / det;
    return this;
  }
}

let applied = false;

function apply(): void {
  if (applied) return;
  applied = true;

  if (typeof globalThis.DOMMatrix === "undefined") {
    (globalThis as unknown as { DOMMatrix: unknown }).DOMMatrix = DOMMatrixPolyfill;
    // Temporary diagnostic: if this line is missing from the deployed
    // function logs but the DOMMatrix crash still happens, that proves
    // something is loading pdfjs-dist before this module runs — remove
    // once the crash is confirmed gone in production.
    console.log("[pdfjs-node-polyfills] DOMMatrix polyfill applied");
  } else {
    console.log("[pdfjs-node-polyfills] DOMMatrix already defined, skipping polyfill");
  }
}

// Applied as a module-load side effect (not behind an exported function the
// caller has to remember to invoke) so that as long as this is the FIRST
// import in a file that also imports pdfjs-dist (directly, or transitively
// via pdf-parse), ES module evaluation order guarantees this runs before
// pdfjs-dist's own top-level code does.
apply();
