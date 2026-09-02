import type { ColorTheme } from "./models/settings.model";

export interface ThemeDefinition {
  id: ColorTheme;
  label: string;
  description: string;
  /** HSL triplets, no hsl() wrapper — matches the format already used in app/globals.css */
  vars: {
    void: string;
    surface: string;
    surfaceRaised: string;
    signal: string;
    pulse: string;
  };
}

export const THEMES: Record<ColorTheme, ThemeDefinition> = {
  midnight: {
    id: "midnight",
    label: "Midnight",
    description: "The default Prophezy look — indigo signal on deep navy.",
    vars: { void: "234 45% 7%", surface: "235 38% 12%", surfaceRaised: "235 34% 16%", signal: "249 82% 68%", pulse: "38 88% 62%" },
  },
  amoled: {
    id: "amoled",
    label: "AMOLED",
    description: "True black for OLED screens and maximum contrast.",
    vars: { void: "0 0% 0%", surface: "0 0% 5%", surfaceRaised: "0 0% 9%", signal: "249 82% 68%", pulse: "38 88% 62%" },
  },
  carbon: {
    id: "carbon",
    label: "Carbon",
    description: "Neutral graphite with a cool steel accent.",
    vars: { void: "220 13% 9%", surface: "220 13% 14%", surfaceRaised: "220 12% 18%", signal: "199 89% 62%", pulse: "38 88% 62%" },
  },
  glass: {
    id: "glass",
    label: "Glass",
    description: "Lighter, translucent surfaces for a frosted look.",
    vars: { void: "235 30% 11%", surface: "235 28% 18%", surfaceRaised: "235 26% 24%", signal: "249 82% 72%", pulse: "38 88% 66%" },
  },
  ocean: {
    id: "ocean",
    label: "Ocean",
    description: "Deep teal surfaces with a bright aqua signal.",
    vars: { void: "205 45% 8%", surface: "205 38% 13%", surfaceRaised: "205 34% 17%", signal: "189 85% 58%", pulse: "38 88% 62%" },
  },
  purple: {
    id: "purple",
    label: "Purple",
    description: "Rich violet surfaces, magenta-leaning accent.",
    vars: { void: "265 40% 8%", surface: "265 34% 13%", surfaceRaised: "265 30% 17%", signal: "271 82% 68%", pulse: "320 75% 62%" },
  },
  neon: {
    id: "neon",
    label: "Neon",
    description: "High-saturation cyberpunk accent on near-black.",
    vars: { void: "230 30% 6%", surface: "230 26% 11%", surfaceRaised: "230 24% 15%", signal: "158 90% 55%", pulse: "320 90% 60%" },
  },
  solar: {
    id: "solar",
    label: "Solar",
    description: "Warm amber signal against dark umber surfaces.",
    vars: { void: "25 30% 8%", surface: "25 26% 13%", surfaceRaised: "25 22% 17%", signal: "38 92% 58%", pulse: "12 82% 58%" },
  },
};

export const THEME_LIST: ThemeDefinition[] = Object.values(THEMES);
