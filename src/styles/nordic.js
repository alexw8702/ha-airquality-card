// Farbpaletten für das Nordic Minimal-Design (Skandinavischer Look)
const NORDIC_PALETTES = {
  dark: {
    cardBg: "#1c221e",
    cardBorder: "1px solid rgba(255,255,255,0.02)",
    cardBackdropFilter: "none",
    cardShadow: "0 8px 30px rgba(0, 0, 0, 0.4)",
    title: "#e5e8e3",
    metricBg: "#252d27",
    metricHoverBg: "#2d372f",
    label: "#a2a8a3",
    value: "#f3f4f6",
    unit: "#6b7280",
    footer: "#a2a8a3",
    hintColor: "#a2a8a3",
    problemColor: "#a2a8a3"
  },
  light: {
    cardBg: "#ebe7dd",
    cardBorder: "1px solid rgba(0,0,0,0.03)",
    cardBackdropFilter: "none",
    cardShadow: "0 8px 30px rgba(44, 53, 39, 0.08)",
    title: "#2c3527",
    metricBg: "#fdfdfc",
    metricHoverBg: "#f4f4f0",
    label: "#6b7280",
    value: "#1f2937",
    unit: "#9ca3af",
    footer: "#6b7280",
    hintColor: "#6b7280",
    problemColor: "#6b7280"
  }
};

// Glasmorphismus für das Nordic Minimal-Design
const NORDIC_GLASS_OVERRIDES = {
  dark: {
    cardBg: "rgba(28, 34, 30, 0.55)",
    cardBorder: "1px solid rgba(255, 255, 255, 0.08)",
    cardBackdropFilter: "blur(20px) saturate(150%)",
    metricBg: "rgba(37, 45, 39, 0.45)",
    metricHoverBg: "rgba(45, 55, 47, 0.55)",
    metricBackdropFilter: "blur(10px) saturate(150%)"
  },
  light: {
    cardBg: "rgba(235, 231, 221, 0.55)",
    cardBorder: "1px solid rgba(0, 0, 0, 0.06)",
    cardBackdropFilter: "blur(20px) saturate(150%)",
    metricBg: "rgba(253, 253, 252, 0.45)",
    metricHoverBg: "rgba(253, 253, 252, 0.65)",
    metricBackdropFilter: "blur(10px) saturate(150%)"
  }
};
