"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  FONT_SIZE_PX,
  FONT_SIZE_STORAGE_KEY,
  MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type FontSizeName,
  type ThemeMode,
  type ThemeName,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: ThemeName;
  mode: ThemeMode;
  fontSize: FontSizeName;
  setTheme: (theme: ThemeName) => void;
  toggleMode: () => void;
  setFontSize: (size: FontSizeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme phải dùng bên trong ThemeProvider");
  return ctx;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("violet");
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [fontSize, setFontSizeState] = useState<FontSizeName>("medium");

  useEffect(() => {
    const html = document.documentElement;
    setThemeState((html.getAttribute("data-theme") as ThemeName) || "violet");
    setModeState((html.getAttribute("data-mode") as ThemeMode) || "light");
    const storedSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY) as FontSizeName | null;
    setFontSizeState(storedSize && storedSize in FONT_SIZE_PX ? storedSize : "medium");
  }, []);

  function setTheme(next: ThemeName) {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  function toggleMode() {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setModeState(next);
    document.documentElement.setAttribute("data-mode", next);
    localStorage.setItem(MODE_STORAGE_KEY, next);
  }

  function setFontSize(next: FontSizeName) {
    setFontSizeState(next);
    document.documentElement.style.fontSize = `${FONT_SIZE_PX[next]}px`;
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, next);
  }

  return (
    <ThemeContext.Provider value={{ theme, mode, fontSize, setTheme, toggleMode, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}
