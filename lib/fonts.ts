// Canvas fonts are referenced by literal family name in the template JSON
// (Flutter downloads them by name), so next/font is NOT used here — it would
// hash the family names. Loaded via Google Fonts stylesheet in FontLoader.
//
// Each family maps to the weights we load from Google Fonts. Most ship
// 400 + 700; the display/script faces below ship only 400 — and requesting a
// weight a family doesn't have makes Google Fonts 400 the WHOLE stylesheet
// request, so the per-family weight list must be accurate. Flutter's
// google_fonts package fetches the same families by name, so this list is
// mirrored in the app's text_style_bar.dart (kFontChoices).
const FONT_WEIGHTS: Record<string, readonly number[]> = {
  // Sans-serif
  Inter: [400, 700],
  Montserrat: [400, 700],
  Poppins: [400, 700],
  Roboto: [400, 700],
  Raleway: [400, 700],
  "Work Sans": [400, 700],
  Oswald: [400, 700],
  "Bebas Neue": [400],
  Anton: [400],
  "Archivo Black": [400],
  // Serif
  "Playfair Display": [400, 700],
  Lora: [400, 700],
  Merriweather: [400, 700],
  "Cormorant Garamond": [400, 700],
  "DM Serif Display": [400],
  "Abril Fatface": [400],
  // Script / handwriting
  "Dancing Script": [400, 700],
  Caveat: [400, 700],
  Pacifico: [400],
  Lobster: [400],
};

export const EDITOR_FONTS: readonly string[] = Object.keys(FONT_WEIGHTS);

export const GOOGLE_FONTS_CSS_URL =
  "https://fonts.googleapis.com/css2?" +
  Object.entries(FONT_WEIGHTS)
    .map(
      ([family, weights]) =>
        `family=${family.replaceAll(" ", "+")}:wght@${weights.join(";")}`
    )
    .join("&") +
  "&display=swap";
