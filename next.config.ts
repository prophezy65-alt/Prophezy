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
};

export default nextConfig;
