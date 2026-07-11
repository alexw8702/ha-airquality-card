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

class LuftqualitaetCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._tickBound = this._tick.bind(this);
    this._raf = null;
    this._paths = null;
    this._visible = false;
    this._reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // "auto"-Theme-Modus: folgt der Geräte-/Browser-Einstellung (prefers-color-scheme),
    // nicht dem aktiven HA-Dashboard-Theme. Reagiert live auf Änderungen (z.B. Handy wechselt
    // zwischen Tag/Nacht), solange theme_mode auf "auto" steht.
    this._colorSchemeMedia = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    this._systemPrefersDark = this._colorSchemeMedia ? this._colorSchemeMedia.matches : true;
    this._colorSchemeListener = (ev) => {
      this._systemPrefersDark = ev.matches;
      if (!this._config || !this._config.theme_mode || this._config.theme_mode === "auto") {
        this._render();
      }
    };
    const rnd = () => Math.random();
    const TP = Math.PI * 2;
    this._r = {
      offMain: rnd() * TP,
      offEcho: rnd() * TP,
      spdMain: 0.00044 * (0.8 + rnd() * 0.5),
      spdEcho: -0.00036 * (0.8 + rnd() * 0.5),
      h1: rnd() * TP,
      h2: rnd() * TP,
      h3: rnd() * TP,
      a1: 5.2 + rnd() * 1.8,
      a2: 3.0 + rnd() * 1.2,
      a3: 1.6 + rnd() * 1.0
    };
    // Winkel-Tabelle einmalig vorab berechnen statt jeden Frame neu (spart Math.cos/sin Aufrufe)
    this._N = 88;
    this._cosA = new Float32Array(this._N + 1);
    this._sinA = new Float32Array(this._N + 1);
    for (let i = 0; i <= this._N; i++) {
      const a = (i / this._N) * TP;
      this._cosA[i] = Math.cos(a);
      this._sinA[i] = Math.sin(a);
    }
    this._angles = new Float32Array(this._N + 1);
    for (let i = 0; i <= this._N; i++) {
      this._angles[i] = (i / this._N) * TP;
    }
  }

  setConfig(config) {
    // Bewusst tolerant: die Karte wird über den visuellen Editor (getConfigElement)
    // konfiguriert, dabei ist eine Zwischenphase mit leeren Entity-Feldern normal.
    // _render() zeigt in diesem Fall einen Hinweis statt zu crashen.
    this._config = {
      weather_entity: "weather.forecast_home",
      temp_target: 21,
      temp_tolerance: 1,
      room_max: 22,
      theme_mode: "auto",
      pm25_avg_window: 1440,
      glass_effect: false,
      ...config
    };
  }

  static getConfigElement() {
    return document.createElement("luftqualitaet-card-editor");
  }

  static getStubConfig() {
    return {
      area_id: "",
      name: "",
      temp_entity: "",
      humidity_entity: "",
      co2_entity: "",
      pm25_entity: "",
      weather_entity: "weather.forecast_home",
      temp_target: 21,
      temp_tolerance: 1,
      room_max: 22,
      theme_mode: "auto",
      pm25_avg_window: 1440,
      glass_effect: false
    };
  }

  // "dark" | "light" | "auto" (Default) -> auto folgt der Geräte-/Browser-Einstellung.
  _isDarkMode() {
    const mode = this._config && this._config.theme_mode;
    if (mode === "dark") return true;
    if (mode === "light") return false;
    return this._systemPrefersDark;
  }

  set hass(hass) {
    this._hass = hass;
    const keys = ["grade_entity", "temp_entity", "humidity_entity", "co2_entity", "pm25_entity", "weather_entity"];
    const sig = keys.map((k) => {
      const st = hass.states[this._config?.[k]];
      return st ? st.state + (st.attributes?.temperature ?? "") + (st.attributes?.templow ?? "") : "?";
    }).join("|");
    if (sig !== this._lastSig) {
      this._lastSig = sig;
      this._render();
    }
  }

  connectedCallback() {
    this._timer = window.setInterval(() => {
      this._lastSig = null;
      this._render();
    }, 60000);

    if (this._colorSchemeMedia) {
      if (this._colorSchemeMedia.addEventListener) {
        this._colorSchemeMedia.addEventListener("change", this._colorSchemeListener);
      } else if (this._colorSchemeMedia.addListener) {
        // Fallback für ältere WebView-Engines ohne addEventListener auf MediaQueryList
        this._colorSchemeMedia.addListener(this._colorSchemeListener);
      }
    }

    // Nur animieren, wenn die Karte tatsaechlich sichtbar ist (Viewport / anderer View / gescrollt)
    if ("IntersectionObserver" in window) {
      this._io = new IntersectionObserver((entries) => {
        const isVisible = entries[entries.length - 1].isIntersecting;
        this._visible = isVisible;
        if (isVisible) {
          this._startLoop();
        } else {
          this._stopLoop();
        }
      }, { threshold: 0.01 });
      this._io.observe(this);
    } else {
      // Fallback ohne IntersectionObserver-Support
      this._visible = true;
      this._startLoop();
    }
  }

  disconnectedCallback() {
    if (this._timer) window.clearInterval(this._timer);
    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }
    if (this._colorSchemeMedia) {
      if (this._colorSchemeMedia.removeEventListener) {
        this._colorSchemeMedia.removeEventListener("change", this._colorSchemeListener);
      } else if (this._colorSchemeMedia.removeListener) {
        this._colorSchemeMedia.removeListener(this._colorSchemeListener);
      }
    }
    this._stopLoop();
  }

  _startLoop() {
    if (!this._reduced && this._raf === null) {
      this._raf = window.requestAnimationFrame(this._tickBound);
    }
  }

  _stopLoop() {
    if (this._raf !== null) {
      window.cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  getCardSize() {
    return 5;
  }

  _openMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      detail: { entityId },
      bubbles: true,
      composed: true
    }));
  }

  _num(entityId) {
    const st = this._hass && this._hass.states[entityId];
    if (!st || st.state === "unknown" || st.state === "unavailable") return null;
    const v = parseFloat(st.state);
    return Number.isNaN(v) ? null : v;
  }

  _unit(entityId, fallback) {
    const st = this._hass && this._hass.states[entityId];
    return (st && st.attributes && st.attributes.unit_of_measurement) || fallback;
  }

  _fmt(value, decimals) {
    if (value === null) return "–";
    return value.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  _gradeColor(value) {
    const stops = [
      [1, [76, 175, 80]],
      [2, [139, 195, 74]],
      [3, [255, 193, 7]],
      [4, [255, 111, 0]],
      [5, [211, 47, 47]]
    ];
    const v = Math.min(5, Math.max(1, value));
    for (let i = 0; i < stops.length - 1; i++) {
      const p1 = stops[i][0], c1 = stops[i][1];
      const p2 = stops[i + 1][0], c2 = stops[i + 1][1];
      if (v >= p1 && v <= p2) {
        const t = (v - p1) / (p2 - p1);
        return c1.map((c, idx) => Math.round(c + (c2[idx] - c) * t));
      }
    }
    return stops[stops.length - 1][1];
  }

  _gradeLabel(value) {
    if (value <= 1.5) return "Sehr gut";
    if (value <= 2.5) return "Gut";
    if (value <= 3.5) return "Befriedigend";
    if (value <= 4.5) return "Schwach";
    return "Schlecht";
  }

  _tempStatus(v) {
    if (v === null) return { text: "–", color: "#8a93a3" };
    if (v >= 20 && v <= 23) return { text: "Optimal", color: "#66bb6a" };
    if (v >= 18 && v <= 25) return { text: "Gut", color: "#9ccc65" };
    if (v >= 16 && v <= 27) return { text: "Mäßig", color: "#ffb74d" };
    return { text: "Schlecht", color: "#ef5350" };
  }

  _co2Status(v) {
    if (v === null) return { text: "–", color: "#8a93a3" };
    if (v <= 800) return { text: "Gut", color: "#66bb6a" };
    if (v <= 1200) return { text: "Mäßig", color: "#ffb74d" };
    return { text: "Schlecht", color: "#ef5350" };
  }

  _humidityStatus(v) {
    if (v === null) return { text: "–", color: "#8a93a3" };
    if (v >= 40 && v <= 60) return { text: "Gut", color: "#4fc3f7" };
    if (v >= 30 && v <= 70) return { text: "Mäßig", color: "#ffb74d" };
    return { text: "Schlecht", color: "#ef5350" };
  }

  // Schwellen nach WHO Global Air Quality Guidelines 2021 (Jahresmittel 5 µg/m³,
  // 24h-Mittel 15 µg/m³ - siehe README/Quellen). v ist beim Aufruf für die PM2.5-Kachel
  // bereits der gleitende Mittelwert (siehe _render: this._pmAverageOrCurrent(...)), NICHT
  // der Momentanwert - sonst würde eine kurze Spitze (Kochen etc.) die Kachel "Schlecht"
  // färben, obwohl der WHO-relevante 24h-Trend besser ist. Nur die angezeigte Zahl bleibt
  // der Momentanwert.
  _pm25Status(v) {
    if (v === null) return { text: "–", color: "#8a93a3" };
    if (v <= 5) return { text: "Gut", color: "#ba68c8" };
    if (v <= 15) return { text: "Mäßig", color: "#ffb74d" };
    return { text: "Schlecht", color: "#ef5350" };
  }

  // Portiert aus dem ursprünglichen "Luftqualitätsnote"-Template-Helper (UI-Helfer,
  // wird bei einer HACS-Installation NICHT mitinstalliert). Note 1 (sehr gut) - 5 (schlecht).
  _co2Norm(v) {
    if (v <= 420) return 0.75;
    if (v < 800) return 0.75 + (v - 420) / 380 * 0.75;
    if (v < 1000) return 1.5 + (v - 800) / 200 * 1.0;
    if (v < 1400) return 2.5 + (v - 1000) / 400 * 1.0;
    if (v < 2000) return 3.5 + (v - 1400) / 600 * 1.0;
    return 5;
  }

  // Schwellen nach WHO Global Air Quality Guidelines 2021: Jahresmittel 5 µg/m³,
  // 24h-Mittel 15 µg/m³ (verschärft gegenüber den alten 2005er-Werten 10/25, siehe README).
  // WHO nennt keine weiteren Stufen oberhalb davon; 25/50 als obere Bänder folgen gängigen
  // AQI-Einstufungen (z.B. US EPA "Unhealthy for Sensitive Groups"/"Unhealthy") als
  // praktikable Fortsetzung der Skala. v ist hier bereits der gleitende Mittelwert
  // (siehe _ensurePmAverage), nicht der Momentanwert - WHO-Werte sind selbst Mittelwerte
  // über Zeiträume, ein 1:1-Vergleich mit Momentanwerten wäre methodisch nicht sauber.
  _pmNorm(v) {
    if (v <= 1) return 0.75;
    if (v <= 5) return 0.75 + (v - 1) / 4 * 0.75;
    if (v <= 15) return 1.5 + (v - 5) / 10 * 1.0;
    if (v <= 25) return 2.5 + (v - 15) / 10 * 1.0;
    if (v <= 50) return 3.5 + (v - 25) / 25 * 1.0;
    return 5;
  }

  _rhNorm(v) {
    const d = Math.abs(v - 50);
    if (d <= 10) return 0.75 + d / 10 * 0.75;
    if (d <= 25) return 1.5 + (d - 10) / 15 * 1.0;
    if (d <= 35) return 2.5 + (d - 25) / 10 * 1.0;
    if (d <= 45) return 3.5 + (d - 35) / 10 * 1.0;
    return 5;
  }

  _tempNorm(v, mid, half) {
    const d = Math.abs(v - mid);
    // half (temp_tolerance) ist nutzerkonfigurierbar; 0 wäre eine Division durch 0.
    const safeHalf = half > 0 ? half : 0.01;
    if (d <= safeHalf) return 0.75 + (d / safeHalf) * 0.75;
    if (d <= safeHalf + 4) return 1.5 + (d - safeHalf) / 4 * 3.5;
    return 5;
  }

  // v entspricht Jinja's states(...)|float(0): fehlender/ungültiger Zustand -> 0
  _numOr0(entityId) {
    const st = this._hass && this._hass.states[entityId];
    if (!st) return 0;
    const v = parseFloat(st.state);
    return Number.isNaN(v) ? 0 : v;
  }

  // Gleitender 24h-Mittelwert für PM2.5 statt Momentanwert: die WHO-Guidelines sind
  // explizit als 24h-Mittelwert definiert (siehe README/Quellen), daher ist 1440 Minuten
  // (24h) der Default für pm25_avg_window - kurzfristige Spitzen (Kochen, Kerzen) sollen
  // die Note nicht dominieren. Holt die letzten `pm25_avg_window` Minuten über die
  // HA History-API und cached das Ergebnis für 5 Minuten, um nicht bei jedem Render
  // (Sensor-Update alle paar Sekunden möglich) neu zu laden. Läuft asynchron und stößt bei
  // Ankunft neuer Daten ein Re-Render an; bis dahin (und bei Fehlern) fällt _computeGrade()
  // auf den Momentanwert zurück, damit die Karte sofort nutzbar bleibt.
  _ensurePmAverage() {
    const entityId = this._config.pm25_entity;
    const windowMinutes = Number.isFinite(this._config.pm25_avg_window) && this._config.pm25_avg_window > 0
      ? this._config.pm25_avg_window
      : 1440;
    if (!entityId || !this._hass || typeof this._hass.callApi !== "function") return;

    const cache = this._pmAvg;
    const cacheValid = cache && cache.entityId === entityId && cache.windowMinutes === windowMinutes
      && Date.now() < cache.refreshAt;
    if (cacheValid || this._pmAvgFetching) return;

    this._pmAvgFetching = true;
    const start = new Date(Date.now() - windowMinutes * 60000).toISOString();
    this._hass.callApi(
      "GET",
      `history/period/${start}?filter_entity_id=${entityId}&minimal_response&no_attributes`
    ).then((result) => {
      const series = (result && result[0]) || [];
      const values = series.map((s) => parseFloat(s.state)).filter((v) => Number.isFinite(v));
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      this._pmAvg = { entityId, windowMinutes, value: avg, refreshAt: Date.now() + 5 * 60000 };
      this._pmAvgFetching = false;
      this._render();
    }).catch(() => {
      // Kein History-Zugriff (z.B. Recorder deaktiviert) - Note nutzt weiter den Momentanwert.
      // Kurzer Retry-Abstand statt Dauerschleife von Fehlversuchen.
      this._pmAvg = { entityId, windowMinutes, value: null, refreshAt: Date.now() + 60000 };
      this._pmAvgFetching = false;
    });
  }

  _pmAverageOrCurrent(entityId) {
    this._ensurePmAverage();
    const cache = this._pmAvg;
    if (cache && cache.entityId === entityId && cache.value !== null) return cache.value;
    return this._numOr0(entityId);
  }

  _computeGrade() {
    const cfg = this._config;
    const co2 = this._co2Norm(this._numOr0(cfg.co2_entity));
    const pm = this._pmNorm(this._pmAverageOrCurrent(cfg.pm25_entity));
    const rh = this._rhNorm(this._numOr0(cfg.humidity_entity));
    const traw = this._numOr0(cfg.temp_entity);
    // Falls im Editor geleert (number-Selector kann dann undefined liefern), auf sinnvolle
    // Defaults zurückfallen statt eine NaN-Note zu berechnen.
    const tempTarget = Number.isFinite(cfg.temp_target) ? cfg.temp_target : 21;
    const tempTolerance = Number.isFinite(cfg.temp_tolerance) ? cfg.temp_tolerance : 1;
    const roomMaxCfg = Number.isFinite(cfg.room_max) ? cfg.room_max : 22;
    const t = this._tempNorm(traw, tempTarget, tempTolerance);

    const weatherAttrs = (this._hass.states[cfg.weather_entity] || {}).attributes || {};
    let outHigh = parseFloat(weatherAttrs.temperature);
    if (Number.isNaN(outHigh)) outHigh = 28;
    let outLow;
    if (weatherAttrs.templow !== undefined && weatherAttrs.templow !== null) {
      outLow = parseFloat(weatherAttrs.templow);
      if (Number.isNaN(outLow)) outLow = 18;
    } else {
      outLow = outHigh - 8;
    }

    const hour = new Date().getHours();
    const isDay = hour >= 8 && hour < 22;
    const empfMax = isDay ? outHigh - 10 : outLow + 5;
    const roomMax = roomMaxCfg;

    const rawRatio = empfMax > roomMax ? (1 - (traw - roomMax) / (empfMax - roomMax)) * 0.5 : 0;
    const bonus = Math.max(Math.min(rawRatio, 0.5), 0);
    const tFinal = Math.max(t - bonus, 0.75);

    const wavg = co2 * 0.3 + pm * 0.1 + rh * 0.3 + tFinal * 0.3;
    const worst = Math.max(co2, rh, tFinal);
    return Math.round((0.6 * worst + 0.4 * wavg) * 10) / 10;
  }

  _agoText(entityId) {
    const st = this._hass && this._hass.states[entityId];
    if (!st) return "";
    const diffMs = Date.now() - new Date(st.last_changed).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return "Gerade eben aktualisiert";
    if (min === 1) return "Aktualisiert vor 1 Min.";
    if (min < 60) return "Aktualisiert vor " + min + " Min.";
    const h = Math.floor(min / 60);
    if (h === 1) return "Aktualisiert vor 1 Std.";
    return "Aktualisiert vor " + h + " Std.";
  }

  // Nutzt vorab berechnete Winkel-Tabelle (_cosA/_sinA) statt Math.cos/sin je Frame
  _wavePath(base, phase) {
    const cx = 110, cy = 110;
    const R = this._r;
    const N = this._N;
    const cosA = this._cosA, sinA = this._sinA, ang = this._angles;
    let d = "";
    for (let i = 0; i <= N; i++) {
      const a = ang[i];
      const rr = base
        + R.a1 * Math.sin(3 * a + phase + R.h1)
        + R.a2 * Math.sin(5 * a + 1.3 * phase + R.h2)
        + R.a3 * Math.sin(7 * a - 0.7 * phase + R.h3);
      const x = (cx + rr * cosA[i]).toFixed(1);
      const y = (cy + rr * sinA[i]).toFixed(1);
      d += (i === 0 ? "M" : "L") + x + " " + y + " ";
    }
    return d + "Z";
  }

  _tick(ts) {
    if (this._paths) {
      const pm = ts * this._r.spdMain + this._r.offMain;
      const pe = ts * this._r.spdEcho + this._r.offEcho;
      this._paths.main.setAttribute("d", this._wavePath(this._paths.baseMain, pm));
      this._paths.echo.setAttribute("d", this._wavePath(this._paths.baseEcho, pe));
    }
    if (this._visible) {
      this._raf = window.requestAnimationFrame(this._tickBound);
    } else {
      this._raf = null;
    }
  }

  _render() {
    if (!this._hass || !this._config) return;

    const paletteMode = this._isDarkMode() ? "dark" : "light";
    const palette = this._config.glass_effect
      ? { ...CARD_PALETTES[paletteMode], ...GLASS_OVERRIDES[paletteMode] }
      : CARD_PALETTES[paletteMode];

    const required = ["temp_entity", "humidity_entity", "co2_entity", "pm25_entity"];
    const missing = required.filter((k) => !this._config[k]);
    if (missing.length) {
      this.shadowRoot.innerHTML = `
        <style>
          ha-card { padding:16px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
          .hint { color:${palette.hintColor}; font-size:14px; }
        </style>
        <ha-card>
          <div class="hint">Luftqualität Karte: Bitte im Karten-Editor die Sensoren zuweisen (${missing.join(", ")} fehlt).</div>
        </ha-card>
      `;
      return;
    }

    // Plausibilitätsprüfung: nur Sensoren mit passender Einheit/device_class akzeptieren.
    // Ohne diese Prüfung würde ein falsch zugewiesener Sensor eine unsinnige Note erzeugen,
    // ohne dass es für den Nutzer erkennbar wäre.
    const problems = validateAirQualityConfig(this._hass, this._config);
    if (problems.length) {
      this.shadowRoot.innerHTML = `
        <style>
          ha-card { padding:16px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
          .hint { color:#ef5350; font-size:14px; margin-bottom:6px; }
          .problem { color:${palette.problemColor}; font-size:12px; }
        </style>
        <ha-card>
          <div class="hint">Luftqualität Karte: ungültige Sensor-Zuweisung</div>
          ${problems.map((p) => `<div class="problem">${p}</div>`).join("")}
        </ha-card>
      `;
      return;
    }

    // grade_entity ist optional: wenn gesetzt, wird der (Legacy-)Helfer verwendet,
    // andernfalls berechnet die Karte die Note selbst (siehe _computeGrade).
    const grade = this._config.grade_entity ? this._num(this._config.grade_entity) : this._computeGrade();
    const temp = this._num(this._config.temp_entity);
    const hum = this._num(this._config.humidity_entity);
    const co2 = this._num(this._config.co2_entity);
    const pm25 = this._num(this._config.pm25_entity);

    const rgb = grade === null ? [120, 130, 145] : this._gradeColor(grade);
    const r = rgb[0], g = rgb[1], b = rgb[2];
    const dr = Math.max(r-30,0), dg = Math.max(g-30,0), db = Math.max(b-30,0);
    const gradeLabel = grade === null ? "–" : this._gradeLabel(grade);
    const gradeText = this._fmt(grade, 1);

    const tempUnit = this._unit(this._config.temp_entity, "°C");
    const co2Unit = this._unit(this._config.co2_entity, "ppm");
    const pm25Unit = this._unit(this._config.pm25_entity, "µg/m³");

    const tStat = this._tempStatus(temp);
    const cStat = this._co2Status(co2);
    const hStat = this._humidityStatus(hum);
    // Status/Farbe folgen dem 24h-Mittelwert (wie die Note), nicht dem Momentanwert:
    // sonst würde eine kurze Spitze (Kochen etc.) die Kachel "Schlecht" färben, obwohl
    // der WHO-relevante 24h-Trend "Mäßig" oder besser ist - genau der Widerspruch, den
    // die Mittelwert-Note eigentlich auflösen soll. Die Zahl selbst bleibt der Momentanwert.
    const pStat = this._pm25Status(this._pmAverageOrCurrent(this._config.pm25_entity));

    const roomName = this._config.name || "Raum";
    const agoText = this._agoText(this._config.grade_entity || this._config.temp_entity);

    const gid = grade === null ? "x" : Math.round(grade * 10);
    const baseMain = 90, baseEcho = 94;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card {
          display:block;
          zoom:0.9;
          background:${palette.cardBg};
          border-radius:20px;
          padding:18px;
          font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
          box-shadow:${palette.cardShadow};
          border:${palette.cardBorder};
          -webkit-backdrop-filter:${palette.cardBackdropFilter};
          backdrop-filter:${palette.cardBackdropFilter};
        }
        .room-title{ text-align:center; color:${palette.title}; font-size:21px; font-weight:600; margin-bottom:6px; }
        .grade-wrap{ display:flex; justify-content:center; margin-bottom:18px; padding-top:4px; }
        .grade-outer{
          position:relative; width:206px; height:206px;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer;
        }
        .grade-outer:active{ transform:scale(0.98); }
        .blob-svg{ position:absolute; inset:0; width:100%; height:100%; overflow:visible; will-change:contents; }
        .blob-main{ filter:drop-shadow(0 4px 12px rgba(0,0,0,0.30)); }
        .blob-echo{ opacity:0.20; }
        .grade-text{
          position:relative; z-index:2;
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          pointer-events:none;
        }
        .grade-value{ font-size:54px; font-weight:700; color:#fff; line-height:1; text-shadow:0 2px 6px rgba(0,0,0,0.25); }
        .grade-label{ font-size:15px; font-weight:500; color:rgba(255,255,255,0.95); margin-top:6px; }
        .metrics{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .metric{
          display:flex; align-items:center; gap:10px;
          background:${palette.metricBg}; border-radius:14px; padding:12px;
          cursor:pointer;
          transition:background 0.15s ease, transform 0.15s ease;
          min-width:0;
          -webkit-backdrop-filter:${palette.metricBackdropFilter || "none"};
          backdrop-filter:${palette.metricBackdropFilter || "none"};
        }
        .metric:hover{ background:${palette.metricHoverBg}; }
        .metric:active{ transform:scale(0.98); }
        .m-icon{ flex:0 0 auto; width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
        .m-icon ha-icon{ --mdc-icon-size:22px; }
        .m-info{ min-width:0; overflow:hidden; }
        .m-label{ font-size:11px; color:${palette.label}; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .m-value{ font-size:17px; font-weight:700; color:${palette.value}; white-space:nowrap; }
        .m-value .unit{ font-size:11px; font-weight:400; color:${palette.unit}; margin-left:2px; }
        .m-status{ font-size:11px; font-weight:500; margin-top:2px; }
        .footer{ margin-top:16px; text-align:center; color:${palette.footer}; font-size:12px; }
      </style>
      <ha-card>
        <div class="room-title">${roomName}</div>
        <div class="grade-wrap">
          <div class="grade-outer"${this._config.grade_entity ? ` data-entity="${this._config.grade_entity}"` : ""} role="button" tabindex="0" aria-label="Verlauf Luftqualitätsnote öffnen">
            <svg class="blob-svg" viewBox="0 0 220 220">
              <defs>
                <radialGradient id="grad-${gid}" cx="38%" cy="32%" r="72%">
                  <stop offset="0%" stop-color="rgb(${r},${g},${b})"/>
                  <stop offset="100%" stop-color="rgb(${dr},${dg},${db})"/>
                </radialGradient>
              </defs>
              <path class="blob-echo" fill="rgb(${r},${g},${b})" d="${this._wavePath(baseEcho, this._r.offEcho)}"></path>
              <path class="blob-main" fill="url(#grad-${gid})" d="${this._wavePath(baseMain, this._r.offMain)}"></path>
            </svg>
            <div class="grade-text">
              <div class="grade-value">${gradeText}</div>
              <div class="grade-label">${gradeLabel}</div>
            </div>
          </div>
        </div>
        <div class="metrics">
          <div class="metric" data-entity="${this._config.temp_entity}" role="button" tabindex="0" aria-label="Verlauf Temperatur öffnen">
            <div class="m-icon" style="background:rgba(102,187,106,0.15); color:#66bb6a;">
              <ha-icon icon="mdi:thermometer"></ha-icon>
            </div>
            <div class="m-info">
              <div class="m-label">Temperatur</div>
              <div class="m-value">${this._fmt(temp, 1)}<span class="unit">${tempUnit}</span></div>
              <div class="m-status" style="color:${tStat.color}">${tStat.text}</div>
            </div>
          </div>
          <div class="metric" data-entity="${this._config.co2_entity}" role="button" tabindex="0" aria-label="Verlauf CO₂ öffnen">
            <div class="m-icon" style="background:rgba(102,187,106,0.15); color:#66bb6a;">
              <ha-icon icon="mdi:molecule-co2"></ha-icon>
            </div>
            <div class="m-info">
              <div class="m-label">CO₂</div>
              <div class="m-value">${this._fmt(co2, 0)}<span class="unit">${co2Unit}</span></div>
              <div class="m-status" style="color:${cStat.color}">${cStat.text}</div>
            </div>
          </div>
          <div class="metric" data-entity="${this._config.humidity_entity}" role="button" tabindex="0" aria-label="Verlauf Luftfeuchtigkeit öffnen">
            <div class="m-icon" style="background:rgba(79,195,247,0.15); color:#4fc3f7;">
              <ha-icon icon="mdi:water-outline"></ha-icon>
            </div>
            <div class="m-info">
              <div class="m-label">Luftfeuchtigkeit</div>
              <div class="m-value">${this._fmt(hum, 0)}<span class="unit">%</span></div>
              <div class="m-status" style="color:${hStat.color}">${hStat.text}</div>
            </div>
          </div>
          <div class="metric" data-entity="${this._config.pm25_entity}" role="button" tabindex="0" aria-label="Verlauf PM2.5 öffnen" title="Zahl = aktueller Momentanwert. Status/Farbe basieren wie die Note auf einem ${Number.isFinite(this._config.pm25_avg_window) ? this._config.pm25_avg_window : 1440}-Minuten-Mittelwert (WHO-Richtwerte sind als 24h-Mittelwert definiert).">
            <div class="m-icon" style="background:rgba(186,104,200,0.15); color:#ba68c8;">
              <ha-icon icon="mdi:dots-grid"></ha-icon>
            </div>
            <div class="m-info">
              <div class="m-label">PM2.5</div>
              <div class="m-value">${this._fmt(pm25, 1)}<span class="unit">${pm25Unit}</span></div>
              <div class="m-status" style="color:${pStat.color}">${pStat.text}</div>
            </div>
          </div>
        </div>
        <div class="footer">${agoText}</div>
      </ha-card>
    `;

    this._paths = {
      main: this.shadowRoot.querySelector(".blob-main"),
      echo: this.shadowRoot.querySelector(".blob-echo"),
      baseMain: baseMain,
      baseEcho: baseEcho
    };

    this.shadowRoot.querySelectorAll("[data-entity]").forEach((el) => {
      const open = () => this._openMoreInfo(el.getAttribute("data-entity"));
      el.addEventListener("click", open);
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          open();
        }
      });
    });
  }
}

if (!customElements.get("luftqualitaet-card")) {
  customElements.define("luftqualitaet-card", LuftqualitaetCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "luftqualitaet-card",
  name: "Luftqualität Karte",
  description: "Zeigt Note, Temperatur, Luftfeuchtigkeit, CO2 und PM2.5 eines Raums an."
});

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
