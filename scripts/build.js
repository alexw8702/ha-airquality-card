// Build: concatenates src/ modules into dist/airquality-card.js.
//
// Deliberately NOT a bundler. Every src/ module is a plain classic-script
// fragment (top-level const/function/class, no import/export), and the output
// is the same kind of plain, browser-loadable classic script HA/HACS has
// always loaded — identical to when the card was maintained as one file.
// Zero dependencies, zero transformation: read files, join with blank lines,
// write. Usage: npm run build (or: node scripts/build.js)
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "dist", "airquality-card.js");

// Explicit order: styles in the order they were introduced (classic first —
// the default palette every other style is a counterpart to). Card + editor
// come last since they reference the consts above them. New style: add the
// file under src/styles/ AND list it here (the drift check below catches
// forgetting either side).
const MODULES = [
  "defaults.js",
  "validation.js",
  "styles/classic.js",
  "styles/nordic.js",
  "styles/brutalism.js",
  "styles/editorial.js",
  "styles/neumorphic.js",
  "styles/swiss.js",
  "styles/cyberpunk.js",
  "styles/japandi.js",
  "styles/arcade.js",
  "styles/metal.js",
  "styles/glass-aurora.js",
  "styles/de-stijl.js",
  "styles/bauhaus.js",
  "styles/solar.js",
  "styles/clay.js",
  "styles/organic.js",
  "styles/vapor.js",
  "styles/monolith.js",
  "card.js",
  "editor.js",
];

// Fail loudly on drift between this list and the src/ tree, in both directions:
// a module on disk that isn't listed here would silently not ship.
const onDisk = [];
for (const dirent of fs.readdirSync(SRC, { recursive: true, withFileTypes: true })) {
  if (dirent.isFile() && dirent.name.endsWith(".js")) {
    onDisk.push(
      path.relative(SRC, path.join(dirent.parentPath, dirent.name)).split(path.sep).join("/")
    );
  }
}
const missing = MODULES.filter((m) => !onDisk.includes(m));
const unlisted = onDisk.filter((m) => !MODULES.includes(m));
if (missing.length) throw new Error(`Listed in build.js but not on disk: ${missing.join(", ")}`);
if (unlisted.length) throw new Error(`On disk but not listed in build.js: ${unlisted.join(", ")}`);

const parts = MODULES.map((m) =>
  fs.readFileSync(path.join(SRC, m), "utf8").replace(/\s+$/, "")
);
fs.writeFileSync(OUT, parts.join("\n\n") + "\n");

// Sanity check: output must parse as a script.
new (require("node:vm").Script)(fs.readFileSync(OUT, "utf8"), { filename: OUT });
console.log(`dist/airquality-card.js gebaut (${MODULES.length} Module).`);
