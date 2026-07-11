"use strict";
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { createCardDom, makeState, makeHass, baseConfig } = require("./support.js");

function newCardWith(config, hass) {
  const { window } = createCardDom();
  const Ctor = window.customElements.get("luftqualitaet-card");
  const card = new Ctor();
  card.setConfig(config);
  card._hass = hass;
  return card;
}

// history/period liefert je Entity ein Array von Zustands-Objekten - die Karte liest nur
// .state (siehe _ensurePmAverage), keine weiteren Felder nötig für den Test-Fake.
function historyResponseFor(values) {
  return [values.map((v) => ({ state: String(v) }))];
}

describe("_ensurePmAverage / _pmAverageOrCurrent (gleitender 24h-Mittelwert, siehe README)", () => {
  test("berechnet den Mittelwert aus der HA-History und cached ihn synchron beim nächsten Aufruf", async () => {
    let callCount = 0;
    const hass = makeHass(
      { "sensor.pm25": makeState(50, { device_class: "pm25" }) },
      {
        callApi: async (method, path) => {
          callCount += 1;
          assert.equal(method, "GET");
          assert.match(path, /^history\/period\//);
          assert.match(path, /filter_entity_id=sensor\.pm25/);
          return historyResponseFor([10, 20, 30]);
        },
      }
    );
    const card = newCardWith(baseConfig(), hass);

    // Erster Aufruf: Cache leer, Fetch wird angestoßen (asynchron) - Rückgabe ist bis dahin
    // der Momentanwert (50), erst nach Abschluss des Promises steht der Mittelwert bereit.
    const firstResult = card._pmAverageOrCurrent("sensor.pm25");
    assert.equal(firstResult, 50, "vor Abschluss des Fetches muss der Momentanwert genutzt werden");

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0)); // Promise-Chain vollständig abarbeiten

    const secondResult = card._pmAverageOrCurrent("sensor.pm25");
    assert.equal(secondResult, 20, "Mittelwert aus [10,20,30] muss 20 sein");
    assert.equal(callCount, 1, "ein zweiter Aufruf innerhalb des Cache-Fensters darf nicht erneut fetchen");
  });

  test("fällt bei fehlendem callApi (kein History-Zugriff) auf den Momentanwert zurück", () => {
    const hass = makeHass({ "sensor.pm25": makeState(18, { device_class: "pm25" }) });
    // hass.callApi ist absichtlich nicht gesetzt (typeof !== "function")
    const card = newCardWith(baseConfig(), hass);
    assert.equal(card._pmAverageOrCurrent("sensor.pm25"), 18);
  });

  test("fällt bei einem abgelehnten History-Request auf den Momentanwert zurück, ohne zu werfen", async () => {
    const hass = makeHass(
      { "sensor.pm25": makeState(7, { device_class: "pm25" }) },
      { callApi: async () => { throw new Error("Recorder deaktiviert"); } }
    );
    const card = newCardWith(baseConfig(), hass);

    assert.doesNotThrow(() => card._pmAverageOrCurrent("sensor.pm25"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(card._pmAverageOrCurrent("sensor.pm25"), 7);
  });

  test("übergibt das konfigurierte pm25_avg_window als Zeitfenster an die History-Abfrage", async () => {
    let capturedPath = null;
    const hass = makeHass(
      { "sensor.pm25": makeState(5, { device_class: "pm25" }) },
      {
        callApi: async (method, path) => {
          capturedPath = path;
          return historyResponseFor([5]);
        },
      }
    );
    const card = newCardWith(baseConfig({ pm25_avg_window: 60 }), hass);
    card._pmAverageOrCurrent("sensor.pm25");
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.ok(capturedPath, "callApi wurde nicht aufgerufen");
    const startIso = capturedPath.match(/history\/period\/([^?]+)/)[1];
    const minutesAgo = (Date.now() - new Date(decodeURIComponent(startIso)).getTime()) / 60000;
    assert.ok(Math.abs(minutesAgo - 60) < 1, `Startzeit war ${minutesAgo} Minuten in der Vergangenheit, erwartet ~60`);
  });

  test("nicht-numerische/leere History-Einträge werden beim Mittelwert ignoriert", async () => {
    const hass = makeHass(
      { "sensor.pm25": makeState(5, { device_class: "pm25" }) },
      { callApi: async () => historyResponseFor(["unknown", "unavailable", 10, 30]) }
    );
    const card = newCardWith(baseConfig(), hass);
    card._pmAverageOrCurrent("sensor.pm25");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(card._pmAverageOrCurrent("sensor.pm25"), 20); // Mittelwert aus [10, 30]
  });

  test("leere History (keine Datenpunkte im Fenster) fällt auf den Momentanwert zurück", async () => {
    const hass = makeHass(
      { "sensor.pm25": makeState(12, { device_class: "pm25" }) },
      { callApi: async () => historyResponseFor([]) }
    );
    const card = newCardWith(baseConfig(), hass);
    card._pmAverageOrCurrent("sensor.pm25");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(card._pmAverageOrCurrent("sensor.pm25"), 12);
  });
});
