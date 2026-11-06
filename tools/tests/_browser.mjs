/* Shared helpers for the test scripts: start Chrome with Playwright.
   Install once:  cd tools && npm install
   Uses the Chrome already installed on the computer (no 300 MB download).
   Set CHROME_PATH if Chrome lives somewhere else.                        */
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const { chromium } = require("playwright-core");
export const BASE = process.env.BASE_URL || "http://localhost:8080/";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
export const CHROME = CANDIDATES.find((p) => fs.existsSync(p));

export function launch() {
  if (!CHROME) throw new Error("Chrome not found. Set CHROME_PATH to chrome.exe");
  return chromium.launch({ executablePath: CHROME });
}

export function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i > -1 ? process.argv[i + 1] : fallback;
}
