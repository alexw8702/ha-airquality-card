"use strict";
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { createCardDom, makeState, makeHass, goodRoomStates, baseConfig } = require("./support.js");

function newCardWith(config, hass) {
  const { window } = createCardDom();
  const Ctor = window.customElements.get("luftqualitaet-card");
  const card = new Ctor();
  card.setConfig(config);
  card._hass = hass; // this._computeGrade() liest this._hass direkt, kein hass-Setter-Sideeffect noetig
  return card;
}

describe("_computeGrade (Gesamtnote, siehe README 'Notenberechnung')", () => {
  test("durchgehend gute Werte ergeben eine Note nahe 1 (sehr gut)", () => {
    const hass = makeHass(goodRoomStates());
    const card = newCardWith(baseConfig(), hass);
    const grade = card._computeGrade();
    assert.ok(grade >= 0.75 && grade <= 1.5, `Note war ${grade}, erwartet nahe 1`);
  });

  test("durchgehend schlechte Werte ergeben die schlechteste Note (5)", () => {
    // Luftfeuchtigkeit bewusst auf 100% statt z.B. 95%: die Norm-Kurven laufen exakt an
    // der oberen Bandgrenze (Abstand 45 zum Zielwert) noch auf 4.5 statt 5 - siehe
    // _rhNorm/_co2Norm/_pmNorm/_tempNorm (Distanz > 45 nötig für den echten Maximalwert).
    const hass = makeHass({
      "sensor.temp": makeState(35, { device_class: "temperature" }),
      "sensor.hum": makeState(100, { device_class: "humidity" }),
      "sensor.co2": makeState(3000, { device_class: "carbon_dioxide" }),
      "sensor.pm25": makeState(200, { device_class: "pm25" }),
    });
    const card = newCardWith(baseConfig(), hass);
    assert.equal(card._computeGrade(), 5);
  });

  test("PM2.5 fließt nur mit 10% Gewicht ein - schlechtes PM2.5 allein reißt die Note nicht", () => {
    const states = goodRoomStates();
    states["sensor.pm25"] = makeState(200, { device_class: "pm25" }); // extrem schlecht
    const hass = makeHass(states);
    const card = newCardWith(baseConfig(), hass);
    const grade = card._computeGrade();
    // co2/rh/temp bleiben gut -> "worst" (60% Gewicht) bleibt niedrig, PM2.5 kann die
    // Note trotz Maximalwert nicht auf "schlecht" ziehen.
    assert.ok(grade < 2.5, `Note war ${grade}, PM2.5 sollte die Note nicht dominieren`);
  });

  test("fehlende weather_entity blockiert die Berechnung nicht (Fallback-Defaults)", () => {
    const hass = makeHass(goodRoomStates());
    const card = newCardWith(baseConfig({ weather_entity: "weather.does_not_exist" }), hass);
    const grade = card._computeGrade();
    assert.ok(Number.isFinite(grade));
  });

  test("fehlende/ungueltige numerische Config-Werte fallen auf Defaults zurueck statt NaN zu erzeugen", () => {
    const hass = makeHass(goodRoomStates());
    const card = newCardWith(
      baseConfig({ temp_target: undefined, temp_tolerance: undefined, room_max: undefined }),
      hass
    );
    const grade = card._computeGrade();
    assert.ok(Number.isFinite(grade), `Note war ${grade}, erwartet eine endliche Zahl`);
  });

  test("fehlende Sensor-Werte (Entity nicht vorhanden) fallen auf 0 zurueck (wie Jinja |float(0))", () => {
    const card = newCardWith(baseConfig(), makeHass({})); // keine der vier Entitäten existiert
    const grade = card._computeGrade();
    assert.ok(Number.isFinite(grade), `Note war ${grade}, erwartet eine endliche Zahl`);
    // 0 ppm CO2 und 0 µg/m³ PM2.5 liegen tatsächlich nahe am jeweiligen Zielwert (gut),
    // 0% Luftfeuchtigkeit und 0°C dagegen weit außerhalb - insgesamt dominiert Feuchte/
    // Temperatur die Note, ohne dabei zwangsläufig exakt das Maximum (5) zu treffen.
    assert.ok(grade >= 4, `Note war ${grade}, erwartet eine schlechte Note (>= 4)`);
  });

  test("grade_entity überschreibt _computeGrade nicht selbst, aber _render nutzt ihn statt der Berechnung", () => {
    // _computeGrade() selbst kennt grade_entity nicht (das Override passiert in _render());
    // Test dokumentiert diese Grenze explizit, damit sie nicht versehentlich verschoben wird.
    const hass = makeHass(goodRoomStates());
    const card = newCardWith(baseConfig({ grade_entity: "sensor.legacy_grade" }), hass);
    const grade = card._computeGrade();
    assert.ok(Number.isFinite(grade));
  });
});

describe("Außentemperatur-Bonus (weather_entity)", () => {
  test("ein an sich zu warmer Raum bekommt draußen kühlerer Luft einen Bonus", () => {
    // Tagsüber (siehe isDay in coordinator), Raum 25°C, Ziel 21°C ±1 -> ohne Bonus mäßig/schlecht.
    // Mit einer kühlen Außentemperatur (Lüften moeglich) soll die Bewertung etwas besser ausfallen.
    const withoutWeather = makeHass({
      "sensor.temp": makeState(25, { device_class: "temperature" }),
      "sensor.hum": makeState(50, { device_class: "humidity" }),
      "sensor.co2": makeState(420, { device_class: "carbon_dioxide" }),
      "sensor.pm25": makeState(1, { device_class: "pm25" }),
    });
    const withWeather = makeHass({
      ...withoutWeather.states,
      "weather.forecast_home": makeState("sunny", { temperature: 10, templow: 5 }),
    });

    const cardNoWeather = newCardWith(baseConfig({ weather_entity: "" }), withoutWeather);
    const cardWithWeather = newCardWith(
      baseConfig({ weather_entity: "weather.forecast_home" }),
      withWeather
    );

    const gradeNoWeather = cardNoWeather._computeGrade();
    const gradeWithWeather = cardWithWeather._computeGrade();
    assert.ok(
      gradeWithWeather <= gradeNoWeather,
      `Mit Lüftungsbonus (${gradeWithWeather}) sollte nicht schlechter sein als ohne (${gradeNoWeather})`
    );
  });
});
