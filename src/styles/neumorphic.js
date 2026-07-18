// Farbpaletten für Soft UI / Neumorphismus
const NEUMORPHIC_PALETTES = {
  dark: {
    cardBg: "#1e222b",
    cardBorder: "none",
    cardBackdropFilter: "none",
    cardShadow: "12px 12px 24px #12141a, -12px -12px 24px #2a303c",
    title: "#edf2f7",
    metricBg: "#1e222b",
    metricBorder: "none",
    metricShadow: "4px 4px 10px #12141a, -4px -4px 10px #2a303c",
    label: "#a0aec0",
    value: "#edf2f7",
    unit: "#a0aec0",
    footer: "#a0aec0",
    hintColor: "#a0aec0",
    problemColor: "#a0aec0"
  },
  light: {
    cardBg: "#e6e9ef",
    cardBorder: "none",
    cardBackdropFilter: "none",
    cardShadow: "12px 12px 24px #d1d5db, -12px -12px 24px #ffffff",
    title: "#2d3748",
    metricBg: "#e6e9ef",
    metricBorder: "none",
    metricShadow: "4px 4px 10px #d1d5db, -4px -4px 10px #ffffff",
    label: "#718096",
    value: "#2d3748",
    unit: "#718096",
    footer: "#718096",
    hintColor: "#718096",
    problemColor: "#718096"
  }
};

const NEUMORPHIC_GLASS_OVERRIDES = {
  dark: {
    cardBg: "rgba(30, 34, 43, 0.7)",
    cardBackdropFilter: "blur(20px) saturate(150%)"
  },
  light: {
    cardBg: "rgba(230, 233, 239, 0.7)",
    cardBackdropFilter: "blur(20px) saturate(150%)"
  }
};
