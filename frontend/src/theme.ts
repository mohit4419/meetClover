/**
 * Flick - Neo-brutalist Gen-Z social video chat app.
 * Theme tokens, used across screens.
 */

export const COLORS = {
  bg: "#FDFBF7",
  bgSecondary: "#E0F2E9",
  bgPurple: "#B1B2FF",
  pink: "#FF90E8",
  yellow: "#FFDE59",
  blue: "#38BDF8",
  text: "#111111",
  textSecondary: "#4B5563",
  textInverse: "#FDFBF7",
  danger: "#FF5757",
  success: "#00C853",
  white: "#FFFFFF",
  border: "#111111",
  overlay: "rgba(17,17,17,0.55)",
} as const;

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const SHADOW = {
  hard: {
    shadowColor: "#111",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  hardLg: {
    shadowColor: "#111",
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;

export const FONTS = {
  h1: { fontSize: 40, lineHeight: 44, fontWeight: "900" as const, letterSpacing: -1.5 },
  h2: { fontSize: 32, lineHeight: 36, fontWeight: "800" as const, letterSpacing: -1 },
  h3: { fontSize: 24, lineHeight: 28, fontWeight: "800" as const, letterSpacing: -0.5 },
  bodyLg: { fontSize: 18, lineHeight: 26, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "500" as const },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 1.2,
  },
};

export const INTERESTS = [
  "music", "travel", "art", "gaming", "football", "cricket", "anime",
  "ramen", "photography", "yoga", "fashion", "tech", "dance", "salsa",
  "beach", "coffee", "biryani", "samba", "surfing", "tapas",
];

export const LANGUAGES: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "ar", name: "Arabic" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "pt", name: "Portuguese" },
];

export const COUNTRIES = ["USA", "UK", "India", "Japan", "Spain", "UAE", "Brazil", "Germany", "France", "Korea"];
