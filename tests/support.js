"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const CARD_SOURCE = fs.readFileSync(
  path.join(__dirname, "..", "dist", "airquality-card.js"),
  "utf8"
);

// Bridge, appended as a second classic <script> in the same document: top-level
// const/function declarations in a classic (non-module) script are NOT attached to
// `window`, but they ARE visible to later classic scripts sharing the same document's
// global lexical scope (exactly how real browsers behave). This exposes the pure
// helper functions/objects the tests need without adding module.exports to
// dist/airquality-card.js - the shipped file stays a plain browser-loadable script,
// loaded by HA/HACS exactly as-is, no build step, no test-only code paths.
const BRIDGE_SOURCE = `
  window.__test__ = {
    CARD_PALETTES,
    GLASS_OVERRIDES,
    AIR_QUALITY_ENTITY_RULES,
    validateAirQualityConfig,
    validateAirQualityEntity,
    validateWeatherEntity
  };
`;

// jsdom implements neither matchMedia; the card calls it in the constructor
// (prefers-color-scheme/prefers-reduced-motion) and subscribes to it in
// connectedCallback. A minimal stub keeps card instantiation from throwing.
function installMatchMediaStub(window) {
  window.matchMedia = window.matchMedia || function matchMedia(query) {
    return {
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    };
  };
}

/**
 * Loads dist/airquality-card.js into a fresh jsdom window (as a real browser would via
 * a Lovelace resource <script>) and returns { window, document, test } where `test`
 * exposes the module-scope helpers registered by BRIDGE_SOURCE.
 */
function createCardDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "dangerously",
    url: "http://localhost/",
  });
  installMatchMediaStub(dom.window);

  const runScript = (code) => {
    const scriptEl = dom.window.document.createElement("script");
    scriptEl.textContent = code;
    dom.window.document.body.appendChild(scriptEl);
  };

  runScript(CARD_SOURCE);
  runScript(BRIDGE_SOURCE);

  return { dom, window: dom.window, document: dom.window.document, test: dom.window.__test__ };
}

/** A HA entity state object, as found under hass.states[entity_id]. */
function makeState(state, attributes = {}, overrides = {}) {
  return {
    state: state === null || state === undefined ? state : String(state),
    attributes,
    last_changed: overrides.last_changed || new Date().toISOString(),
    last_updated: overrides.last_updated || new Date().toISOString(),
  };
}

/** A minimal fake `hass` object covering the surface the card reads. */
function makeHass(states = {}, overrides = {}) {
  return {
    states,
    entities: overrides.entities || {},
    devices: overrides.devices || {},
    areas: overrides.areas || {},
    callApi: overrides.callApi,
  };
}

/** A ready-to-use set of states for a "healthy room" scenario (good on every metric). */
function goodRoomStates() {
  return {
    "sensor.temp": makeState(21, { device_class: "temperature", unit_of_measurement: "°C" }),
    "sensor.hum": makeState(50, { device_class: "humidity", unit_of_measurement: "%" }),
    "sensor.co2": makeState(420, { device_class: "carbon_dioxide", unit_of_measurement: "ppm" }),
    "sensor.pm25": makeState(1, { device_class: "pm25", unit_of_measurement: "µg/m³" }),
  };
}

/** A ready-to-use config referencing goodRoomStates(), no averaging/weather dependency. */
function baseConfig(overrides = {}) {
  return {
    name: "Testraum",
    temp_entity: "sensor.temp",
    humidity_entity: "sensor.hum",
    co2_entity: "sensor.co2",
    pm25_entity: "sensor.pm25",
    weather_entity: "",
    temp_target: 21,
    temp_tolerance: 1,
    room_max: 22,
    theme_mode: "dark",
    pm25_avg_window: 1440,
    glass_effect: false,
    ...overrides,
  };
}

module.exports = { createCardDom, makeState, makeHass, goodRoomStates, baseConfig };
