#!/usr/bin/env node
/* Single-file build: strip types from core.ts + ui.ts, inline into
 * dist/index.html. No npm dependencies. */

import { stripTypeScriptTypes } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL(".", import.meta.url).pathname;

function strip(file) {
  const js = stripTypeScriptTypes(readFileSync(ROOT + file, "utf8"), { mode: "strip" });
  return js.replace(/^import\s*{[\s\S]*?}\s*from\s*"\.\/[\w-]+\.ts";\n/m, "");
}

const coreJs = strip("src/core.ts");
let uiJs = strip("src/ui.ts");
uiJs = "// core.ts (inlined)\n" + coreJs + "\n" + uiJs;
uiJs = uiJs.replace(/^import\s*{[\s\S]*?}\s*from\s*"\.\/[\w-]+\.ts";\n/gm, "");

const template = readFileSync(ROOT + "index.template.html", "utf8");
const html = template.replace("/*__APP__*/", uiJs);

mkdirSync(ROOT + "dist", { recursive: true });
writeFileSync(ROOT + "dist/index.html", html);
console.log(`dist/index.html written (${html.length} bytes) — works offline`);
