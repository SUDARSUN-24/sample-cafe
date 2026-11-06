#!/usr/bin/env node
/* tools/tests/interactions.mjs — clicks through every interactive feature.
     node tools/serve.mjs          (in another terminal)
     node tools/tests/interactions.mjs
   Prints ✓ / ✗ for each check and exits with an error if anything failed.  */
import { launch, BASE } from "./_browser.mjs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? "  → " + detail : ""}`);
};
const browser = await launch();

async function newPage(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: "Asia/Bangkok", ...options });
  await ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + e.blockedURI));
  });
  const page = await ctx.newPage();
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") page.__errors.push(m.text()); });
  return { ctx, page };
}

/* ---------------------------------------------------- links and structure */
{
  const { ctx, page } = await newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  const links = await page.$$eval("a[href]", (as) => as.map((a) => ({
    href: a.getAttribute("href"), target: a.target, rel: a.rel, text: (a.textContent || a.getAttribute("aria-label") || "").trim(),
  })));
  const ids = await page.$$eval("[id]", (els) => els.map((e) => e.id));
  const badAnchors = links.filter((l) => l.href.startsWith("#") && l.href.length > 1 && !ids.includes(l.href.slice(1)));
  check(`all ${links.filter((l) => l.href.startsWith("#")).length} in-page links point to an existing section`, !badAnchors.length, JSON.stringify(badAnchors));
  const external = links.filter((l) => /^https?:/.test(l.href));
  check(`all ${external.length} external links open in a new tab with rel=noopener`,
    external.every((l) => l.target === "_blank" && l.rel.includes("noopener")), JSON.stringify(external.filter((l) => l.target !== "_blank")));
  const tel = links.filter((l) => l.href.startsWith("tel:"));
  check(`${tel.length} phone links use tel:+66… format`, tel.length > 0 && tel.every((l) => /^tel:\+\d{8,}$/.test(l.href)), JSON.stringify(tel));
  check("every link has text or a label", links.every((l) => l.text.length > 0), JSON.stringify(links.filter((l) => !l.text)));
  const directions = links.filter((l) => l.href.includes("google.com/maps/dir"));
  check(`directions buttons (${directions.length}) go to Google Maps with coordinates`, directions.length >= 3 && directions.every((l) => /destination=\d+\.\d+,\d+\.\d+/.test(l.href)));
  const line = links.filter((l) => l.href.startsWith("https://line.me/"));
  check(`LINE buttons (${line.length}) use the line.me link`, line.length >= 3);
  check("QR code is pre-rendered as SVG", await page.locator("[data-qr] svg path").count() === 1);
  check("JSON-LD is valid JSON with geo + openingHoursSpecification and no reviews", await page.evaluate(() => {
    const d = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
    return d.geo && d.openingHoursSpecification.length > 0 && !d.review && !d.aggregateRating && d.hasMenu;
  }));
  check("page was baked (no live re-render needed)", await page.evaluate(() =>
    document.documentElement.dataset.build === window.ShopRender.buildId(window.SHOP_CONFIG, window.SHOP_IMAGES)));
  check("only one <h1>", (await page.locator("h1").count()) === 1);
  await ctx.close();
}

/* ------------------------------------------------------- language toggle */
{
  const { ctx, page } = await newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  check("default language is Thai", (await page.getAttribute("html", "lang")) === "th");
  const thTitle = await page.title();
  await page.click('[data-set-lang="en"]');
  check("EN button switches <html lang> to en", (await page.getAttribute("html", "lang")) === "en");
  check("EN button is aria-pressed", (await page.getAttribute('[data-set-lang="en"]', "aria-pressed")) === "true");
  check("title changes to English", (await page.title()) !== thTitle && /Sample Cafe/.test(await page.title()));
  check("Thai text hidden, English shown", await page.evaluate(() =>
    getComputedStyle(document.querySelector('.hero__title [data-l="th"]')).display === "none" &&
    getComputedStyle(document.querySelector('.hero__title [data-l="en"]')).display !== "none"));
  check("image alt text switches to English", /barista/i.test(await page.getAttribute(".hero__picture img", "alt")));
  await page.reload({ waitUntil: "networkidle" });
  check("choice is remembered after reload", (await page.getAttribute("html", "lang")) === "en");
  await page.click('[data-set-lang="th"]');
  check("TH button switches back", (await page.getAttribute("html", "lang")) === "th");
  await ctx.close();
}

/* ------------------------------------------------------------ open status */
{
  // Friday 10:00 Bangkok = open; Wednesday = closed day; Tuesday 17:30 = closing soon
  const cases = [
    ["2026-11-06T10:00:00+07:00", "open", "เปิดอยู่ · ปิด 18:00 น."],
    ["2026-11-04T12:00:00+07:00", "closed", "ปิดอยู่ · เปิดพรุ่งนี้ 07:30 น."],
    ["2026-11-03T17:30:00+07:00", "closing-soon", "ใกล้ปิดแล้ว · ปิด 18:00 น."],
    ["2026-11-07T06:00:00+07:00", "closed", "ปิดอยู่ · เปิด 08:00 น."],
  ];
  for (const [time, state, text] of cases) {
    // Phone set to London time: the status must still use Bangkok time.
    const { ctx, page } = await newPage({ timezoneId: "Europe/London" });
    await page.clock.setFixedTime(new Date(time));
    await page.goto(BASE, { waitUntil: "networkidle" });
    const got = await page.evaluate(() => {
      const el = document.querySelector("[data-open-status]");
      return { state: el.dataset.state, text: el.querySelector('[data-l="th"]').textContent };
    });
    check(`status at ${time} (phone in London) = "${text}"`, got.state === state && got.text === text, JSON.stringify(got));
    if (time.startsWith("2026-11-04")) {
      check("hours table highlights Wednesday as today", (await page.getAttribute("tr.is-today", "data-day")) === "wed");
    }
    await ctx.close();
  }
}

/* --------------------------------------------------------------- menu tabs */
{
  const { ctx, page } = await newPage({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
  await page.goto(BASE, { waitUntil: "networkidle" });
  const visiblePanels = () => page.$$eval("[role=tabpanel]", (ps) => ps.filter((p) => !p.hidden).map((p) => p.id));
  check("one tab panel visible at start", JSON.stringify(await visiblePanels()) === '["panel-coffee"]');
  const before = await page.$eval(".tabs__indicator", (el) => el.style.transform);
  await page.click("#tab-bakery");
  check("clicking a tab shows its panel", JSON.stringify(await visiblePanels()) === '["panel-bakery"]');
  check("clicked tab is aria-selected", (await page.getAttribute("#tab-bakery", "aria-selected")) === "true");
  await page.waitForTimeout(600);
  check("underline moves to the new tab", (await page.$eval(".tabs__indicator", (el) => el.style.transform)) !== before);
  await page.focus("#tab-bakery");
  await page.keyboard.press("ArrowRight");
  check("ArrowRight moves to next tab + focus", (await page.evaluate(() => document.activeElement.id)) === "tab-breakfast");
  await page.keyboard.press("ArrowRight");
  check("ArrowRight wraps to the first tab", (await page.evaluate(() => document.activeElement.id)) === "tab-coffee");
  await page.keyboard.press("End");
  check("End key goes to the last tab", (await page.evaluate(() => document.activeElement.id)) === "tab-breakfast");
  await page.keyboard.press("Home");
  check("Home key goes to the first tab", JSON.stringify(await visiblePanels()) === '["panel-coffee"]');
  check("inactive tabs are out of the Tab order", (await page.$$eval("[role=tab][tabindex='0']", (t) => t.length)) === 1);

  /* ------------------------------------------------------------- lightbox */
  const first = page.locator("[data-lightbox-index='0']");
  await first.scrollIntoViewIfNeeded();
  await first.click();
  await page.waitForTimeout(500);
  check("gallery click opens the lightbox", await page.$eval("[data-lightbox]", (d) => d.open));
  check("lightbox image loads", await page.waitForFunction(() => {
    const img = document.querySelector(".lightbox__img");
    return img.complete && img.naturalWidth > 0;
  }, null, { timeout: 5000 }).then(() => true, () => false));
  check("counter shows 1 / 8", (await page.textContent(".lightbox__count")) === "1 / 8");
  await page.keyboard.press("ArrowRight");
  check("ArrowRight shows next photo", (await page.textContent(".lightbox__count")) === "2 / 8");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  check("ArrowLeft wraps to the last photo", (await page.textContent(".lightbox__count")) === "8 / 8");
  check("focus stays inside the lightbox", await page.evaluate(() => document.querySelector("[data-lightbox]").contains(document.activeElement)));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("Escape closes the lightbox", !(await page.$eval("[data-lightbox]", (d) => d.open)));
  check("focus returns to the photo that opened it", await page.evaluate(() => document.activeElement.dataset.lightboxIndex === "0"));
  check("page can scroll again after closing", !(await page.evaluate(() => document.documentElement.classList.contains("has-modal"))));

  /* ------------------------------------------------------------- carousel */
  const track = page.locator(".carousel__track");
  await track.scrollIntoViewIfNeeded();
  check("previous button disabled at the start", await page.$eval("[data-carousel-prev]", (b) => b.disabled));
  await page.click("[data-carousel-next]");
  await page.waitForTimeout(900);
  check("next button scrolls the reviews", (await track.evaluate((t) => t.scrollLeft)) > 0);
  check("first visible review becomes the active dot", (await page.getAttribute("[data-dot='1']", "aria-current")) === "true");
  await ctx.close();
}

/* ------------------------------------------- swipe in the lightbox (touch) */
{
  const { ctx, page } = await newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator("[data-lightbox-index='2']").scrollIntoViewIfNeeded();
  await page.locator("[data-lightbox-index='2']").tap();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const stage = document.querySelector("[data-lightbox-stage]");
    const fire = (type, x) => stage.dispatchEvent(new PointerEvent(type, { pointerType: "touch", clientX: x, clientY: 400, bubbles: true }));
    fire("pointerdown", 300); fire("pointermove", 200); fire("pointermove", 120); fire("pointerup", 120);
  });
  check("swipe left goes to the next photo", (await page.textContent(".lightbox__count")) === "4 / 8");
  await page.click("[data-lightbox-close]");
  await page.waitForTimeout(400);
  check("close button closes the lightbox", !(await page.$eval("[data-lightbox]", (d) => d.open)));

  /* --------------------------------------- header, action bar, mobile menu */
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  check("action bar hidden on the hero (and not focusable)", await page.$eval("[data-action-bar]", (b) => !b.classList.contains("is-visible") && b.inert));
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(700);
  check("header shrinks after scrolling", await page.$eval("[data-header]", (h) => h.classList.contains("is-scrolled")));
  check("action bar appears after the hero", await page.$eval("[data-action-bar]", (b) => b.classList.contains("is-visible") && !b.inert));
  check("parallax moves the hero photo", (await page.$eval("[data-parallax]", (el) => el.style.transform)).includes("translate3d"));
  await page.click(".menu-btn");
  await page.waitForTimeout(500);
  check("menu button opens the mobile menu", await page.$eval("[data-sheet]", (d) => d.open));
  check("menu button reports aria-expanded=true", (await page.getAttribute(".menu-btn", "aria-expanded")) === "true");
  await page.click('.sheet__links a[href="#story"]');
  await page.waitForTimeout(1500);
  check("menu link closes the menu", !(await page.$eval("[data-sheet]", (d) => d.open)));
  check("menu link scrolls to the section", await page.evaluate(() => Math.abs(document.querySelector("#story").getBoundingClientRect().top) < 30));

  /* -------------------------------------------------- map + copy address */
  await page.locator("[data-map-load]").scrollIntoViewIfNeeded();
  check("no map is loaded before the tap (privacy + speed)", (await page.locator("iframe").count()) === 0);
  await page.click("[data-map-load]");
  const src = await page.waitForSelector(".map__frame").then((f) => f.getAttribute("src"));
  check("tapping the map loads the OpenStreetMap embed", src.startsWith("https://www.openstreetmap.org/export/embed.html"));
  await page.waitForTimeout(1500);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  await page.click("[data-copy-th]");
  await page.waitForTimeout(300);
  check("copy address shows a confirmation", await page.$eval("[data-toast]", (t) => t.classList.contains("is-visible") && t.textContent.length > 5));
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  check("address is on the clipboard", clip.includes("ถนนสุขุมวิท"), clip);
  check("no CSP violations or JS errors during all of that", !(await page.evaluate(() => window.__csp.length)) && !page.__errors.length,
    JSON.stringify([await page.evaluate(() => window.__csp), page.__errors]));
  await ctx.close();
}

/* --------------------------------------------- keyboard: skip link + focus */
{
  const { ctx, page } = await newPage({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(350); // let the slide-in finish
  check("first Tab focuses the skip link", (await page.evaluate(() => document.activeElement.className)) === "skip-link");
  check("skip link is visible when focused", await page.$eval(".skip-link", (a) => a.getBoundingClientRect().top >= 0 && getComputedStyle(a).opacity === "1"));
  await page.keyboard.press("Enter");
  check("skip link moves focus to the main content", (await page.evaluate(() => document.activeElement.id)) === "main");
  // Tab on (keyboard focus) until a button-like element is focused, then read its outline.
  let outline = "none";
  for (let i = 0; i < 12 && outline === "none"; i++) {
    await page.keyboard.press("Tab");
    outline = await page.evaluate(() => {
      const el = document.activeElement;
      return el && el.matches(".btn, .site-nav__link, .lang-toggle__btn, .tabs__tab") ? getComputedStyle(el).outlineStyle : "none";
    });
  }
  check("focused buttons show an outline", outline !== "none", outline);
  await ctx.close();
}

/* ------------------------------------------------------- reduced motion */
{
  const { ctx, page } = await newPage({ reducedMotion: "reduce" });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(400);
  check("reduced motion: no parallax", (await page.$eval("[data-parallax]", (el) => el.style.transform)) === "");
  check("reduced motion: reveals don't slide", await page.evaluate(() => getComputedStyle(document.querySelector(".reveal")).transform === "none"));
  check("reduced motion: smooth scrolling off", (await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)) === "auto");
  await ctx.close();
}

/* ------------------------------------------------------------- no JavaScript */
{
  const { ctx, page } = await newPage({ javaScriptEnabled: false });
  await page.goto(BASE);
  check("no JS: hero, steps and menu are readable", await page.evaluate(() =>
    document.querySelector("h1").textContent.length > 3 && document.querySelectorAll(".step").length >= 3 && document.querySelectorAll(".menu-item").length > 10));
  check("no JS: all menu categories shown", (await page.$$eval("[role=tabpanel]", (ps) => ps.filter((p) => getComputedStyle(p).display !== "none").length)) === 4);
  check("no JS: content is not hidden by animations", await page.evaluate(() =>
    [...document.querySelectorAll(".reveal")].every((el) => getComputedStyle(el).opacity === "1")));
  check("no JS: QR code still present", (await page.locator("[data-qr] svg").count()) === 1);
  await ctx.close();
}

/* ---------------------------------------- live preview when config changed */
{
  const { ctx, page } = await newPage();
  await page.route("**/config.js", async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace('en: "Sample Cafe" }', 'en: "Preview Cafe" }').replace('theme: "warmClassic"', 'theme: "freshGreen"');
    route.fulfill({ response: res, body });
  });
  const info = [];
  page.on("console", (m) => info.push(m.text()));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click('[data-set-lang="en"]');
  check("edited config.js re-renders the page without a bake", (await page.textContent(".hero__title")).includes("Preview Cafe"));
  check("edited theme applies (fresh green)", (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--c-accent").trim().toLowerCase())) === "#3b6647");
  check("console reminds you to run the bake", info.some((t) => t.includes("bake")));
  check("QR code is redrawn by the lazy-loaded library", await page.waitForSelector("[data-qr] svg", { timeout: 4000 }).then(() => true, () => false));
  await ctx.close();
}

/* ---------------------------------------------------------------- 404 page */
{
  const { ctx, page } = await newPage();
  const res = await page.goto(BASE + "some/missing/page", { waitUntil: "networkidle" });
  check("unknown URL returns status 404", res.status() === 404);
  check("404 page renders with styles and a link home", await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor !== "rgba(0, 0, 0, 0)" && !!document.querySelector('a[href="/"]')));
  check("404 page has no errors", !page.__errors.filter((e) => !e.includes("404 (Not Found)")).length && !(await page.evaluate(() => window.__csp.length)), page.__errors.join());
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
