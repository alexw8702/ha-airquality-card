// Plausibilitätsprüfung für zugewiesene Sensoren: die Notenberechnung setzt physikalisch
// sinnvolle Werte in der jeweils erwarteten Einheit voraus (z.B. ppm für CO2). Ein falsch
// zugewiesener Sensor (z.B. Temperatur statt CO2) würde sonst eine unsinnige Note erzeugen,
// ohne dass Karte oder Nutzer das bemerken. Wird sowohl vom Editor (Warnungen) als auch von
// der Karte selbst (harte Ablehnung vor dem Rendern) genutzt.
const AIR_QUALITY_ENTITY_RULES = {
  temp_entity: { label: "Temperatursensor", units: ["°C", "°F"], deviceClasses: ["temperature"] },
  humidity_entity: { label: "Luftfeuchtigkeitssensor", units: ["%"], deviceClasses: ["humidity"] },
  co2_entity: { label: "CO₂-Sensor", units: ["ppm"], deviceClasses: ["carbon_dioxide"] },
  pm25_entity: { label: "PM2.5-Sensor", units: ["µg/m³", "μg/m³"], deviceClasses: ["pm25"] }
};

function validateAirQualityEntity(hass, entityId, rule) {
  if (!entityId) return null;
  const st = hass && hass.states[entityId];
  if (!st) return rule.label + " (" + entityId + "): Entität nicht gefunden";

  const deviceClass = st.attributes && st.attributes.device_class;
  if (deviceClass && rule.deviceClasses.includes(deviceClass)) return null;

  const unit = st.attributes && st.attributes.unit_of_measurement;
  if (unit && rule.units.includes(unit)) return null;

  // Weder device_class noch Einheit passen zur Erwartung -> vermutlich falscher Sensor.
  return rule.label + " (" + entityId + "): unerwartete Einheit/Klasse (" + (unit || deviceClass || "keine") +
    "), erwartet " + rule.units.join("/");
}

// Blockierende Prüfung: diese vier Sensoren gehen direkt in die Notenberechnung und die
// Kachel-Anzeige ein, eine falsche Zuweisung macht die Karte funktional nutzlos.
function validateAirQualityConfig(hass, config) {
  if (!hass || !config) return [];
  const problems = [];
  for (const key of Object.keys(AIR_QUALITY_ENTITY_RULES)) {
    const problem = validateAirQualityEntity(hass, config[key], AIR_QUALITY_ENTITY_RULES[key]);
    if (problem) problems.push(problem);
  }
  return problems;
}

// Nur beratend (Editor-Warnung, nicht render-blockierend): _computeGrade() fängt eine
// fehlende/ungültige weather_entity bereits über Default-Werte ab (siehe dort), daher darf
// eine leere oder (noch) nicht existierende weather_entity die Karte nicht blockieren -
// sonst zeigt die Karte bei den meisten Erstinstallationen dauerhaft einen Fehler, weil der
// Default "weather.forecast_home" nicht bei jedem existiert.
function validateWeatherEntity(hass, config) {
  if (!hass || !config || !config.weather_entity) return [];
  const wst = hass.states[config.weather_entity];
  if (!wst) return ["Wetter-Entity (" + config.weather_entity + "): Entität nicht gefunden (Note wird ohne Außentemperatur-Korrektur berechnet)"];
  if (config.weather_entity.split(".")[0] !== "weather") {
    return ["Wetter-Entity (" + config.weather_entity + "): keine weather-Entität"];
  }
  return [];
}
