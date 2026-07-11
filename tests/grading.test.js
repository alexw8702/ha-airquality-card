"use strict";
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { createCardDom } = require("./support.js");

// Die Norm-Funktionen (_co2Norm, _pmNorm, _rhNorm, _tempNorm) sind Prototyp-Methoden -
// eine Karteninstanz reicht, hass/config werden dafür nicht gebraucht.
function newCard() {
  const { window } = createCardDom();
  const Ctor = window.customElements.get("luftqualitaet-card");
  return new Ctor();
}

describe("_co2Norm (UBA-Leitwerte 800/1000/1400/2000 ppm)", () => {
  test("Hintergrundniveau (<=420) ist bestmögliche Note", () => {
    const card = newCard();
    assert.equal(card._co2Norm(420), 0.75);
    assert.equal(card._co2Norm(0), 0.75);
  });

  test("ist stetig an allen Bandgrenzen", () => {
    const card = newCard();
    for (const boundary of [800, 1000, 1400]) {
      const below = card._co2Norm(boundary - 0.001);
      const at = card._co2Norm(boundary);
      assert.ok(Math.abs(below - at) < 0.01, `Sprung bei ${boundary}: ${below} vs ${at}`);
    }
  });

  test("liegt bei >=2000 ppm auf dem Maximum (5)", () => {
    const card = newCard();
    assert.equal(card._co2Norm(2000), 5);
    assert.equal(card._co2Norm(5000), 5);
  });
});

describe("_pmNorm (WHO 2021: Jahresmittel 5, 24h-Mittel 15 µg/m³)", () => {
  test("nahe Null (Zielwert ~1) ist bestmögliche Note", () => {
    const card = newCard();
    assert.equal(card._pmNorm(1), 0.75);
    assert.equal(card._pmNorm(0), 0.75);
  });

  test("WHO-Jahresmittel (5 µg/m³) markiert den Übergang zu 'mäßig'", () => {
    const card = newCard();
    assert.equal(card._pmNorm(5), 1.5);
  });

  test("WHO-24h-Mittel (15 µg/m³) markiert den nächsten Schwellenwert", () => {
    const card = newCard();
    assert.equal(card._pmNorm(15), 2.5);
  });

  test("ist stetig an den Bandgrenzen 5/15/25", () => {
    const card = newCard();
    for (const boundary of [5, 15, 25]) {
      const below = card._pmNorm(boundary - 0.001);
      const at = card._pmNorm(boundary);
      assert.ok(Math.abs(below - at) < 0.01, `Sprung bei ${boundary}: ${below} vs ${at}`);
    }
  });

  test("liegt bei >50 µg/m³ auf dem Maximum (5)", () => {
    const card = newCard();
    assert.equal(card._pmNorm(51), 5);
  });
});

describe("_rhNorm (Zielwert 50%, symmetrisch)", () => {
  test("50% ist bestmögliche Note", () => {
    const card = newCard();
    assert.equal(card._rhNorm(50), 0.75);
  });

  test("ist symmetrisch um den Zielwert", () => {
    const card = newCard();
    assert.equal(card._rhNorm(40), card._rhNorm(60));
    assert.equal(card._rhNorm(20), card._rhNorm(80));
  });

  test("extreme Werte (0% oder 100%) erreichen das Maximum", () => {
    const card = newCard();
    assert.equal(card._rhNorm(0), 5);
    assert.equal(card._rhNorm(100), 5);
  });
});

describe("_tempNorm (konfigurierbarer Zielwert/Toleranz)", () => {
  test("am Zielwert ist die Note bestmöglich", () => {
    const card = newCard();
    assert.equal(card._tempNorm(21, 21, 1), 0.75);
  });

  test("ist symmetrisch um den Zielwert", () => {
    const card = newCard();
    assert.equal(card._tempNorm(19, 21, 1), card._tempNorm(23, 21, 1));
  });

  test("Toleranz 0 erzeugt keine Division durch 0 / NaN", () => {
    const card = newCard();
    const atTarget = card._tempNorm(21, 21, 0);
    const offTarget = card._tempNorm(22, 21, 0);
    assert.ok(Number.isFinite(atTarget), `atTarget war ${atTarget}`);
    assert.ok(Number.isFinite(offTarget), `offTarget war ${offTarget}`);
    assert.equal(atTarget, 0.75);
  });

  test("negative/fehlerhafte Toleranz führt trotzdem zu einem endlichen Ergebnis", () => {
    const card = newCard();
    const result = card._tempNorm(25, 21, -1);
    assert.ok(Number.isFinite(result));
  });

  test("unterschiedliche Ziel-/Toleranzwerte je Raum liefern unterschiedliche Bewertungen", () => {
    const card = newCard();
    // Schlafzimmer-typisch: 17.5°C Ziel, 1.5°C Toleranz (siehe README/Bedroom-Autofill)
    const bedroom = card._tempNorm(21, 17.5, 1.5);
    const livingRoom = card._tempNorm(21, 21, 1);
    assert.ok(bedroom > livingRoom, "21°C sollte im Schlafzimmer schlechter bewertet werden als im Wohnzimmer");
  });
});
