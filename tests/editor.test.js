"use strict";
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { createCardDom, makeState, makeHass, baseConfig } = require("./support.js");

function newEditor(hass) {
  const { window } = createCardDom();
  const Ctor = window.customElements.get("luftqualitaet-card-editor");
  const editor = new Ctor();
  editor._hass = hass;
  return editor;
}

// Ein Gerät, das alle vier Sensortypen im selben Raum liefert (Entity-Registry-Eintrag +
// zugehöriger State mit passender device_class - siehe _findAreaEntityMatches).
function fullDeviceHass(areaId, deviceId, prefix) {
  const entities = {
    [`sensor.${prefix}_temp`]: { device_id: deviceId, area_id: null },
    [`sensor.${prefix}_hum`]: { device_id: deviceId, area_id: null },
    [`sensor.${prefix}_co2`]: { device_id: deviceId, area_id: null },
    [`sensor.${prefix}_pm25`]: { device_id: deviceId, area_id: null },
  };
  const states = {
    [`sensor.${prefix}_temp`]: makeState(21, { device_class: "temperature" }),
    [`sensor.${prefix}_hum`]: makeState(50, { device_class: "humidity" }),
    [`sensor.${prefix}_co2`]: makeState(420, { device_class: "carbon_dioxide" }),
    [`sensor.${prefix}_pm25`]: makeState(1, { device_class: "pm25" }),
  };
  return { entities, states, devices: { [deviceId]: { area_id: areaId } } };
}

describe("_findAreaEntityMatches (Geräte-Gruppierung)", () => {
  test("findet alle vier Sensoren, wenn ein Gerät sie komplett liefert", () => {
    const { entities, states, devices } = fullDeviceHass("wohnzimmer", "device-1", "womi");
    const hass = makeHass(states, { entities, devices });
    const editor = newEditor(hass);

    const matches = editor._findAreaEntityMatches("wohnzimmer");
    assert.equal(matches.temp_entity, "sensor.womi_temp");
    assert.equal(matches.humidity_entity, "sensor.womi_hum");
    assert.equal(matches.co2_entity, "sensor.womi_co2");
    assert.equal(matches.pm25_entity, "sensor.womi_pm25");
  });

  test("liefert nichts, wenn Sensoren über zwei unterschiedliche Geräte verteilt sind", () => {
    // Zwei separate CO2-Sensoren an zwei Geräten - keines liefert alle vier Typen.
    const entities = {
      "sensor.geraet_a_temp": { device_id: "a", area_id: null },
      "sensor.geraet_a_hum": { device_id: "a", area_id: null },
      "sensor.geraet_b_co2": { device_id: "b", area_id: null },
      "sensor.geraet_b_pm25": { device_id: "b", area_id: null },
    };
    const states = {
      "sensor.geraet_a_temp": makeState(21, { device_class: "temperature" }),
      "sensor.geraet_a_hum": makeState(50, { device_class: "humidity" }),
      "sensor.geraet_b_co2": makeState(420, { device_class: "carbon_dioxide" }),
      "sensor.geraet_b_pm25": makeState(1, { device_class: "pm25" }),
    };
    const devices = { a: { area_id: "raum" }, b: { area_id: "raum" } };
    const hass = makeHass(states, { entities, devices });
    const editor = newEditor(hass);

    const matches = editor._findAreaEntityMatches("raum");
    assert.equal(matches.temp_entity, null);
    assert.equal(matches.co2_entity, null);
  });

  test("ignoriert Entitäten ohne device_id", () => {
    const entities = { "sensor.orphan_temp": { device_id: null, area_id: "raum" } };
    const states = { "sensor.orphan_temp": makeState(21, { device_class: "temperature" }) };
    const hass = makeHass(states, { entities });
    const editor = newEditor(hass);

    const matches = editor._findAreaEntityMatches("raum");
    assert.equal(matches.temp_entity, null);
  });

  test("gibt leere Matches zurück, wenn hass.entities fehlt (ältere HA-Version)", () => {
    const hass = makeHass({}); // kein entities-Feld
    const editor = newEditor(hass);
    const matches = editor._findAreaEntityMatches("raum");
    assert.equal(matches.temp_entity, null);
    assert.equal(matches.humidity_entity, null);
  });
});

describe("_areaDerivedValues (Schlafzimmer-Erkennung)", () => {
  test("erkennt 'Schlafzimmer' und leitet 18°C (WHO-Minimum) ab", () => {
    const { entities, states, devices } = fullDeviceHass("bed1", "d1", "sz");
    const hass = makeHass(states, {
      entities, devices, areas: { bed1: { name: "Schlafzimmer" } },
    });
    const editor = newEditor(hass);
    const derived = editor._areaDerivedValues("bed1");
    assert.equal(derived.temp_target, 18);
  });

  test("erkennt englisches 'Bedroom' ebenso", () => {
    const { entities, states, devices } = fullDeviceHass("bed1", "d1", "sz");
    const hass = makeHass(states, {
      entities, devices, areas: { bed1: { name: "Guest Bedroom" } },
    });
    const editor = newEditor(hass);
    assert.equal(editor._areaDerivedValues("bed1").temp_target, 18);
  });

  test("leitet für Nicht-Schlafzimmer keinen temp_target ab", () => {
    const { entities, states, devices } = fullDeviceHass("lr1", "d1", "wz");
    const hass = makeHass(states, {
      entities, devices, areas: { lr1: { name: "Wohnzimmer" } },
    });
    const editor = newEditor(hass);
    assert.equal(editor._areaDerivedValues("lr1").temp_target, null);
  });
});

describe("_applyAreaAutofill (nicht-destruktives Vorbefüllen)", () => {
  test("befüllt Name und Sensoren einer leeren Config", () => {
    const { entities, states, devices } = fullDeviceHass("wohnzimmer", "device-1", "womi");
    const hass = makeHass(states, {
      entities, devices, areas: { wohnzimmer: { name: "Wohnzimmer" } },
    });
    const editor = newEditor(hass);
    const config = { name: "", temp_entity: "", humidity_entity: "", co2_entity: "", pm25_entity: "", temp_target: 21 };

    editor._applyAreaAutofill(config, "wohnzimmer");

    assert.equal(config.name, "Wohnzimmer");
    assert.equal(config.temp_entity, "sensor.womi_temp");
    assert.equal(config.pm25_entity, "sensor.womi_pm25");
  });

  test("überschreibt manuell gesetzte Felder nicht", () => {
    const { entities, states, devices } = fullDeviceHass("wohnzimmer", "device-1", "womi");
    const hass = makeHass(states, {
      entities, devices, areas: { wohnzimmer: { name: "Wohnzimmer" } },
    });
    const editor = newEditor(hass);
    const config = {
      name: "Mein eigener Name", // manuell gesetzt
      temp_entity: "", humidity_entity: "", co2_entity: "", pm25_entity: "",
      temp_target: 21,
    };

    editor._applyAreaAutofill(config, "wohnzimmer");

    assert.equal(config.name, "Mein eigener Name", "manuell gesetzter Name darf nicht überschrieben werden");
    assert.equal(config.temp_entity, "sensor.womi_temp", "leeres Feld wird trotzdem befüllt");
  });

  test("setzt temp_target bei Schlafzimmer-Erkennung auf 18°C, wenn noch beim generischen Default", () => {
    const { entities, states, devices } = fullDeviceHass("bed1", "d1", "sz");
    const hass = makeHass(states, {
      entities, devices, areas: { bed1: { name: "Schlafzimmer" } },
    });
    const editor = newEditor(hass);
    const config = {
      name: "", temp_entity: "", humidity_entity: "", co2_entity: "", pm25_entity: "",
      temp_target: 21, // generischer Default, noch nie manuell verändert
    };

    editor._applyAreaAutofill(config, "bed1");
    assert.equal(config.temp_target, 18);
  });

  test("überschreibt eine manuell abweichende Zieltemperatur im Schlafzimmer nicht", () => {
    const { entities, states, devices } = fullDeviceHass("bed1", "d1", "sz");
    const hass = makeHass(states, {
      entities, devices, areas: { bed1: { name: "Schlafzimmer" } },
    });
    const editor = newEditor(hass);
    const config = {
      name: "", temp_entity: "", humidity_entity: "", co2_entity: "", pm25_entity: "",
      temp_target: 19.5, // Nutzer hat bereits einen eigenen Wert gesetzt
    };

    editor._applyAreaAutofill(config, "bed1");
    assert.equal(config.temp_target, 19.5);
  });
});
