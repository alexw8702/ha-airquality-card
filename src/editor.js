// Felder, die per Area-Auswahl automatisch vorbelegt werden können. Ein Feld bleibt nur
// dann "automatisch verwaltet", solange der Nutzer es nicht manuell überschrieben hat -
// siehe _AUTOFILL_KEYS-Tracking in value-changed.
const AREA_AUTOFILL_KEYS = ["name", "temp_entity", "humidity_entity", "co2_entity", "pm25_entity", "temp_target"];

// Visueller Karten-Editor: nutzt das in HA eingebaute <ha-form> mit einem Selector-Schema,
// damit Nutzer ihre eigenen Entitäten per Dropdown auswählen können (kein YAML nötig).
class LuftqualitaetCardEditor extends HTMLElement {
  constructor() {
    super();
    // Felder, deren aktueller Wert automatisch aus der Area-Auswahl stammt (noch nicht
    // manuell überschrieben). Nur diese werden bei einem Area-Wechsel neu belegt.
    this._autofilledKeys = new Set();
  }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    this._render();
  }

  get _schema() {
    return [
      { name: "area_id", selector: { area: {} } },
      { name: "name", selector: { text: {} } },
      { name: "temp_entity", selector: { entity: { domain: "sensor", device_class: "temperature" } } },
      { name: "humidity_entity", selector: { entity: { domain: "sensor", device_class: "humidity" } } },
      { name: "co2_entity", selector: { entity: { domain: "sensor", device_class: "carbon_dioxide" } } },
      { name: "pm25_entity", selector: { entity: { domain: "sensor", device_class: "pm25" } } },
      { name: "weather_entity", selector: { entity: { domain: "weather" } } },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "temp_target", selector: { number: { min: 0, max: 40, step: 0.5, mode: "box", unit_of_measurement: "°C" } } },
          { name: "temp_tolerance", selector: { number: { min: 0, max: 10, step: 0.5, mode: "box", unit_of_measurement: "°C" } } },
          { name: "room_max", selector: { number: { min: 0, max: 40, step: 0.5, mode: "box", unit_of_measurement: "°C" } } }
        ]
      },
      { name: "grade_entity", selector: { entity: { domain: "sensor" } } },
      { name: "pm25_avg_window", selector: { number: { min: 5, max: 1440, step: 5, mode: "box", unit_of_measurement: "min" } } },
      {
        name: "card_style",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "classic", label: "Klassisch (Original)" },
              { value: "nordic", label: "Nordic Minimal / Organic" },
              { value: "brutalism", label: "Neo-Brutalism (Retro)" },
              { value: "editorial", label: "Minimalist Editorial (Paper)" },
              { value: "neumorphic", label: "Soft UI (Neumorphismus)" },
              { value: "swiss", label: "Swiss Grid (Minimalistisch)" },
              { value: "cyberpunk", label: "Cyberpunk (Retro-Futuristisch)" },
              { value: "japandi", label: "Japandi Zen (Beruhigend)" },
              { value: "arcade", label: "Retro Arcade (8-Bit)" },
              { value: "metal", label: "Industrial Metal (Skeuomorphisch)" },
              { value: "glass", label: "Liquid Aurora (Mobiles Glas)" },
              { value: "stijl", label: "De Stijl / Mondrian" },
              { value: "bauhaus", label: "Bauhaus Poster (Geometrisch)" },
              { value: "solar", label: "Solarized Terminal (Coder)" },
              { value: "clay", label: "Claymorphism (Soft 3D)" },
              { value: "organic", label: "Biophilic Leaf (Organisch)" },
              { value: "vapor", label: "Vaporwave Grid (80er Synth)" },
              { value: "monolith", label: "Monolith (Brushed Metal LED)" }
            ]
          }
        }
      },
      {
        name: "theme_mode",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "auto", label: "Automatisch (Systemeinstellung)" },
              { value: "light", label: "Hell" },
              { value: "dark", label: "Dunkel" }
            ]
          }
        }
      },
      { name: "glass_effect", selector: { boolean: {} } }
    ];
  }

  _computeLabel(schemaItem) {
    const labels = {
      area_id: "Raum (befüllt Name und Sensoren automatisch vor)",
      name: "Name des Raums",
      temp_entity: "Temperatursensor",
      humidity_entity: "Luftfeuchtigkeitssensor",
      co2_entity: "CO₂-Sensor",
      pm25_entity: "PM2.5-Sensor",
      weather_entity: "Wetter-Entity (für Außentemperatur-Korrektur)",
      temp_target: "Ideale Raumtemperatur",
      temp_tolerance: "Toleranz um Idealtemperatur",
      room_max: "Obergrenze für Außentemperatur-Korrektur",
      grade_entity: "Note-Sensor überschreiben (optional, Legacy)",
      card_style: "Karten-Stil",
      theme_mode: "Darstellung",
      pm25_avg_window: "PM2.5-Mittelungszeitraum für die Note (WHO-Werte sind Zeit-Mittelwerte)",
      glass_effect: "Glass-Effekt (halbtransparent, für Dashboards mit Hintergrundbild)"
    };
    return labels[schemaItem.name] || schemaItem.name;
  }

  // Findet für eine Area passende Sensor-Entitäten (per device_class, siehe
  // AIR_QUALITY_ENTITY_RULES) über die Entity-Registry (hass.entities) inkl. Fallback auf
  // die Area des zugehörigen Geräts (hass.devices), falls die Entität selbst keine eigene
  // Area-Zuweisung hat.
  //
  // Enthält ein Raum mehrere Sensoren desselben Typs (z.B. zwei CO2-Sensoren von zwei
  // unterschiedlichen Multisensor-Geräten), wäre ein beliebiger Treffer pro Typ mehrdeutig
  // und könnte Sensoren unterschiedlicher physischer Geräte mischen. Autofill greift daher
  // nur, wenn genau ein Gerät im Raum ALLE vier Sensortypen liefert - dessen Entitäten werden
  // dann komplett übernommen. Gibt es kein solches Gerät, bleiben alle vier Felder leer statt
  // eine unsichere Einzelauswahl zu treffen.
  _findAreaEntityMatches(areaId) {
    const requiredKeys = Object.keys(AIR_QUALITY_ENTITY_RULES);
    const matches = { temp_entity: null, humidity_entity: null, co2_entity: null, pm25_entity: null };
    const hass = this._hass;
    if (!areaId || !hass || !hass.entities || !hass.states) return matches;

    const byDevice = new Map();
    for (const entityId of Object.keys(hass.entities)) {
      if (entityId.split(".")[0] !== "sensor") continue;
      const entry = hass.entities[entityId];
      if (!entry || !entry.device_id) continue; // Gerätezuordnung ist für diese Prüfung erforderlich
      let entityArea = entry.area_id;
      if (!entityArea && hass.devices && hass.devices[entry.device_id]) {
        entityArea = hass.devices[entry.device_id].area_id;
      }
      if (entityArea !== areaId) continue;

      const st = hass.states[entityId];
      const deviceClass = st && st.attributes && st.attributes.device_class;
      if (!deviceClass) continue;

      for (const key of requiredKeys) {
        if (!AIR_QUALITY_ENTITY_RULES[key].deviceClasses.includes(deviceClass)) continue;
        if (!byDevice.has(entry.device_id)) byDevice.set(entry.device_id, {});
        const deviceMatches = byDevice.get(entry.device_id);
        if (!deviceMatches[key]) deviceMatches[key] = entityId; // erster Treffer je Typ und Gerät
      }
    }

    const completeDeviceIds = [...byDevice.keys()]
      .filter((deviceId) => requiredKeys.every((key) => byDevice.get(deviceId)[key]))
      .sort();
    if (completeDeviceIds.length > 0) {
      const deviceMatches = byDevice.get(completeDeviceIds[0]);
      for (const key of requiredKeys) matches[key] = deviceMatches[key];
    }

    return matches;
  }

  // Erkennt Schlafzimmer anhand des Raumnamens (deutsch/englisch, wie von HA beim Anlegen
  // vorgeschlagen). Für Schlafzimmer setzt die WHO ein niedrigeres Sicherheitsminimum an als
  // für allgemein genutzte Wohnräume: WHO Housing and Health Guidelines (2018) empfehlen
  // 18°C als Minimum zum Schutz vor kältebedingten Gesundheitsschäden (siehe README/Quellen).
  // Das ist kein Schlaf-Komfort-Optimum (dafür gelten in der Schlafforschung oft niedrigere
  // Werte), sondern der von der WHO belegte gesundheitliche Mindestwert.
  static BEDROOM_NAME_PATTERN = /schlafzimmer|bedroom/i;
  static WHO_BEDROOM_MIN_TEMP = 18;
  static GENERIC_DEFAULT_TEMP_TARGET = 21;

  // Zentrale Quelle für alle aus der Area ableitbaren Werte (Name, Sensoren, ggf.
  // Schlafzimmer-Temperaturvorgabe). null/undefined bedeutet "für dieses Feld nichts
  // abzuleiten" - wird von _applyAreaAutofill und der Manuell-Bearbeitung-Erkennung
  // (value-changed) gemeinsam genutzt, damit beide Stellen dieselbe Definition von
  // "aktueller Area-Wert" verwenden.
  _areaDerivedValues(areaId) {
    const hass = this._hass;
    const area = hass && hass.areas && hass.areas[areaId];
    const areaName = area ? area.name : null;
    const matches = this._findAreaEntityMatches(areaId);
    const isBedroom = !!areaName && LuftqualitaetCardEditor.BEDROOM_NAME_PATTERN.test(areaName);
    return {
      name: areaName,
      temp_entity: matches.temp_entity,
      humidity_entity: matches.humidity_entity,
      co2_entity: matches.co2_entity,
      pm25_entity: matches.pm25_entity,
      temp_target: isBedroom ? LuftqualitaetCardEditor.WHO_BEDROOM_MIN_TEMP : null
    };
  }

  // Belegt Name, Sensor-Felder und (bei erkanntem Schlafzimmer) die Zieltemperatur aus der
  // gewählten Area vor, ohne Felder zu überschreiben, die der Nutzer bereits manuell gesetzt
  // hat (siehe _autofilledKeys-Tracking).
  _applyAreaAutofill(config, areaId) {
    if (!this._hass) return;
    const derived = this._areaDerivedValues(areaId);
    for (const key of AREA_AUTOFILL_KEYS) {
      const value = derived[key];
      if (value === null || value === undefined) continue;
      const isEmpty = key === "temp_target"
        ? (!Number.isFinite(config[key]) || config[key] === LuftqualitaetCardEditor.GENERIC_DEFAULT_TEMP_TARGET)
        : !config[key];
      if (isEmpty || this._autofilledKeys.has(key)) {
        config[key] = value;
        this._autofilledKeys.add(key);
      }
    }
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const newConfig = { ...ev.detail.value };
        const oldConfig = this._config || {};

        if (newConfig.area_id && newConfig.area_id !== oldConfig.area_id) {
          this._applyAreaAutofill(newConfig, newConfig.area_id);
        }

        // Manuelle Bearbeitung eines zuvor automatisch befüllten Felds beendet dessen
        // Autofill-Status, damit ein späterer Area-Wechsel es nicht mehr überschreibt.
        const derived = newConfig.area_id ? this._areaDerivedValues(newConfig.area_id) : {};
        for (const key of AREA_AUTOFILL_KEYS) {
          if (this._autofilledKeys.has(key) && newConfig[key] !== oldConfig[key]) {
            // Wert wurde entweder gerade von _applyAreaAutofill gesetzt (dann identisch mit
            // dem abgeleiteten Wert, bleibt markiert) oder vom Nutzer direkt im Formular geändert.
            if (newConfig[key] !== derived[key]) this._autofilledKeys.delete(key);
          }
        }

        this._config = newConfig;
        this.dispatchEvent(new CustomEvent("config-changed", {
          detail: { config: newConfig },
          bubbles: true,
          composed: true
        }));
        this._renderWarnings();
      });
      this._warningsEl = document.createElement("div");
      this._warningsEl.style.cssText = "margin-top:8px; font-size:12px; color:#ef5350;";
      this.innerHTML = "";
      this.appendChild(this._form);
      this.appendChild(this._warningsEl);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = this._schema;
    this._form.computeLabel = this._computeLabel.bind(this);
    this._renderWarnings();
  }

  // Zeigt zur Auswahl passende, aber inhaltlich unplausible Sensoren als Warnung an
  // (z.B. bei per YAML gesetzten Entitäten ohne passende device_class), sowie einen Hinweis,
  // falls die gewählte Area keine passenden Sensoren enthält.
  _renderWarnings() {
    if (!this._warningsEl) return;
    const problems = validateAirQualityConfig(this._hass, this._config)
      .concat(validateWeatherEntity(this._hass, this._config));

    if (this._config && this._config.area_id) {
      const matches = this._findAreaEntityMatches(this._config.area_id);
      const noneMatched = Object.values(matches).every((v) => !v);
      if (noneMatched) {
        problems.push("Gewählter Raum: kein Gerät gefunden, das alle vier Sensortypen liefert (device_class fehlt vermutlich, oder die Sensoren gehören zu unterschiedlichen Geräten) - bitte Sensoren manuell zuweisen.");
      }
    }

    this._warningsEl.innerHTML = problems.length
      ? "⚠ " + problems.join("<br>⚠ ")
      : "";
  }
}

if (!customElements.get("luftqualitaet-card-editor")) {
  customElements.define("luftqualitaet-card-editor", LuftqualitaetCardEditor);
}
