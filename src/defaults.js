// Einzige Quelle für alle optionalen Config-Defaults - wird von setConfig(), getStubConfig()
// und dem internen Fallback in _ensurePmAverage() gemeinsam genutzt, damit die drei Stellen
// nicht mehr unabhängig voneinander gepflegt werden müssen (vorher drei duplizierte Literale).
const DEFAULT_CONFIG = {
  weather_entity: "weather.forecast_home",
  temp_target: 21,
  temp_tolerance: 1,
  room_max: 22,
  theme_mode: "auto",
  pm25_avg_window: 1440,
  glass_effect: false,
  card_style: "classic"
};
