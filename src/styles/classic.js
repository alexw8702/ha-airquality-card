// Zwei feste Farbpaletten statt HA-Theme-Variablen: die Karte wurde ursprünglich für ein
// bestimmtes dunkles Aussehen auf dem Handy entworfen, "auto" soll sich am Systemzustand
// (prefers-color-scheme) orientieren statt am aktiven HA-Dashboard-Theme.
const CARD_PALETTES = {
  dark: {
    cardBg: "#12151c",
    cardBorder: "none",
    cardBackdropFilter: "none",
    cardShadow: "0 2px 10px rgba(0,0,0,0.4)",
    title: "#e7e9ee",
    metricBg: "#1a1f2a",
    metricHoverBg: "#222839",
    label: "#8a93a3",
    value: "#f2f4f7",
    unit: "#8a93a3",
    footer: "#5b6472",
    hintColor: "#8a93a3",
    problemColor: "#8a93a3"
  },
  light: {
    cardBg: "#f2f3f5",
    cardBorder: "none",
    cardBackdropFilter: "none",
    cardShadow: "0 2px 10px rgba(0,0,0,0.10)",
    title: "#1c1f26",
    metricBg: "#ffffff",
    metricHoverBg: "#e9ebef",
    label: "#6b7280",
    value: "#1c1f26",
    unit: "#6b7280",
    footer: "#9aa1ac",
    hintColor: "#6b7280",
    problemColor: "#6b7280"
  }
};

// Glasmorphismus-Overrides: greifen nur bei config.glass_effect === true. Macht Karte und
// Kacheln halbtransparent + weichgezeichnet, damit ein HA-Dashboard-Hintergrundbild
// durchscheint, statt die deckenden Standardfarben aus CARD_PALETTES zu verwenden. Bewusst
// opt-in (Default aus) statt Standardverhalten, da ein Blur ohne Hintergrundbild (die meisten
// HA-Dashboards haben keins) keinen Mehrwert bringt und nur Kontrast kostet.
const GLASS_OVERRIDES = {
  dark: {
    cardBg: "rgba(18, 21, 28, 0.55)",
    cardBorder: "1px solid rgba(255, 255, 255, 0.08)",
    cardBackdropFilter: "blur(20px) saturate(150%)",
    metricBg: "rgba(26, 31, 42, 0.45)",
    metricHoverBg: "rgba(34, 40, 57, 0.55)",
    metricBackdropFilter: "blur(10px) saturate(150%)"
  },
  light: {
    cardBg: "rgba(255, 255, 255, 0.55)",
    cardBorder: "1px solid rgba(255, 255, 255, 0.6)",
    cardBackdropFilter: "blur(20px) saturate(150%)",
    metricBg: "rgba(255, 255, 255, 0.45)",
    metricHoverBg: "rgba(255, 255, 255, 0.65)",
    metricBackdropFilter: "blur(10px) saturate(150%)"
  }
};
