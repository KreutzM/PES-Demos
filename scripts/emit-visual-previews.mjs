import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Kleine JPEG-Previews aus dem öffentlichen Demo-Repository in den CI-Logs ausgeben.
 * Die vollständigen PNGs liegen als GitHub-Actions-Artefakt vor.
 * Das erleichtert die optische Prüfung auch ohne Browserzugriff auf den Actions-Run.
 */
const directory = "screenshots/previews";
if (!existsSync(directory)) {
  console.log("Keine Preview-Screenshots erzeugt.");
  process.exit(0);
}
for (const filename of readdirSync(directory).filter(name => name.endsWith(".jpg")).sort()) {
  // Browserbasierte, öffentliche Lern-App: keine personenbezogenen Daten oder Secrets.
  if (!/^(desktop|mobile)-(landing|timer-overview|clock-tree|prescaler-before-tick|prescaler-after-tick)\.jpg$/.test(filename)) continue;
  const encoded = readFileSync(join(directory, filename)).toString("base64");
  console.log("VISUAL_PREVIEW_START:" + filename);
  for (let i = 0; i < encoded.length; i += 800) {
    console.log("VISUAL_PREVIEW_CHUNK:" + encoded.slice(i, i + 800));
  }
  console.log("VISUAL_PREVIEW_END:" + filename + ":" + encoded.length);
}
