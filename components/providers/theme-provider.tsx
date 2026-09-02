"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

/**
 * forcedTheme="dark" — the app's CSS design tokens (--void, --surface,
 * --signal, --ink, etc.) are only ever defined inside `.dark { ... }` in
 * globals.css; there is no light-mode equivalent anywhere in the site.
 * Without this, enableSystem correctly does what next-themes is designed
 * to do — remove the `.dark` class when the OS reports a light preference
 * — which left the whole site unstyled rather than showing an actual light
 * theme, since none exists. forcedTheme locks the resolved class to "dark"
 * site-wide regardless of what setTheme() is called with, so both Settings
 * options ("System" and "Dark Mode") now consistently keep the app in its
 * one real theme instead of one of them silently breaking it.
 *
 * The user's raw choice (system vs dark) still persists correctly via
 * profiles.theme_preference / PATCH /api/settings — nothing about that
 * storage or the Settings UI changes. If a real light theme is built later,
 * remove this prop and "System" will immediately start reacting to the
 * OS preference as originally intended, with zero other changes needed.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
