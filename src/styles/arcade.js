// Farbpaletten für Retro Arcade
const ARCADE_PALETTES = {
  dark: {
    cardBg: "#0c0728",
    cardBorder: "4px solid #00f6ff",
    cardBackdropFilter: "none",
    cardShadow: "8px 8px 0px #ff007f",
    title: "#ff007f",
    metricBg: "#120b38",
    metricBorder: "4px solid #00f6ff",
    metricShadow: "4px 4px 0px #ff007f",
    label: "#ff007f",
    value: "#ffffff",
    unit: "#ff007f",
    footer: "#00f6ff",
    hintColor: "#00f6ff",
    problemColor: "#ff007f"
  },
  light: {
    cardBg: "#ffd200",
    cardBorder: "4px solid #000000",
    cardBackdropFilter: "none",
    cardShadow: "8px 8px 0px #000000",
    title: "#000000",
    metricBg: "#ffffff",
    metricBorder: "4px solid #000000",
    metricShadow: "4px 4px 0px #000000",
    label: "#000000",
    value: "#000000",
    unit: "#000000",
    footer: "#000000",
    hintColor: "#000000",
    problemColor: "#000000"
  }
};

const ARCADE_GLASS_OVERRIDES = {
  dark: {
    cardBg: "rgba(12, 7, 40, 0.75)",
    cardBackdropFilter: "blur(20px) saturate(150%)"
  },
  light: {
    cardBg: "rgba(255, 210, 0, 0.75)",
    cardBackdropFilter: "blur(20px) saturate(150%)"
  }
};
