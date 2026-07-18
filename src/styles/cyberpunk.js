// Farbpaletten für Cyberpunk Grid
const CYBERPUNK_PALETTES = {
  dark: {
    cardBg: "#09090c",
    cardBorder: "2px solid #bd00ff",
    cardBackdropFilter: "none",
    cardShadow: "0 0 15px rgba(189,0,255,0.4)",
    title: "#bd00ff",
    metricBg: "#12121e",
    metricBorder: "1px solid #bd00ff",
    metricShadow: "inset 0 0 5px rgba(189,0,255,0.2)",
    label: "#bd00ff",
    value: "#ffffff",
    unit: "#bd00ff",
    footer: "#bd00ff",
    hintColor: "#bd00ff",
    problemColor: "#bd00ff"
  },
  light: {
    cardBg: "#dfff60",
    cardBorder: "2px solid #000000",
    cardBackdropFilter: "none",
    cardShadow: "5px 5px 0px #000000",
    title: "#000000",
    metricBg: "#ffffff",
    metricBorder: "2px solid #000000",
    metricShadow: "3px 3px 0px #000000",
    label: "#000000",
    value: "#000000",
    unit: "#000000",
    footer: "#000000",
    hintColor: "#000000",
    problemColor: "#000000"
  }
};

const CYBERPUNK_GLASS_OVERRIDES = {
  dark: {
    cardBg: "rgba(9, 9, 12, 0.75)",
    cardBackdropFilter: "blur(20px) saturate(150%)"
  },
  light: {
    cardBg: "rgba(223, 255, 96, 0.75)",
    cardBackdropFilter: "blur(20px) saturate(150%)"
  }
};
