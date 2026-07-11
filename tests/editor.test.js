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

// Zwei komplette, unterschiedliche Räume (jeweils ein Gerät mit allen vier Sensortypen),
// damit ein Area-Wechsel im Editor realistisch getestet werden kann.
function twoRoomHass() {
  const room1 = fullDeviceHass("wohnzimmer", "device-1", "womi");
  const room2 = fullDeviceHass("schlafzimmer", "device-2", "sz");
  return makeHass(
    { ...room1.states, ...room2.states },
    {
      entities: { ...room1.entities, ...room2.entities },
      devices: { ...room1.devices, ...room2.devices },
      areas: {
        wohnzimmer: { name: "Wohnzimmer" },
        schlafzimmer: { name: "Schlafzimmer" },
      },
    }
  );
}

// Mountet den Editor über den echten setConfig()/hass-Setter-Pfad, damit _render() den
// ha-form-Mock erzeugt und den value-changed-Listener anhängt - im Unterschied zu den
// Tests oben, die die internen Methoden direkt aufrufen, testet dies den tatsächlichen
// Event-Handler-Codepfad (siehe CLAUDE.md: das war die zuletzt unbedeckte Stelle).
function mountEditor(config, hass) {
  const { window, document } = createCardDom();
  const editor = document.createElement("luftqualitaet-card-editor");
  editor.setConfig(config);
  editor.hass = hass; // triggert _render(), das _form + Listener anlegt
  return { editor, window };
}

function dispatchValueChanged(editor, window, value) {
  editor._form.dispatchEvent(new window.CustomEvent("value-changed", { detail: { value } }));
}

describe("value-changed-Handler (Eviction-State-Machine, siehe _autofilledKeys)", () => {
  test("erzeugt beim Mounten ein _form-Element mit angehängtem value-changed-Listener", () => {
    const { editor } = mountEditor(baseConfig(), makeHass({}));
    assert.ok(editor._form, "_form wurde nicht erzeugt");
    assert.equal(editor._form.tagName.toLowerCase(), "ha-form");
  });

  test("manuelle Bearbeitung eines Felds ohne Area-Bezug wird 1:1 übernommen und als config-changed gemeldet", () => {
    const { editor, window } = mountEditor(baseConfig({ name: "Alt" }), makeHass({}));
    let receivedDetail = null;
    editor.addEventListener("config-changed", (ev) => { receivedDetail = ev.detail; });

    dispatchValueChanged(editor, window, { ...baseConfig(), name: "Neu" });

    assert.equal(editor._config.name, "Neu");
    assert.ok(receivedDetail, "config-changed wurde nicht ausgelöst");
    assert.equal(receivedDetail.config.name, "Neu");
  });

  test("config-changed-Event bubbelt und ist composed (verlässt den Editor-Scope)", () => {
    const { editor, window } = mountEditor(baseConfig(), makeHass({}));
    let event = null;
    editor.addEventListener("config-changed", (ev) => { event = ev; });

    dispatchValueChanged(editor, window, { ...baseConfig(), name: "X" });

    assert.equal(event.bubbles, true);
    assert.equal(event.composed, true);
  });

  test("Area-Auswahl befüllt leere Felder automatisch und merkt sie als autofilled", () => {
    const hass = twoRoomHass();
    const emptyConfig = {
      name: "", temp_entity: "", humidity_entity: "", co2_entity: "", pm25_entity: "",
      temp_target: 21, area_id: "",
    };
    const { editor, window } = mountEditor(emptyConfig, hass);

    dispatchValueChanged(editor, window, { ...emptyConfig, area_id: "wohnzimmer" });

    assert.equal(editor._config.name, "Wohnzimmer");
    assert.equal(editor._config.temp_entity, "sensor.womi_temp");
    assert.ok(editor._autofilledKeys.has("temp_entity"));
    assert.ok(editor._autofilledKeys.has("name"));
  });

  test("manuelle Bearbeitung eines automatisch befüllten Felds entfernt es aus dem Autofill-Tracking", () => {
    const hass = twoRoomHass();
    const emptyConfig = {
      name: "", temp_entity: "", humidity_entity: "", co2_entity: "", pm25_entity: "",
      temp_target: 21, area_id: "",
    };
    const { editor, window } = mountEditor(emptyConfig, hass);

    // 1) Area waehlen -> alle vier Sensorfelder + Name werden automatisch befuellt.
    dispatchValueChanged(editor, window, { ...emptyConfig, area_id: "wohnzimmer" });
    assert.ok(editor._autofilledKeys.has("temp_entity"));

    // 2) Nutzer aendert temp_entity manuell auf einen anderen Sensor (nicht den, den
    // die Area geliefert haette) - das darf das Tracking fuer dieses Feld beenden.
    const afterAreaSelect = { ...editor._config };
    dispatchValueChanged(editor, window, { ...afterAreaSelect, temp_entity: "sensor.manuell_gewaehlt" });

    assert.equal(editor._config.temp_entity, "sensor.manuell_gewaehlt");
    assert.ok(!editor._autofilledKeys.has("temp_entity"), "temp_entity haette aus dem Tracking entfernt werden muessen");
    assert.ok(editor._autofilledKeys.has("humidity_entity"), "andere Felder bleiben weiterhin automatisch verwaltet");
  });

  test("ein späterer Area-Wechsel überschreibt nur noch weiterhin automatisch verwaltete Felder", () => {
    const hass = twoRoomHass();
    const emptyConfig = {
      name: "", temp_entity: "", humidity_entity: "", co2_entity: "", pm25_entity: "",
      temp_target: 21, area_id: "",
    };
    const { editor, window } = mountEditor(emptyConfig, hass);

    // Wohnzimmer waehlen, dann temp_entity manuell ueberschreiben (siehe Test oben).
    dispatchValueChanged(editor, window, { ...emptyConfig, area_id: "wohnzimmer" });
    dispatchValueChanged(editor, window, { ...editor._config, temp_entity: "sensor.manuell_gewaehlt" });
    assert.equal(editor._config.temp_entity, "sensor.manuell_gewaehlt");

    // Jetzt auf Schlafzimmer wechseln: die manuell gesetzte temp_entity darf NICHT
    // überschrieben werden, humidity_entity (weiterhin autofilled) hingegen schon.
    dispatchValueChanged(editor, window, { ...editor._config, area_id: "schlafzimmer" });

    assert.equal(editor._config.temp_entity, "sensor.manuell_gewaehlt", "manuelle Auswahl darf nicht ueberschrieben werden");
    assert.equal(editor._config.humidity_entity, "sensor.sz_hum", "weiterhin autofilled -> wird auf den neuen Raum aktualisiert");
    assert.equal(editor._config.name, "Schlafzimmer");
  });

  test("_renderWarnings wird nach jedem value-changed neu ausgewertet", () => {
    const hass = makeHass({
      "sensor.temp": makeState(21, { device_class: "temperature" }),
      "sensor.hum": makeState(50, { device_class: "humidity" }),
      "sensor.co2": makeState(420, { device_class: "carbon_dioxide" }),
      "sensor.pm25": makeState(1, { device_class: "pm25" }),
      // Für den fehlerhaften Zustand: ein CO2-Sensor, faelschlich als Temperatur zugewiesen.
      "sensor.wrong": makeState(420, { device_class: "carbon_dioxide" }),
    });
    const validConfig = baseConfig({
      temp_entity: "sensor.temp", humidity_entity: "sensor.hum",
      co2_entity: "sensor.co2", pm25_entity: "sensor.pm25",
    });
    const { editor, window } = mountEditor(validConfig, hass);
    assert.equal(editor._warningsEl.innerHTML, "", "vor der fehlerhaften Zuweisung sollten keine Warnungen stehen");

    dispatchValueChanged(editor, window, { ...validConfig, temp_entity: "sensor.wrong" });

    assert.match(editor._warningsEl.innerHTML, /Temperatursensor/);
  });
});
