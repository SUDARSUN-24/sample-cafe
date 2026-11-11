#!/usr/bin/env node
/* tools/tests/concierge.mjs — checks the voice concierge's brain and panel.
     node tools/serve.mjs --test   (in another terminal)
     node tools/tests/concierge.mjs [--shots folder]
   Sends sentences to the assistant as if they were typed or spoken and checks
   what it answers and what the page does. The clock is fixed to a Thursday
   at 10:00 in Bangkok so "open now" answers are predictable. It does not test
   the microphone or the spoken voice: try those by hand in Chrome.          */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { launch, BASE, arg } from "./_browser.mjs";

const require = createRequire(import.meta.url);
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? "  → " + detail : ""}`);
};
const shots = arg("shots", "");
if (shots) fs.mkdirSync(shots, { recursive: true });
const browser = await launch();

async function newPage(options = {}, when = "2026-11-12T10:00:00+07:00") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: "Asia/Bangkok", ...options });
  await ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + e.blockedURI));
  });
  const page = await ctx.newPage();
  // The local server (node tools/serve.mjs --test) gets the same fixed clock as the page, on /api calls only.
  await page.route("**/api/**", (r) => r.continue({ headers: { ...r.request().headers(), "x-test-now": when } }));
  await page.clock.install({ time: new Date(when) });
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") page.__errors.push(m.text()); });
  await page.goto(BASE, { waitUntil: "networkidle" });
  return { ctx, page };
}
const shot = (page, name) => (shots ? page.screenshot({ path: path.join(shots, name + ".png") }) : null);
const ask = (page, text) => page.evaluate((t) => window.ShopConcierge.ask(t), text);
const order = (page) => page.evaluate(() => {
  const o = window.ShopConcierge.getOrder();
  return o && { total: o.total, pickup: o.pickup, name: o.name, lines: o.lines.map((l) => `${l.qty} ${l.item.en}${l.variant ? " " + l.variant : ""}`) };
});
const spot = (page) => page.evaluate(() => {
  const n = document.querySelector(".menu-item.is-spotlit .menu-item__name [lang=en], .sig-card.is-spotlit .sig-card__name [lang=en]");
  return n ? n.textContent : "";
});
// The fake clock runs the page's timers and animation frames; the real pause lets smooth scrolling finish.
const settle = async (page) => { await page.clock.runFor(200); await new Promise((r) => setTimeout(r, 900)); await page.clock.runFor(200); };

/* --------------------------------------------------- Thai, on a phone */
{
  const { ctx, page } = await newPage();
  check("the Talk button is on the page", await page.isVisible(".cg-launch"));
  await page.click(".cg-launch");
  check("the notice (automated assistant, how voice is processed) shows before anything starts", (await page.innerText(".cg-intro__consent")).length > 40);
  await settle(page);
  await shot(page, "phone-1-intro");
  await page.click("[data-cg-start=text]");
  check("starting shows a greeting", (await page.innerText(".cg-line--agent")).includes("สวัสดี"));

  let a = await ask(page, "มีอะไรแนะนำบ้าง");
  await settle(page);
  check("TH: a recommendation names a bestseller with its price and highlights it", /ลาเต้คั่วบ้าน/.test(a) && /75/.test(a) && (await spot(page)) === "House Latte", a);
  const above = await page.evaluate(() => {
    const r = document.querySelector(".menu-item.is-spotlit").getBoundingClientRect();
    return r.top >= 0 && r.bottom <= document.querySelector(".cg-panel").getBoundingClientRect().top;
  });
  check("the highlighted item is on screen, above the panel", above);
  await shot(page, "phone-2-item");

  a = await ask(page, "บาสก์ชีสเค้กราคาเท่าไหร่");
  await settle(page);
  check("TH: a price question answers from config and switches to the Bakery tab", /135/.test(a) && (await page.evaluate(() => document.querySelector("[role=tab][aria-selected=true]").id)) === "tab-bakery", a);
  check("asking a price does not start an order", (await order(page)) === null);

  a = await ask(page, "เอาลาเต้เย็นสองแก้วกับชีสเค้กหนึ่งชิ้น รับบ่ายสาม");
  let o = await order(page);
  check("TH: one sentence becomes an order with quantities, iced, and pickup 15:00 (total 305)",
    o && o.total === 305 && o.pickup === "15:00" && o.lines.join("|") === "2 House Latte iced|1 Basque Cheesecake", JSON.stringify(o) + " " + a);
  check("the answer says the total", /305/.test(a), a);

  a = await ask(page, "ขอชาไทยด้วย");
  check("TH: a drink with two prices asks hot or iced", /ร้อนหรือเย็น/.test(a), a);
  a = await ask(page, "เย็น");
  o = await order(page);
  check("TH: the answer fills it in (Thai Tea iced, total 385)", o.total === 385 && o.lines.includes("1 Thai Tea iced"), JSON.stringify(o));

  a = await ask(page, "ไม่เอาชาไทยแล้ว");
  o = await order(page);
  check("TH: an item can be taken off (back to 305)", o.total === 305 && o.lines.length === 2, JSON.stringify(o));

  a = await ask(page, "แค่นี้ค่ะ");
  check("TH: finishing tells the visitor how to send it and that it is not sent yet", /ยืนยันสั่งซื้อ|ส่งทางไลน์/.test(a) && /ยังไม่ได้ส่ง/.test(a), a);
  const href = await page.getAttribute(".cg-order__send", "href");
  check("the Send on LINE link carries the order text", href.startsWith("https://line.me/R/oaMessage/") && decodeURIComponent(href).includes("305"), href);
  await settle(page);
  await shot(page, "phone-3-order");

  a = await ask(page, "เปลี่ยนเป็นรับ 20:30");
  o = await order(page);
  check("TH: a pickup time after closing is refused with today's hours", /ร้านปิด/.test(a) && /18:00/.test(a) && o.pickup === "", a);

  a = await ask(page, "ตอนนี้เปิดไหม");
  check("TH: open-now answer (Thursday 10:00 → open, closes 18:00)", /เปิดอยู่/.test(a) && /18:00/.test(a), a);
  a = await ask(page, "วันพุธเปิดไหม");
  check("TH: a closed day is reported as closed", /วันพุธร้านหยุด/.test(a), a);
  a = await ask(page, "ไปร้านยังไง");
  check("TH: directions mention the BTS and open the map", /BTS/.test(a) && (await page.$(".map__frame")) !== null, a);
  await settle(page);
  await shot(page, "phone-4-map");
  a = await ask(page, "มีที่จอดรถไหม");
  check("TH: parking answer comes from config", /จอดฟรี/.test(a), a);
  a = await ask(page, "มีไวไฟไหม");
  check("TH: the shop's own FAQ is used", /Wi-Fi/.test(a), a);
  a = await ask(page, "แพ้ถั่วกินอะไรได้บ้าง");
  check("TH: allergy questions are sent to the team, not answered", /พนักงาน/.test(a), a);
  a = await ask(page, "มีขนมอะไรใหม่บ้าง");
  await settle(page);
  check("TH: 'new' + category picks a new bakery item", /เค้กอัลมอนด์บลูเบอร์รี/.test(a), a);
  a = await ask(page, "ราคาหุ้นวันนี้เป็นยังไง");
  check("TH: something it doesn't know gets an honest 'can't help' with what it can do", /ยังตอบไม่ได้/.test(a), a);
  a = await ask(page, "ยกเลิก");
  check("TH: cancel clears the order", (await order(page)) === null, a);

  check("no page errors or CSP violations", !page.__errors.length && !(await page.evaluate(() => window.__csp.length)),
    page.__errors.concat(await page.evaluate(() => window.__csp)).join(" | "));
  await page.keyboard.press("Escape");
  check("Escape closes the panel", !(await page.isVisible(".cg-panel")));
  await ctx.close();
}

/* ------------------------------------------------- English, on desktop */
{
  const { ctx, page } = await newPage({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
  await page.click(".cg-launch");
  await page.click("[data-cg-start=text]");
  await page.fill(".cg-input__field", "What do you recommend?");
  await page.press(".cg-input__field", "Enter");
  await settle(page);
  const lines = await page.$$eval(".cg-line--agent", (els) => els.map((e) => e.textContent));
  check("EN: typing English answers in English and switches the page to English",
    /House Latte/.test(lines[lines.length - 1]) && (await page.evaluate(() => document.documentElement.lang)) === "en", lines[lines.length - 1]);

  let a = await ask(page, "yes please");
  check("EN: 'yes please' after a recommendation orders it and asks hot or iced", /hot or iced/.test(a), a);
  a = await ask(page, "iced");
  a = await ask(page, "and two butter croissants, pickup at 3 pm, name is Mali");
  const o = await order(page);
  check("EN: adds items with a quantity, pickup time and name (85 + 150 = 235)",
    o && o.total === 235 && o.pickup === "15:00" && o.name === "Mali" && o.lines.join("|") === "1 House Latte iced|2 Butter Croissant", JSON.stringify(o) + " " + a);
  a = await ask(page, "that's all");
  check("EN: finishing says how to send it", /Place order|Send on LINE/.test(a) && /isn't sent/.test(a), a);
  await settle(page);
  await shot(page, "desktop-order");
  a = await ask(page, "how much is the matcha latte");
  check("EN: price question with two prices", /95 baht hot, 105 iced/.test(a), a);
  a = await ask(page, "are you open on Saturday?");
  check("EN: hours for a named day", /Saturday/.test(a) && /08:00 to 19:00/.test(a), a);
  a = await ask(page, "where are you?");
  check("EN: directions", /BTS On Nut/.test(a), a);
  a = await ask(page, "do you deliver?");
  check("EN: FAQ answer", /pre-order and pick up/.test(a), a);
  a = await ask(page, "what's the weather like");
  check("EN: honest fallback", /can't help with that/.test(a), a);
  const fits = await page.evaluate(() => {
    const p = document.querySelector(".cg-panel").getBoundingClientRect();
    return p.top >= 0 && p.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth;
  });
  check("the panel fits the desktop window and adds no sideways scroll", fits);
  check("no page errors or CSP violations", !page.__errors.length && !(await page.evaluate(() => window.__csp.length)),
    page.__errors.concat(await page.evaluate(() => window.__csp)).join(" | "));
  await ctx.close();
}

/* --------------------------------------------------- a closed day (Wednesday) */
{
  const { ctx, page } = await newPage({}, "2026-11-11T10:00:00+07:00");
  let a = await ask(page, "ตอนนี้เปิดไหม");
  check("closed day: says the shop is closed today", /ปิดอยู่/.test(a) && /วันนี้ร้านหยุด/.test(a), a);
  a = await ask(page, "เอาเอสเปรสโซหนึ่งแก้ว รับ 10 โมง");
  const o = await order(page);
  check("closed day: the order is kept but the pickup time is not accepted", o && o.total === 60 && o.pickup === "" && /วันนี้ร้านหยุด/.test(a), a);
  await ctx.close();
}

/* ------------------------------------------------------------ accessibility */
{
  // bypassCSP: only so the test can inject axe-core; the page itself is unchanged.
  const { ctx, page } = await newPage({ bypassCSP: true });
  await page.click(".cg-launch");
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const run = () => page.evaluate(async () => (await window.axe.run(".cg-panel")).violations.map((v) => `${v.id} (${v.nodes.map((n) => n.target).join(", ")})`));
  const intro = await run();
  check("axe finds no accessibility violations in the intro view", !intro.length, intro.join("; "));
  await page.click("[data-cg-start=text]");
  await ask(page, "เอาลาเต้เย็นสองแก้ว รับบ่ายสาม");
  const live = await run();
  check("axe finds no accessibility violations in the conversation + order card", !live.length, live.join("; "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
