#!/usr/bin/env node
/* =============================================================================
   tools/bake.mjs — copies the content of config.js into the static files.
   -----------------------------------------------------------------------------
   Run from the project folder after every change to config.js or photos:
       node tools/bake.mjs

   Why "bake"? The page could build itself in the browser from config.js, but:
     • LINE, Facebook and X link previews never run JavaScript,
     • Google ranks pages faster when the content is already in the HTML,
     • the hero photo starts downloading sooner (better LCP score),
     • the page is still readable if JavaScript fails.
   So we run the SAME templates (site/js/render.js) once here in Node, and
   save the result. No npm packages needed: only Node's built-in modules.

   Writes: site/index.html (between <!--render:x--> markers), site/404.html,
           site/css/shop.generated.css, site/site.webmanifest,
           site/robots.txt, site/sitemap.xml
   ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(ROOT, "site");
const read = (p) => fs.readFileSync(path.join(SITE, p), "utf8");
const write = (p, text) => {
  fs.writeFileSync(path.join(SITE, p), text);
  console.log("  ✓ " + p);
};

/* 1. Load the browser scripts into a sandbox that pretends to be a window. */
const sandbox = { console, Intl, Date, Math, JSON };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of ["config.js", "assets/img/manifest.js", "js/vendor/qrcode.js", "js/render.js", "js/hours.js"]) {
  if (!fs.existsSync(path.join(SITE, file))) {
    if (file.includes("manifest")) {
      console.warn("  ! assets/img/manifest.js missing — run `python tools/images.py` first. Photos will be blank.");
      continue;
    }
    throw new Error("Missing " + file);
  }
  vm.runInContext(read(file), sandbox, { filename: file });
}
const C = sandbox.SHOP_CONFIG;
const IMAGES = sandbox.SHOP_IMAGES || {};
const R = sandbox.ShopRender;

/* 2. Check the config for common mistakes before writing anything. */
const problems = [];
const warn = (msg) => problems.push(msg);
if (!C.themes[C.theme]) throw new Error(`config.theme is "${C.theme}" but there is no such theme in config.themes`);
if (!/^https:\/\/[^/]+/.test(C.site.url)) warn("site.url should start with https:// (used for canonical, OG image and sitemap)");
Object.keys(C.photos).forEach((name) => { if (!IMAGES[name]) warn(`photo "${name}" is in config.photos but was not processed — run python tools/images.py`); });
const usedPhotos = [C.hero.photo, C.story.photo, ...C.signature.items.map((i) => i.photo), ...C.gallery.items.map((i) => i.photo),
  ...C.location.steps.map((s) => s.photo).filter(Boolean)];
usedPhotos.forEach((name) => { if (!C.photos[name]) warn(`photo "${name}" is used but missing from config.photos (needs alt text)`); });
Object.entries(C.hours.weekly).forEach(([day, ranges]) => ranges.forEach((r) => {
  if (!/^\d{2}:\d{2}$/.test(r[0]) || !/^\d{2}:\d{2}$/.test(r[1])) warn(`hours.weekly.${day}: use "HH:MM" times, got ${JSON.stringify(r)}`);
}));
const seoTitle = R.both(C.seo.title);
if (seoTitle.en.length > 65) warn(`seo.title.en is ${seoTitle.en.length} characters; Google shows about 60`);
if (C.reviews && C.reviews.isSample === false && C.reviews.items.some((r) => /sample|ตัวอย่าง/i.test(JSON.stringify(r)))) {
  warn("reviews.isSample is false, but some reviews still look like sample text. Only publish real reviews.");
}
if (C.site.demoNotice) warn("site.demoNotice is on (the footer says the site is a demo). Turn it off for a real shop.");

/* 3. index.html: replace the content between each pair of markers. */
const buildId = R.buildId(C, IMAGES);
function fill(html, name, content) {
  const re = new RegExp(`(<!--render:${name}-->)[\\s\\S]*?(<!--/render:${name}-->)`);
  if (!re.test(html)) throw new Error(`marker <!--render:${name}--> not found`);
  return html.replace(re, (_, open, close) => `${open}${content}${close}`);
}
let index = read("index.html");
index = fill(index, "head", "\n" + R.head(C) + "\n");
for (const name of Object.keys(R.sections)) {
  if (index.includes(`<!--render:${name}-->`)) index = fill(index, name, R.sections[name](C));
}
// A section with no content (e.g. no reviews) is hidden.
index = index.replace(/(<section[^>]*data-render="(\w+)"[^>]*?)( hidden)?>/g, (m, start, name) =>
  R.sections[name] && !R.sections[name](C) ? `${start} hidden>` : `${start}>`);
index = index.replace(/<html lang="[a-z]+" data-build="[^"]*">/, `<html lang="${C.site.defaultLang || "th"}" data-build="${buildId}">`);
write("index.html", index);

/* 4. Theme colors + photo placeholders. */
write("css/shop.generated.css", R.themeCss(C));

/* 5. 404 page (served by Netlify for any unknown address). Uses /absolute
      paths because it can appear at any URL depth, e.g. /old/page.     */
const S = R.strings(C);
const t = R.t;
const name = R.both(C.business.name);
const page404 = `<!doctype html>
<!-- Generated by tools/bake.mjs from config.js — edit config.js, then run the bake again. -->
<html lang="${C.site.defaultLang || "th"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>ไม่พบหน้านี้ · Page not found — ${R.esc(name.th)}</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="${R.esc(C.themes[C.theme].dark)}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="preload" href="/assets/fonts/noto-serif-thai-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/styles.css">
<link rel="stylesheet" href="/css/shop.generated.css">
<link rel="stylesheet" href="/css/404.css">
<script src="/js/boot.js"></script>
</head>
<body class="nf">
<main class="nf__main">
  <div class="nf__cup" aria-hidden="true">
    <span class="nf__steam"></span><span class="nf__steam"></span><span class="nf__steam"></span>
    <svg viewBox="0 0 120 100" class="nf__cup-svg"><path d="M14 30h76v22c0 22-17 38-38 38S14 74 14 52V30z" /><path d="M90 38h6a12 12 0 0 1 0 24h-8" fill="none" stroke-width="7" /><ellipse cx="52" cy="30" rx="38" ry="6" class="nf__coffee" /></svg>
  </div>
  <p class="nf__code">404</p>
  <h1 class="nf__title">${t({ th: "หลงทางนิดหน่อย", en: "A little lost?" })}</h1>
  <p class="nf__text">${t({ th: "ไม่พบหน้าที่คุณกำลังหา แต่ร้านเรายังอยู่ที่เดิม และกาแฟยังร้อนอยู่", en: "We couldn't find that page — but the cafe is right where it always was, and the coffee is still hot." })}</p>
  <div class="nf__actions">
    <a class="btn btn--light btn--lg" href="/">${t({ th: "กลับหน้าแรก", en: "Back to the homepage" })}</a>
    <a class="btn btn--glass btn--lg" href="/#find">${t(S.findEyebrow)}</a>
  </div>
  <p class="nf__brand">${t(C.business.name)}</p>
</main>
</body>
</html>
`;
write("404.html", page404);

/* 6. Web app manifest (icon + name when "added to home screen"). */
const theme = C.themes[C.theme];
write("site.webmanifest", JSON.stringify({
  name: name.th, short_name: name.en.length <= 12 ? name.en : name.th.slice(0, 12),
  lang: C.site.defaultLang || "th", start_url: "/", display: "browser",
  background_color: theme.bg, theme_color: theme.dark,
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}, null, 2) + "\n");

/* 7. robots.txt + sitemap.xml (one page, so the sitemap has one URL). */
const base = C.site.url.replace(/\/$/, "");
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><lastmod>${today}</lastmod></url>
</urlset>
`);

/* 8. Guard the Content-Security-Policy: inline scripts/styles would be blocked. */
const inlineScript = /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/i.test(index);
const inlineStyle = /\sstyle=["']/i.test(index) || /<style[\s>]/i.test(index);
if (inlineScript) warn("index.html contains an inline <script>: the CSP in netlify.toml will block it");
if (inlineStyle) warn("index.html contains inline styles: the CSP in netlify.toml will block them");

console.log(`\nBaked "${name.en}" (build ${buildId}).`);
if (problems.length) {
  console.log("\nPlease check:");
  problems.forEach((p) => console.log("  • " + p));
}
