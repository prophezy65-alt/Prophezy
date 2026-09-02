/**
 * components/exam-predictor/palette.ts
 *
 * Scoped to the Exam Question Predictor feature only. Does not touch
 * globals.css, tailwind.config, or any shared design token — the rest of
 * Prophezy keeps its existing --signal/--pulse/--success theme untouched.
 *
 * Palette: near-black canvas with off-white panels, high-contrast minimal
 * type — same naming as before so every component that imports this file
 * re-themes automatically with zero other edits.
 */
export const EXAM_PREDICTOR_COLORS = {
  // Page background + big content panels (Upload, Results sections, Chat).
  canvas: "#0A0A0A",
  onCanvas: "#F3F1EC",
  onCanvasMuted: "#F3F1ECB3",

  // Elevated blocks — orb, high-emphasis cards, strategy CTA. A step lighter
  // than canvas so they read as distinct panels, the way EOVOLT's photo
  // block sits a shade lighter than its pure-black nav/background.
  wineRed: "#1E1E22",
  wineRedDark: "#000000", // hover/pressed states
  wineRedSoft: "#1E1E2226",
  wineRedFaint: "#1E1E2214",

  // True white — reserved for contrast pills, outlined buttons, and text on
  // the elevated (wineRed) blocks.
  lightSand: "#F3F1EC",
  lightSandSoft: "#F3F1EC1A",

  onWineRed: "#F3F1EC", // white text on charcoal blocks
  onSand: "#1E1E22", // dark text on white pills/buttons
  onSandMuted: "#1E1E22B3",
} as const;
