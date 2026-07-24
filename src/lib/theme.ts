export const THEMES = ["violet", "ocean", "sunset"] as const;
export type ThemeName = (typeof THEMES)[number];
export type ThemeMode = "light" | "dark";

export const THEME_LABELS: Record<ThemeName, string> = {
  violet: "Violet",
  ocean: "Ocean",
  sunset: "Sunset",
};

export const THEME_SWATCH: Record<ThemeName, string> = {
  violet: "#8657ea",
  ocean: "#129cae",
  sunset: "#ea511a",
};

export const FONT_SIZES = ["small", "medium", "large"] as const;
export type FontSizeName = (typeof FONT_SIZES)[number];

export const FONT_SIZE_LABELS: Record<FontSizeName, string> = {
  small: "Nhỏ",
  medium: "Vừa",
  large: "Lớn",
};

export const FONT_SIZE_PX: Record<FontSizeName, number> = {
  small: 14,
  medium: 16,
  large: 19,
};

export const THEME_STORAGE_KEY = "samespell:theme";
export const MODE_STORAGE_KEY = "samespell:mode";
export const FONT_SIZE_STORAGE_KEY = "samespell:fontsize";

export const NO_FLASH_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("${THEME_STORAGE_KEY}") || "violet";
    var mode = localStorage.getItem("${MODE_STORAGE_KEY}");
    if (!mode) {
      mode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    var fontSizePx = { small: 14, medium: 16, large: 19 }[localStorage.getItem("${FONT_SIZE_STORAGE_KEY}")] || 16;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-mode", mode);
    document.documentElement.style.fontSize = fontSizePx + "px";
  } catch (e) {}
})();
`;
