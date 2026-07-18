// Farbpaletten für Industrial Metal
const METAL_PALETTES = {
  dark: {
    cardBg: "linear-gradient(135deg, #2d3035, #15171a)",
    cardBorder: "1px solid #484d54",
    cardBackdropFilter: "none",
    cardShadow: "0 8px 24px rgba(0,0,0,0.4)",
    title: "#ff8d00",
    metricBg: "#1d2024",
    metricBorder: "1px solid #484d54",
    metricShadow: "none",
    label: "#ff8d00",
    value: "#ffffff",
    unit: "#ff8d00",
    footer: "#cdd4dd",
    hintColor: "#cdd4dd",
    problemColor: "#ff8d00"
  },
  light: {
    cardBg: "linear-gradient(135deg, #d8dcdb, #b5b9b8)",
    cardBorder: "1px solid #7a7e7d",
    cardBackdropFilter: "none",
    cardShadow: "0 8px 24px rgba(0,0,0,0.15)",
    title: "#2c302f",
    metricBg: "#ccd0cf",
    metricBorder: "1px solid #9aa09f",
    metricShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
    label: "#2c302f",
    value: "#2c302f",
    unit: "#2c302f",
    footer: "#2c302f",
    hintColor: "#2c302f",
    problemColor: "#2c302f"
  }
};

const METAL_GLASS_OVERRIDES = {
  dark: {
    cardBg: "rgba(45, 48, 53, 0.7)",
    cardBackdropFilter: "blur(20px) saturate(150%)"
  },
  light: {
    cardBg: "rgba(216, 220, 219, 0.7)",
    cardBackdropFilter: "blur(20px) saturate(150%)"
  }
};
