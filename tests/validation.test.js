"use strict";
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { createCardDom, makeState, makeHass, baseConfig } = require("./support.js");

describe("validateAirQualityConfig (blockierend, siehe _render)", () => {
  test("gibt keine Probleme für korrekt zugewiesene Sensoren zurück", () => {
    const { test: t } = createCardDom();
    const hass = makeHass({
      "sensor.temp": makeState(21, { device_class: "temperature" }),
      "sensor.hum": makeState(50, { device_class: "humidity" }),
      "sensor.co2": makeState(500, { device_class: "carbon_dioxide" }),
      "sensor.pm25": makeState(5, { device_class: "pm25" }),
    });
    const problems = t.validateAirQualityConfig(hass, baseConfig());
    assert.equal(problems.length, 0);
  });

  test("meldet einen vertauschten Sensor (falsche device_class)", () => {
    const { test: t } = createCardDom();
    const hass = makeHass({
      // Temperatursensor faelschlich als CO2-Sensor zugewiesen
      "sensor.temp": makeState(21, { device_class: "temperature", unit_of_measurement: "°C" }),
      "sensor.hum": makeState(50, { device_class: "humidity" }),
      "sensor.co2": makeState(21, { device_class: "temperature", unit_of_measurement: "°C" }),
      "sensor.pm25": makeState(5, { device_class: "pm25" }),
    });
    const problems = t.validateAirQualityConfig(hass, baseConfig());
    assert.equal(problems.length, 1);
    assert.match(problems[0], /CO₂-Sensor/);
  });

  test("akzeptiert Sensoren ohne device_class, wenn die Einheit passt", () => {
    const { test: t } = createCardDom();
    const hass = makeHass({
      "sensor.temp": makeState(21, { unit_of_measurement: "°C" }),
      "sensor.hum": makeState(50, { unit_of_measurement: "%" }),
      "sensor.co2": makeState(500, { unit_of_measurement: "ppm" }),
      "sensor.pm25": makeState(5, { unit_of_measurement: "µg/m³" }),
    });
    const problems = t.validateAirQualityConfig(hass, baseConfig());
    assert.equal(problems.length, 0);
  });

  test("meldet eine nicht existierende Entität", () => {
    const { test: t } = createCardDom();
    const hass = makeHass({});
    const problems = t.validateAirQualityConfig(hass, baseConfig());
    assert.equal(problems.length, 4);
    assert.ok(problems.every((p) => p.includes("nicht gefunden")));
  });

  test("leere/undefinierte config oder hass liefert keine Probleme (kein Crash)", () => {
    const { test: t } = createCardDom();
    assert.equal(t.validateAirQualityConfig(null, baseConfig()).length, 0);
    assert.equal(t.validateAirQualityConfig(makeHass({}), null).length, 0);
  });
});

describe("validateWeatherEntity (nur beratend, nicht blockierend)", () => {
  test("leere weather_entity liefert keine Warnung", () => {
    const { test: t } = createCardDom();
    const problems = t.validateWeatherEntity(makeHass({}), baseConfig({ weather_entity: "" }));
    assert.equal(problems.length, 0);
  });

  test("nicht existierende weather_entity liefert eine Warnung", () => {
    const { test: t } = createCardDom();
    const problems = t.validateWeatherEntity(
      makeHass({}),
      baseConfig({ weather_entity: "weather.forecast_home" })
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0], /nicht gefunden/);
  });

  test("Entity aus falscher Domain liefert eine Warnung", () => {
    const { test: t } = createCardDom();
    const hass = makeHass({ "sensor.not_weather": makeState(1) });
    const problems = t.validateWeatherEntity(
      hass,
      baseConfig({ weather_entity: "sensor.not_weather" })
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0], /keine weather-Entität/);
  });

  test("gültige weather-Entity liefert keine Warnung", () => {
    const { test: t } = createCardDom();
    const hass = makeHass({ "weather.forecast_home": makeState("sunny") });
    const problems = t.validateWeatherEntity(
      hass,
      baseConfig({ weather_entity: "weather.forecast_home" })
    );
    assert.equal(problems.length, 0);
  });
});
