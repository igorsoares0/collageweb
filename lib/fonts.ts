// Canvas fonts are referenced by literal family name in the template JSON
// (Flutter downloads them by name), so next/font is NOT used here — it would
// hash the family names. Loaded via Google Fonts stylesheet in FontLoader.

export const EDITOR_FONTS = [
  "Inter",
  "Playfair Display",
  "Montserrat",
  "Lora",
  "Oswald",
] as const;

export const GOOGLE_FONTS_CSS_URL =
  "https://fonts.googleapis.com/css2?" +
  EDITOR_FONTS.map(
    (f) => `family=${f.replaceAll(" ", "+")}:wght@400;700`
  ).join("&") +
  "&display=swap";
