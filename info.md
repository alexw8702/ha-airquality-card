# Air Quality Card

Eine Custom Card für Home Assistant Lovelace, die die Raumluftqualität auf einen Blick zeigt: Gesamtnote (animierter Blob), Temperatur, Luftfeuchtigkeit, CO₂ und PM2.5 – mit farbcodiertem Status pro Metrik. Die Note wird direkt in der Karte berechnet, kein separater Helfer nötig.

**Verwendung**

Karte über den visuellen Editor hinzufügen ("Karte hinzufügen" → "Luftqualität Karte") und die eigenen Sensoren per Dropdown zuweisen – kein YAML nötig. Pro Raum eine eigene Karteninstanz.

Ein Klick auf eine Metrik öffnet den Home-Assistant-Verlauf (`hass-more-info`). Details zur Notenberechnung und optionale Parameter (`weather_entity`, `temp_target`, `temp_tolerance`, `room_max`) siehe README.
