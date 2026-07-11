"use strict";
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { createCardDom, makeState, makeHass, goodRoomStates, baseConfig } = require("./support.js");

function mountCard(config, hass) {
  const { document } = createCardDom();
  // Bewusst NICHT an document.body angehängt: connectedCallback() startet einen
  // 60s-Timer + IntersectionObserver für die Blob-Animation, die den Testprozess offen
  // halten würden. shadowRoot/_render() funktionieren auch ohne DOM-Anschluss, da sie
  // nur setConfig()/den hass-Setter brauchen, keine Lifecycle-Callbacks.
  const card = document.createElement("luftqualitaet-card");
  card.setConfig(config);
  card.hass = hass; // ruft den hass-Setter auf, der _render() anstößt
  return card;
}

describe("_render: Hinweis-/Fehlerpfade", () => {
  test("fehlende Pflichtfelder zeigen einen Hinweis statt eines Fehlers", () => {
    const card = mountCard(baseConfig({ temp_entity: "", co2_entity: "" }), makeHass(goodRoomStates()));
    const hint = card.shadowRoot.querySelector(".hint");
    assert.ok(hint, "kein .hint-Element gefunden");
    assert.match(hint.textContent, /temp_entity/);
    assert.match(hint.textContent, /co2_entity/);
    assert.equal(card.shadowRoot.querySelector(".room-title"), null, "Hauptkarte darf nicht rendern");
  });

  test("falsch zugewiesene Sensoren zeigen eine Fehlermeldung statt einer Note", () => {
    const hass = makeHass({
      // Alle vier zeigen auf denselben (Temperatur-)Sensor -> co2/hum/pm25 sind falsch
      "sensor.temp": makeState(21, { device_class: "temperature" }),
    });
    const card = mountCard(
      baseConfig({
        humidity_entity: "sensor.temp",
        co2_entity: "sensor.temp",
        pm25_entity: "sensor.temp",
      }),
      hass
    );
    const hint = card.shadowRoot.querySelector(".hint");
    assert.ok(hint, "kein .hint-Element gefunden");
    assert.match(hint.textContent, /ungültige Sensor-Zuweisung/);
    assert.ok(card.shadowRoot.querySelectorAll(".problem").length > 0);
  });
});

describe("_render: Hauptkarte", () => {
  test("zeigt Raumname, Note und alle vier Metrik-Kacheln", () => {
    const card = mountCard(baseConfig({ name: "Wohnzimmer" }), makeHass(goodRoomStates()));

    assert.equal(card.shadowRoot.querySelector(".room-title").textContent, "Wohnzimmer");
    assert.ok(card.shadowRoot.querySelector(".grade-value").textContent.length > 0);

    const labels = [...card.shadowRoot.querySelectorAll(".m-label")].map((el) => el.textContent);
    assert.deepEqual(labels, ["Temperatur", "CO₂", "Luftfeuchtigkeit", "PM2.5"]);
  });

  test("fehlender Name fällt auf 'Raum' zurück", () => {
    const card = mountCard(baseConfig({ name: "" }), makeHass(goodRoomStates()));
    assert.equal(card.shadowRoot.querySelector(".room-title").textContent, "Raum");
  });

  test("Note-Blob ist nur klickbar (data-entity), wenn grade_entity gesetzt ist", () => {
    const withoutOverride = mountCard(baseConfig(), makeHass(goodRoomStates()));
    const gradeOuterNoOverride = withoutOverride.shadowRoot.querySelector(".grade-outer");
    assert.equal(gradeOuterNoOverride.getAttribute("data-entity"), null);

    const states = goodRoomStates();
    states["sensor.legacy_grade"] = makeState(2.5);
    const withOverride = mountCard(baseConfig({ grade_entity: "sensor.legacy_grade" }), makeHass(states));
    const gradeOuterWithOverride = withOverride.shadowRoot.querySelector(".grade-outer");
    assert.equal(gradeOuterWithOverride.getAttribute("data-entity"), "sensor.legacy_grade");
  });

  test("Klick auf eine Metrik-Kachel feuert ein hass-more-info-Event mit der richtigen Entity", () => {
    const card = mountCard(baseConfig(), makeHass(goodRoomStates()));
    const tempTile = card.shadowRoot.querySelector('[data-entity="sensor.temp"]');
    assert.ok(tempTile);

    let receivedDetail = null;
    card.addEventListener("hass-more-info", (ev) => { receivedDetail = ev.detail; });
    tempTile.click();

    assert.equal(receivedDetail.entityId, "sensor.temp");
  });

  test("PM2.5-Tooltip nennt das konfigurierte Mittelungsfenster", () => {
    const card = mountCard(baseConfig({ pm25_avg_window: 720 }), makeHass(goodRoomStates()));
    const pmTile = card.shadowRoot.querySelector('[data-entity="sensor.pm25"]');
    assert.match(pmTile.getAttribute("title"), /720-Minuten-Mittelwert/);
  });
});

describe("_render: Darstellung (theme_mode / glass_effect)", () => {
  test("dark und light erzeugen unterschiedliche Hintergrundfarben", () => {
    const dark = mountCard(baseConfig({ theme_mode: "dark" }), makeHass(goodRoomStates()));
    const light = mountCard(baseConfig({ theme_mode: "light" }), makeHass(goodRoomStates()));

    const darkCss = dark.shadowRoot.querySelector("style").textContent;
    const lightCss = light.shadowRoot.querySelector("style").textContent;

    assert.match(darkCss, /#12151c/);
    assert.match(lightCss, /#f2f3f5/);
    assert.notEqual(darkCss, lightCss);
  });

  test("glass_effect=false rendert keinen backdrop-filter", () => {
    const card = mountCard(baseConfig({ theme_mode: "dark", glass_effect: false }), makeHass(goodRoomStates()));
    const css = card.shadowRoot.querySelector("style").textContent;
    assert.match(css, /backdrop-filter:none/);
  });

  test("glass_effect=true rendert einen blur-backdrop-filter und transparenten Hintergrund", () => {
    const card = mountCard(baseConfig({ theme_mode: "dark", glass_effect: true }), makeHass(goodRoomStates()));
    const css = card.shadowRoot.querySelector("style").textContent;
    assert.match(css, /backdrop-filter:blur\(20px\)/);
    assert.match(css, /rgba\(18, 21, 28, 0\.55\)/);
  });

  test("glass_effect wirkt in hell und dunkel unterschiedlich", () => {
    const darkGlass = mountCard(baseConfig({ theme_mode: "dark", glass_effect: true }), makeHass(goodRoomStates()));
    const lightGlass = mountCard(baseConfig({ theme_mode: "light", glass_effect: true }), makeHass(goodRoomStates()));

    const darkCss = darkGlass.shadowRoot.querySelector("style").textContent;
    const lightCss = lightGlass.shadowRoot.querySelector("style").textContent;
    assert.notEqual(darkCss, lightCss);
  });
});
