# Air Quality Card

Eine Custom Card für Home Assistant Lovelace, die die Raumluftqualität auf einen Blick zeigt: Gesamtnote (animierter Blob), Temperatur, Luftfeuchtigkeit, CO₂ und PM2.5 – mit farbcodiertem Status pro Metrik. Die Note wird direkt in der Karte berechnet (nach WHO-/UBA-Richtwerten), kein separater Helfer nötig.

**Verwendung**

Karte über den visuellen Editor hinzufügen ("Karte hinzufügen" → "Luftqualität Karte"). Zuerst einen **Raum (Area)** auswählen – Name und passende Sensoren werden dann automatisch vorbelegt; kein YAML nötig. Pro Raum eine eigene Karteninstanz.

**Weitere Features**
- **Hell/Dunkel-Darstellung**: folgt standardmäßig automatisch der Geräte-/Systemeinstellung, alternativ fest wählbar.
- **Sechs Design-Stile**: Klassisch (Original-Cyber-Blob), **Nordic Minimal** (skandinavisch), **Neo-Brutalism** (Retro), **Minimalist Editorial** (Paper), **Soft UI** (neumorphisch) und **Swiss Grid** (minimalistisches Raster). Alle voll in Light & Dark.
- **Glass-Effekt** (optional): halbtransparente Optik für Dashboards mit Hintergrundbild (funktioniert mit allen Stilen).
- **PM2.5-Note** basiert auf einem gleitenden 24h-Mittelwert (WHO-Methodik) statt Momentanspitzen; die Kachel selbst zeigt weiterhin den aktuellen Wert.

Ein Klick auf eine Metrik öffnet den Home-Assistant-Verlauf (`hass-more-info`). Details zur Notenberechnung, allen Konfigurationsoptionen und den zugrunde liegenden Quellen siehe README.
