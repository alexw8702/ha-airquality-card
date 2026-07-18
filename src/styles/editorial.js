// Farbpaletten für Minimalist Editorial (Paper)
const EDITORIAL_PALETTES = {
  dark: {
    cardBg: "#18181c",
    cardBorder: "1px solid #2d2d35",
    cardBackdropFilter: "none",
    cardShadow: "0 4px 25px rgba(0,0,0,0.3)",
    title: "#f3f4f6",
    metricBg: "transparent",
    metricBorder: "none",
    label: "#9ca3af",
    value: "#f3f4f6",
    unit: "#9ca3af",
    footer: "#9ca3af",
    hintColor: "#9ca3af",
    problemColor: "#9ca3af"
  },
  light: {
    cardBg: "#fdfcfb",
    cardBorder: "1px solid #e5e7eb",
    cardBackdropFilter: "none",
    cardShadow: "0 4px 20px rgba(0,0,0,0.02)",
    title: "#111827",
    metricBg: "transparent",
    metricBorder: "none",
    label: "#6b7280",
    value: "#111827",
    unit: "#6b7280",
    footer: "#6b7280",
    hintColor: "#6b7280",
    problemColor: "#6b7280"
  }
};

const EDITORIAL_GLASS_OVERRIDES = {
  dark: {
    cardBg: "rgba(24, 24, 28, 0.7)",
    cardBackdropFilter: "blur(20px) saturate(150%)"
  },
  light: {
    cardBg: "rgba(253, 252, 251, 0.7)",
    cardBackdropFilter: "blur(20px) saturate(150%)"
  }
};
