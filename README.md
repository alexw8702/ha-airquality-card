# Air Quality Card

Eine Custom Card für Home Assistant Lovelace, die die Raumluftqualität auf einen Blick zeigt: Gesamtnote (animierter Blob), Temperatur, Luftfeuchtigkeit, CO₂ und PM2.5 – mit farbcodiertem Status pro Metrik.

Ursprünglich als Inline-Dashboard-Ressource entwickelt und mehrfach (pro Raum eine Instanz) im Einsatz (Entwicklungsstufe 1, nie als eigenes Release veröffentlicht). Dieses Repo macht die Karte als eigenständiges HACS-Plugin installier- und versionierbar (Entwicklungsstufe 2 → erstes Release v0.2.0). Die Note wurde bisher von einem separaten UI-Template-Helfer berechnet – dieser wird bei einer HACS-Installation nicht mit übernommen, daher berechnet die Karte die Note selbst (siehe unten).

## Installation

### Über HACS
1. HACS → Frontend → Benutzerdefinierte Repositories → dieses Repo als Kategorie "Dashboard" hinzufügen.
2. "Air Quality Card" installieren.
3. Home Assistant neu laden.

### Manuell
1. `dist/airquality-card.js` nach `www/community/ha-airquality-card/` kopieren.
2. Als Lovelace-Ressource registrieren:
   ```yaml
   url: /hacsfiles/ha-airquality-card/airquality-card.js
   type: module
   ```

## Verwendung

Die Karte hat einen visuellen Editor: In Lovelace "Karte hinzufügen" → "Luftqualität Karte" auswählen. Zuerst den **Raum (Area)** auswählen – Name und passende Sensoren (per `device_class` erkannt) werden dann automatisch vorbelegt. Name und jeder einzelne Sensor lassen sich danach jederzeit manuell überschreiben; ein späterer Wechsel der Area überschreibt dann nur noch die Felder, die noch nicht manuell angepasst wurden. Kein YAML nötig. Pro Raum eine eigene Karteninstanz. Die Note wird automatisch aus den vier Sensorwerten berechnet – ein separater Helfer wird nicht benötigt.

Solange nicht alle Pflichtfelder gesetzt sind, zeigt die Karte einen Hinweis statt eines Fehlers an. Enthält der gewählte Raum keine passenden Sensoren (z. B. weil sie keine `device_class` gesetzt haben), erscheint dazu eine Warnung im Editor.

Alternativ per YAML:

```yaml
type: custom:luftqualitaet-card
name: Raum
temp_entity: sensor.raum_temperatur
humidity_entity: sensor.raum_luftfeuchtigkeit
co2_entity: sensor.raum_kohlendioxid
pm25_entity: sensor.raum_pm25
# optional, siehe unten:
weather_entity: weather.forecast_home
temp_target: 21
temp_tolerance: 1
room_max: 22
```

### Konfigurationsoptionen

| Option | Pflicht | Default | Beschreibung |
|---|---|---|---|
| `area_id` | nein | – | Home-Assistant-Raum; befüllt `name` und die Sensor-Felder automatisch vor (nur nicht bereits manuell gesetzte Felder) |
| `name` | nein | "Raum" | Anzeigename des Raums |
| `temp_entity` | ja | – | Temperatursensor |
| `humidity_entity` | ja | – | Luftfeuchtigkeitssensor |
| `co2_entity` | ja | – | CO₂-Sensor (ppm) |
| `pm25_entity` | ja | – | PM2.5-Sensor (µg/m³) |
| `grade_entity` | nein | – | Legacy-Override: Wenn gesetzt, wird die Note direkt aus diesem Sensor gelesen statt lokal berechnet (z. B. für Umstiegsphase vom alten Template-Helfer) |
| `weather_entity` | nein | `weather.forecast_home` | Wetter-Entity für die Außentemperatur-Korrektur der Temperatur-Bewertung |
| `temp_target` | nein | `21` | Ideale Raumtemperatur (°C) für diesen Raum |
| `temp_tolerance` | nein | `1` | Toleranzband (°C) um `temp_target`, innerhalb dessen die Temperatur als optimal gilt |
| `room_max` | nein | `22` | Obergrenze, ab der die Außentemperatur-Korrektur greift |

Ein Klick auf die Note (nur bei `grade_entity`) oder eine Metrik öffnet den Home-Assistant-Verlauf des jeweiligen Sensors.

### Plausibilitätsprüfung

Die Karte prüft `temp_entity`/`humidity_entity`/`co2_entity`/`pm25_entity` auf passende `device_class` bzw. Einheit (°C, %, ppm, µg/m³). Der visuelle Editor zeigt dazu passend nur Sensoren mit der jeweils erwarteten `device_class` zur Auswahl an; im Editor erscheinen zusätzlich Warnungen, falls eine Zuweisung (z. B. über YAML) trotzdem nicht passt. Passt einer dieser vier Sensoren nicht, zeigt die Karte selbst statt einer (dann unsinnigen) Note eine Fehlermeldung mit den betroffenen Entitäten an.

`weather_entity` wird davon bewusst ausgenommen: eine fehlende oder falsche Wetter-Entity blockiert die Karte nicht, da die Notenberechnung dafür automatisch auf Standardwerte zurückfällt (siehe unten) – im Editor erscheint dazu lediglich eine Warnung.

### Notenberechnung

Note 1 (sehr gut) bis 5 (schlecht), gewichtet aus CO₂ (30%), PM2.5 (10%), Luftfeuchtigkeit (30%) und Temperatur (30%), sowie dem jeweils schlechtesten Einzelwert (60% Gewicht auf dem Worst-Case, 40% auf dem gewichteten Durchschnitt). Die Temperaturbewertung erhält zusätzlich einen kleinen Bonus, wenn draußen (laut `weather_entity`) ohnehin kühler/wärmer ist, als tagsüber/nachts drinnen erwartet wird — portiert 1:1 aus dem ursprünglichen Template-Helfer.

Die Default-Werte (`temp_target: 21`, `room_max: 22`) eignen sich für die meisten Wohn-/Arbeitsräume; für Räume mit niedrigerer Zieltemperatur (z. B. Schlafräume) `temp_target`, `temp_tolerance` und `room_max` entsprechend anpassen.

## Changelog

### v0.2.1
- Area-Auswahl im Editor (`area_id`): befüllt Name und die vier Sensor-Felder automatisch anhand der `device_class` der Sensoren im gewählten Raum vor. Bereits manuell gesetzte Felder werden dabei nicht überschrieben; Name und Sensoren bleiben jederzeit frei überschreibbar. Benötigt HA ≥ 2024.8 (`hass.entities`/`hass.areas`), `hacs.json`-Mindestversion entsprechend angehoben.

### v0.2.0 (erstes Release)
- Erste eigenständige HACS-Version, portiert aus dem bestehenden Luftqualitäts-Dashboard (bisher nur als Inline-Dashboard-Ressource gepflegt) — Entwicklungsstufe 2.
- Notenberechnung direkt in die Karte portiert (CO₂-, PM2.5-, Feuchte- und Temperatur-Normierung inkl. Außentemperatur-Korrektur), da der bisherige UI-Template-Helfer bei einer HACS-Installation nicht mitkommt. `grade_entity` ist optional und dient nur noch als Legacy-Override.
- Visueller Karten-Editor (`getConfigElement`/`ha-form`): Sensoren werden per Dropdown im UI zugewiesen statt per YAML. `setConfig` ist tolerant gegenüber leeren Feldern (zeigt einen Hinweis statt eines Fehlers), damit die Karte im Editor-Flow beim Hinzufügen nicht crasht.
- Plausibilitätsprüfung für zugewiesene Sensoren (device_class/Einheit): Editor-Dropdowns sind auf die passende `device_class` eingeschränkt, zusätzlich Live-Warnungen im Editor und eine harte Fehlermeldung in der Karte bei nicht passender Zuweisung — verhindert eine unsinnige Note durch falsch zugewiesene Sensoren.
