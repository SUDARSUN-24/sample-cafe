#!/usr/bin/env node
/* tools/tests/screens.mjs — screenshots for visual review.
     node tools/tests/screens.mjs                      (needs: node tools/serve.mjs running)
     node tools/tests/screens.mjs --lang en --widths 390 --out shots-en
     node tools/tests/screens.mjs --reduced            (prefers-reduced-motion)
   For each width it saves a full-page picture plus one picture per section
   (at 2x pixel density, to judge Thai text rendering), and prints any console
   errors or Content-Security-Policy violations it saw.                    */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { launch, arg, BASE } from "./_browser.mjs";

const out = path.resolve(arg("out", "shots"));
const widths = arg("widths", "360,390,768,1440").split(",").map(Number);
const lang = arg("lang", "th");
const reduced = process.argv.includes("--reduced");
const heights = { 360: 780, 390: 844, 768: 1024, 1440: 900 };
fs.mkdirSync(out, { recursive: true });

const browser = await launch();
let problems = 0;
for (const width of widths) {
  const mobile = width < 768;
  const ctx = await browser.newContext({
    viewport: { width, height: heights[width] || 900 },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile, hasTouch: mobile,
    reducedMotion: reduced ? "reduce" : "no-preference",
    locale: lang === "en" ? "en-US" : "th-TH",
    timezoneId: "Asia/Bangkok",
  });
  await ctx.addInitScript((l) => {
    try { localStorage.setItem("shop-lang", l); } catch (e) {}
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  }, lang);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("requestfailed", (r) => errors.push("requestfailed: " + r.url()));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600); // let the hero reveal finish
  const tag = `${width}-${lang}${reduced ? "-rm" : ""}`;
  await page.screenshot({ path: path.join(out, `${tag}-0-hero.png`) });
  // Scroll down step by step so every reveal animation and lazy image triggers.
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 500) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(110);
  }
  await page.waitForTimeout(1200);
  for (const id of ["find", "signature", "menu", "story", "gallery", "reviews", "contact"]) {
    const el = page.locator("#" + id);
    if (!(await el.count()) || !(await el.isVisible())) continue;
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await el.screenshot({ path: path.join(out, `${tag}-${id}.png`) });
  }
  await page.locator(".site-footer").screenshot({ path: path.join(out, `${tag}-z-footer.png`) });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `${tag}-full.png`), fullPage: true, scale: "css" });
  const csp = await page.evaluate(() => window.__csp);
  const all = [...errors, ...csp.map((c) => "CSP: " + c)];
  problems += all.length;
  console.log(`${tag}: ${all.length ? all.join("\n   ") : "no console errors, no CSP violations"}`);
  await ctx.close();
}
await browser.close();
console.log(`Screenshots in ${out}`);
process.exitCode = problems ? 1 : 0;
