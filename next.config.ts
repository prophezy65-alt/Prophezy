import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  // pdf-parse (used by lib/document/providers/pdf.provider.ts) depends on
  // @napi-rs/canvas, a native .node binary addon, plus pdfjs-dist. Webpack
  // can't bundle native binaries — trying to produces exactly the cryptic
  // "Object.defineProperty called on non-object" error seen when uploading
  // a PDF for quiz generation. This tells Next.js to require() them
  // directly at runtime instead of bundling them through webpack.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "pdfjs-dist", "canvas"],
  // serverExternalPackages above only stops webpack from BUNDLING these —
  // it doesn't guarantee Vercel's separate file-tracing step (which
  // decides what actually ships inside each deployed serverless function)
  // picks up @napi-rs/canvas's and canvas's compiled native .node binaries,
  // since they're require()'d dynamically (canvas from
  // lib/assignment/services/pdf-render.util.ts, @napi-rs/canvas deep
  // inside pdfjs-dist's legacy Node build) rather than via a static import
  // the tracer can follow. Without this, the function deploys successfully
  // but the native binary is missing at runtime — surfacing as
  // "Cannot find module '@napi-rs/canvas'" followed by "ReferenceError:
  // DOMMatrix is not defined" the moment a PDF is uploaded, even though it
  // builds and works fine locally. Explicitly including the whole package
  // directory for every API route sidesteps that gap.
  //
  // pdf.worker.mjs is included for the same reason as the canvas native
  // binaries above: pdfjs-dist's Node ("legacy") build loads its worker
  // script via `await import(this.workerSrc)` at RUNTIME rather than a
  // static top-level import, so the build-time file tracer can't see the
  // reference and silently drops the file from the deployed bundle —
  // producing "Cannot find module '.../pdfjs-dist/legacy/build/pdf.worker.mjs'"
  // the first time a PDF is processed in production, even though it works
  // locally. Both glob entries below are needed: npm sometimes dedupes
  // pdfjs-dist to the top-level node_modules/pdfjs-dist, and sometimes
  // (when pdf-parse's required version can't be deduped) installs a
  // private copy at node_modules/pdf-parse/node_modules/pdfjs-dist instead
  // — which is the exact path this error was thrown from. Including both
  // covers it regardless of how npm happened to resolve it on a given
  // install/lockfile.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/canvas/**/*",
      "./node_modules/pdfjs-dist/**/*.mjs",
      "./node_modules/pdf-parse/node_modules/pdfjs-dist/**/*.mjs",
    ],
  },
};

export default nextConfig;
