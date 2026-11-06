#!/usr/bin/env node
/* tools/tests/audit.mjs — Lighthouse scores + axe accessibility scan.
     node tools/serve.mjs          (in another terminal)
     node tools/tests/audit.mjs    (add --runs 5 for a steadier median)
   Lighthouse runs on its "mobile" preset: a mid-range phone on slow 4G
   (simulated). Local numbers are an estimate: re-test the live site with
   https://pagespeed.web.dev after deploying.                              */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { launch, BASE, CHROME, arg } from "./_browser.mjs";

const runs = Number(arg("runs", 3));
const require = createRequire(import.meta.url);
const findPkg = (name, file) => {
  const dirs = [path.resolve("tools/node_modules"), path.resolve("node_modules"), ...(process.env.NODE_PATH || "").split(path.delimiter)];
  for (const d of dirs) if (d && fs.existsSync(path.join(d, name, file))) return path.join(d, name, file);
  throw new Error(`Cannot find ${name}. Run: cd tools && npm install`);
};

/* ------------------------------------------------------------ Lighthouse */
const cli = findPkg("lighthouse", "cli/index.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lh-"));
const scores = [];
for (let i = 0; i < runs; i++) {
  const out = path.join(tmp, `run${i}.json`);
  execFileSync(process.execPath, [cli, BASE, "--quiet", "--output=json", `--output-path=${out}`,
    `--chrome-path=${CHROME}`, "--chrome-flags=--headless=new --no-first-run"], { stdio: "inherit" });
  const r = JSON.parse(fs.readFileSync(out, "utf8"));
  const c = r.categories;
  const a = r.audits;
  scores.push({
    perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100),
    bp: Math.round(c["best-practices"].score * 100), seo: Math.round(c.seo.score * 100),
    lcp: a["largest-contentful-paint"].numericValue, cls: a["cumulative-layout-shift"].numericValue,
    fcp: a["first-contentful-paint"].numericValue, tbt: a["total-blocking-time"].numericValue,
    lcpEl: a["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node?.snippet || "",
    failing: Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== "informative" && x.scoreDisplayMode !== "notApplicable" && x.scoreDisplayMode !== "manual")
      .map((x) => `${x.id} (${x.displayValue || x.score})`),
  });
  if (i === runs - 1) fs.copyFileSync(out, path.resolve(arg("report", path.join(tmp, "last.json"))));
}
const median = (key) => scores.map((s) => s[key]).sort((x, y) => x - y)[Math.floor(scores.length / 2)];
console.log("\nLighthouse (mobile, simulated slow 4G), median of", runs, "runs");
console.log(`  Performance ${median("perf")}  Accessibility ${median("a11y")}  Best Practices ${median("bp")}  SEO ${median("seo")}`);
console.log(`  LCP ${(median("lcp") / 1000).toFixed(2)} s   FCP ${(median("fcp") / 1000).toFixed(2)} s   CLS ${median("cls").toFixed(3)}   TBT ${Math.round(median("tbt"))} ms`);
console.log("  LCP element:", scores[0].lcpEl);
const failing = [...new Set(scores.flatMap((s) => s.failing))];
console.log(failing.length ? "  Audits below 90: " + failing.join(", ") : "  No audits below 90.");

/* ------------------------------------------------------------------- axe */
const axeSource = fs.readFileSync(findPkg("axe-core", "axe.min.js"), "utf8");
const browser = await launch();
let violations = 0;
for (const [width, lang] of [[390, "th"], [390, "en"], [1440, "th"], [1440, "en"]]) {
  // bypassCSP only so the test can inject axe; the site itself keeps its strict CSP.
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, bypassCSP: true, reducedMotion: "reduce" });
  await ctx.addInitScript((l) => localStorage.setItem("shop-lang", l), lang);
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  // Reveal everything (as if the visitor had scrolled) so axe checks final colors.
  await page.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("is-in")));
  await page.waitForTimeout(500);
  await page.addScriptTag({ content: axeSource });
  const res = await page.evaluate(() => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }));
  violations += res.violations.length;
  console.log(`\naxe ${width}px ${lang}: ${res.violations.length} violations, ${res.passes.length} rules passed`);
  res.violations.forEach((v) => console.log(`  ✗ ${v.id} (${v.impact}): ${v.help}\n     ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`));
  await ctx.close();
}
await browser.close();
process.exitCode = violations ? 1 : 0;
