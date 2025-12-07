'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes/dist/types';

/**
 * Theme provider wrapper for next-themes
 * Enables system-aware dark/light mode with persistence
 * 
 * Configuration applied in root layout:
 * - attribute="class": Uses class-based theme switching (Tailwind compatible)
 * - defaultTheme="light": Initial theme before user preference loads
 * - enableSystem: Respects user's OS-level theme preference
 * - disableTransitionOnChange: Prevents flash during theme switches
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
