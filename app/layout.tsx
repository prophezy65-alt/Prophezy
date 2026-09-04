import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { ContactModalProvider } from "@/components/providers/contact-modal-provider";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Prophezy — The AI Operating System for Students",
  description: "Predict. Learn. Build. Succeed.",
};

// Google Analytics measurement ID, read from the environment rather than
// hardcoded — set NEXT_PUBLIC_GA_MEASUREMENT_ID in Vercel (Production
// scope only is recommended, so preview/local builds don't send analytics
// hits that would pollute real traffic data). The `NEXT_PUBLIC_` prefix is
// required for a Next.js env var to be readable in the browser bundle,
// which this needs to be since gtag.js runs client-side.
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} ${mono.variable} font-body`}>
        <ThemeProvider>
          <QueryProvider>
            <ToastProvider>
              <ContactModalProvider>{children}</ContactModalProvider>
            </ToastProvider>
          </QueryProvider>
        </ThemeProvider>
        {/*
          Google Analytics 4 — added once, here, at the root layout, so
          it's present on every route in the app without being duplicated
          anywhere else. @next/third-parties' <GoogleAnalytics> is the
          Next.js-team-maintained wrapper around gtag.js built specifically
          for the App Router: unlike a raw <script> tag (which only fires
          on the very first full page load), it automatically listens for
          client-side route changes and fires a page_view on every
          navigation — this is what satisfies "page navigation is tracked
          correctly" for an App Router SPA. It loads the script with
          Next.js's `next/script` `afterInteractive` strategy internally,
          so it never blocks initial render or competes with
          hydration/critical resources for bandwidth.

          Renders nothing at all if the env var isn't set (e.g. local dev,
          or a preview deploy that intentionally has no GA env var
          configured) — no empty/broken tag, and no analytics noise from
          non-production traffic.

          No PII is sent: this only enables gtag.js's default automatic
          page_view tracking (URL, referrer, basic device/browser info).
          Nothing in this app passes user IDs, emails, or any other
          identifying/sensitive data into gtag — do not add User-ID
          tracking or custom events carrying personal data without a
          privacy-policy review.
        */}
        {GA_MEASUREMENT_ID && <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />}
      </body>
    </html>
  );
}
