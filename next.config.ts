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
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "pdfjs-dist"],
  // serverExternalPackages above only stops webpack from BUNDLING these —
  // it doesn't guarantee Vercel's separate file-tracing step (which
  // decides what actually ships inside each deployed serverless function)
  // picks up @napi-rs/canvas's compiled native .node binary, since it's
  // require()'d dynamically deep inside pdfjs-dist's legacy Node build
  // rather than via a static import the tracer can follow. Without this,
  // the function deploys successfully but the native binary is missing at
  // runtime — surfacing as "Cannot find module '@napi-rs/canvas'" followed
  // by "ReferenceError: DOMMatrix is not defined" the moment a PDF is
  // uploaded, even though it builds and works fine locally. Explicitly
  // including the whole package directory for every API route sidesteps
  // that gap.
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/@napi-rs/canvas/**/*"],
  },
};

export default nextConfig;
