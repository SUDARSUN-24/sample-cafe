#!/usr/bin/env node
/* tools/tests/contrast.mjs — checks every theme in config.js for readable text.
     node tools/tests/contrast.mjs
   WCAG AA needs 4.5:1 for normal text. Lighthouse only tests the active theme,
   so this script tests all of them. Each pair = text color on background color,
   exactly as the CSS uses them.                                             */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../site");
const box = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(SITE, "config.js"), "utf8"), box);
const C = box.window.SHOP_CONFIG;

const lum = (hex) => {
  const [r, g, b] = hex.replace("#", "").match(/../g).map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// [text, background, where it is used]
const PAIRS = [
  ["ink", "bg", "body text"], ["inkSoft", "bg", "secondary text"],
  ["ink", "bgAlt", "text in alt sections"], ["inkSoft", "bgAlt", "secondary text in alt sections / cards"],
  ["accent", "bg", "eyebrows, links"], ["accent", "bgAlt", "prices, eyebrows on alt sections"],
  ["ink", "sand", "sample-review note, map"], ["inkSoft", "sand", "map note"],
  ["accentInk", "accent", "primary buttons, today row, badges"],
  ["onDark", "dark", "story, footer"], ["onDarkSoft", "dark", "secondary text on dark"],
  ["ink", "onDark", "light buttons"], ["bg", "ink", "'new' badge, toast"],
];

let failed = 0;
for (const [name, theme] of Object.entries(C.themes)) {
  console.log(`\n${name}${name === C.theme ? " (active)" : ""}`);
  for (const [fg, bg, use] of PAIRS) {
    const r = ratio(theme[fg], theme[bg]);
    const ok = r >= 4.5;
    if (!ok) failed++;
    console.log(`  ${ok ? "✓" : "✗"} ${r.toFixed(2).padStart(5)}:1  ${fg} on ${bg}  — ${use}`);
  }
}
console.log(failed ? `\n${failed} pair(s) below 4.5:1 — darken the text or lighten the background.` : "\nAll themes pass WCAG AA (4.5:1).");
process.exitCode = failed ? 1 : 0;
