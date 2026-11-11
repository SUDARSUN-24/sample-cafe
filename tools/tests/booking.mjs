#!/usr/bin/env node
/* tools/tests/booking.mjs — the booking system in a real browser, end to end:
   the form, check/cancel, pre-orders from the concierge, voice-style table
   booking, the staff dashboard, and the fallback when there is no backend.
     node tools/serve.mjs --test     (in another terminal; --test lets the tests set the clock)
     node tools/tests/booking.mjs [--shots folder]
   The clock (browser and server) is fixed to Thursday 12 Nov 2026, 10:00 Bangkok. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { launch, BASE, arg } from "./_browser.mjs";

const require = createRequire(import.meta.url);
const NOW = "2026-11-12T10:00:00+07:00";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? "  → " + detail : ""}`);
};
const shots = arg("shots", "");
if (shots) fs.mkdirSync(shots, { recursive: true });
const shot = (page, name, opts = {}) => (shots ? page.screenshot({ path: path.join(shots, name + ".png"), ...opts }) : null);
const browser = await launch();
let visitor = 0;

async function newPage(options = {}, url = BASE) {
  const { noApi, ...rest } = options;
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: "Asia/Bangkok",
    ...rest,
  });
  const ip = "10.0.0." + ++visitor;
  await ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + e.blockedURI));
  });
  const page = await ctx.newPage();
  if (noApi) await page.route("**/api/**", (r) => r.fulfill({ status: 404, contentType: "text/html", body: "<h1>Not found</h1>" }));
  // Each test page is its own "visitor", with the server on the same fixed clock (sent on /api calls only).
  else await page.route("**/api/**", (r) => r.continue({ headers: { ...r.request().headers(), "x-test-now": NOW, "x-test-ip": ip } }));
  await page.clock.install({ time: new Date(NOW) });
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(e.message));
  // "Failed to load resource" is the browser noting a refused request (400/401/404): those are expected here.
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) page.__errors.push(m.text()); });
  await page.goto(url, { waitUntil: "networkidle" });
  return { ctx, page };
}
const clean = async (page) => !page.__errors.length && !(await page.evaluate(() => window.__csp.length));
const problems = async (page) => page.__errors.concat(await page.evaluate(() => window.__csp)).join(" | ");
const settle = async (page) => { await page.clock.runFor(300); await new Promise((r) => setTimeout(r, 700)); await page.clock.runFor(300); };
const ask = (page, text) => page.evaluate((t) => window.ShopConcierge.ask(t), text);

await (await fetch(BASE + "api/__reset", { method: "POST" })).json().catch(() => { console.error("Start the server with:  node tools/serve.mjs --test"); process.exit(2); });

/* ------------------------------------------------------ booking a table */
let bookingCode = "";
{
  const { ctx, page } = await newPage();
  await page.waitForSelector("[data-book-form]:not([hidden])");
  check("with the backend there, the form replaces the 'book on LINE' message", !(await page.isVisible("[data-book-offline]")));
  const dates = await page.$$eval("[data-book-date] option", (o) => o.map((x) => x.value));
  check("dates: today first, closed Wednesdays left out, 14 days ahead", dates[0] === "2026-11-12" && !dates.includes("2026-11-18") && dates.at(-1) === "2026-11-26", dates.join(","));
  const first = await page.$$eval(".slot", (b) => b.map((x) => x.textContent));
  check("today's times start 30 minutes from now and stop an hour before closing", first[0] === "10:30" && first.at(-1) === "17:00", first.join(","));

  await page.click("[data-book-submit]");
  check("submitting with nothing chosen explains what is missing", (await page.innerText("[data-book-error]")).length > 5);
  await page.selectOption("[data-book-party]", "4");
  await page.waitForSelector(".slot");
  await page.click('.slot[data-time="12:00"]');
  check("a chosen time is marked as selected", (await page.getAttribute('.slot[data-time="12:00"]', "aria-checked")) === "true");
  await page.fill("[data-book-name]", "มะลิ");
  await page.fill("[data-book-phone]", "081 234 5678");
  await page.fill("[data-book-note]", "ขอโต๊ะริมหน้าต่าง");
  await page.locator("[data-book]").scrollIntoViewIfNeeded();
  await settle(page);
  await shot(page, "book-1-form");
  await page.click("[data-book-submit]");
  await page.waitForSelector("[data-book-done]:not([hidden])");
  bookingCode = await page.innerText("[data-book-done-code]");
  const when = await page.innerText("[data-book-done-when]");
  check("the booking is confirmed on the page with a code", /^[A-Z2-9]{6}$/.test(bookingCode) && /12:00/.test(when) && /4/.test(when) && /มะลิ/.test(when), bookingCode + " " + when);
  await settle(page);
  await shot(page, "book-2-done");

  await page.click("[data-manage] summary");
  await page.click("[data-manage-check]");
  await page.waitForFunction(() => /ยืนยันแล้ว/.test(document.querySelector("[data-manage-result]").textContent));
  check("check my booking: code + phone shows the status", true);
  check("no page errors or CSP violations while booking", await clean(page), await problems(page));
  await ctx.close();
}

/* ------------------------------------------------- seats are really taken */
{
  const post = (body, ip) => fetch(BASE + "api/bookings", { method: "POST", headers: { "Content-Type": "application/json", "x-test-now": NOW, "x-test-ip": ip }, body: JSON.stringify(body) });
  await post({ date: "2026-11-12", time: "12:00", party: 6, name: "A", phone: "0811111111" }, "10.1.0.1");
  await post({ date: "2026-11-12", time: "12:00", party: 6, name: "B", phone: "0822222222" }, "10.1.0.2");
  const { ctx, page } = await newPage();
  await page.waitForSelector(".slot");
  check("a full time is shown as unavailable (16 of 16 seats at 12:00)", await page.isDisabled('.slot[data-time="12:00"]'));
  check("times outside the busy period stay bookable", !(await page.isDisabled('.slot[data-time="14:00"]')));

  // Cancel the first booking with its code and phone: the time opens again.
  await page.click("[data-manage] summary");
  await page.fill("[data-manage-code]", bookingCode);
  await page.fill("[data-manage-phone]", "0812345678");
  await page.click("[data-manage-check]");
  await page.waitForSelector("[data-manage-cancel]:not([hidden])");
  await page.click("[data-manage-cancel]");
  await page.waitForFunction(() => /ยกเลิกแล้ว/.test(document.querySelector("[data-manage-result]").textContent));
  await page.waitForFunction(() => { const b = document.querySelector('.slot[data-time="12:00"]'); return b && !b.disabled; });
  check("cancelling online frees the seats straight away", true);
  await page.fill("[data-manage-phone]", "0000000000");
  await page.click("[data-manage-check]");
  await page.waitForFunction(() => /ไม่พบรายการ/.test(document.querySelector("[data-manage-result]").textContent));
  check("a wrong phone number finds nothing", true);
  await ctx.close();
}

/* ------------------------------- pre-order through the concierge, placed */
let orderCode = "";
{
  const { ctx, page } = await newPage();
  await page.waitForSelector("[data-book-form]:not([hidden])");
  await page.click(".cg-launch");
  await page.click("[data-cg-start=text]");
  await ask(page, "เอาลาเต้เย็นสองแก้วกับชีสเค้กหนึ่งชิ้น รับบ่ายสาม");
  const closing = await ask(page, "แค่นี้ค่ะ");
  check("the concierge points to the Place order button", /ยืนยันสั่งซื้อ/.test(closing) && /ยังไม่ได้ส่ง/.test(closing), closing);
  await page.click(".cg-order__place");
  check("placing without a name or phone is refused by the server with a message", (await page.waitForSelector(".cg-order__error:not(:empty)")) !== null);
  await page.fill(".cg-order__field input[type=text]", "มะลิ");
  await page.fill(".cg-order__field input[type=tel]", "0812345678");
  await page.click(".cg-order__place");
  await page.waitForSelector(".cg-order__code strong");
  orderCode = await page.innerText(".cg-order__code strong");
  const last = await page.$$eval(".cg-line--agent", (els) => els.at(-1).textContent);
  check("the order is placed: a code is shown and said", /^[A-Z2-9]{6}$/.test(orderCode) && last.includes(orderCode), orderCode + " / " + last);
  await settle(page);
  await shot(page, "order-placed");
  await ask(page, "เอาเอสเปรสโซหนึ่งแก้ว");
  const next = await page.evaluate(() => { const o = window.ShopConcierge.getOrder(); return { lines: o.lines.length, placed: !!o.placed }; });
  check("ordering again after that starts a fresh order", next.lines === 1 && !next.placed, JSON.stringify(next));
  check("no page errors or CSP violations while ordering", await clean(page), await problems(page));
  await ctx.close();
}

/* ------------------------------------- booking a table by talking (typed) */
{
  const { ctx, page } = await newPage();
  await page.waitForSelector("[data-book-form]:not([hidden])");
  await page.click(".cg-launch");
  await page.click("[data-cg-start=text]");
  let a = await ask(page, "จองโต๊ะ 3 คน พรุ่งนี้ 10 โมง");
  await page.waitForFunction(() => document.querySelector('.slot[aria-checked="true"]'));
  const form = await page.evaluate(() => ({
    party: document.querySelector("[data-book-party]").value, date: document.querySelector("[data-book-date]").value,
    time: document.querySelector('.slot[aria-checked="true"]').dataset.time,
  }));
  check("TH: 'book a table for 3 tomorrow at 10' fills the form in", form.party === "3" && form.date === "2026-11-13" && form.time === "10:00" && /เปิดหน้าจอง/.test(a), JSON.stringify(form) + " " + a);
  await settle(page);
  check("the booking form is scrolled into view above the panel", await page.evaluate(() => {
    const r = document.querySelector("#booking").getBoundingClientRect();
    return r.top < innerHeight / 2 && r.bottom > 0;
  }));
  a = await ask(page, "book a table for two on Saturday at 9 am");
  await page.waitForFunction(() => document.querySelector("[data-book-date]").value === "2026-11-14" && document.querySelector('.slot[aria-checked="true"]'));
  check("EN: 'for two on Saturday at 9 am' fills the form in", (await page.inputValue("[data-book-party]")) === "2" && /booking form/.test(a), a);
  a = await ask(page, "จองโต๊ะวันพุธ 2 คน");
  check("a closed day is refused out loud", /ร้านหยุด/.test(a), a);
  a = await ask(page, "จองโต๊ะ 10 คน");
  check("a group over the limit is sent to LINE", /ไม่เกิน 6/.test(a), a);
  a = await ask(page, "จองโต๊ะ 2 คน วันนี้ เที่ยง");
  await page.waitForFunction(() => document.querySelectorAll(".cg-line--agent").length >= 6);
  const lines = await page.$$eval(".cg-line--agent", (els) => els.map((e) => e.textContent));
  check("a time that is taken gets a follow-up saying so", /เต็มแล้ว|จองไม่ได้/.test(lines.at(-1)) || (await page.evaluate(() => !!document.querySelector('.slot[aria-checked="true"]'))), lines.at(-1));
  a = await ask(page, "ขอยกเลิกการจอง");
  check("'cancel my booking' opens the check/cancel box", /รหัสการจอง/.test(a) && (await page.evaluate(() => document.querySelector("[data-manage]").open)), a);
  await ctx.close();
}

/* ------------------------------------------------------- staff dashboard */
{
  const { ctx, page } = await newPage({ viewport: { width: 1100, height: 900 }, isMobile: false, hasTouch: false }, BASE + "admin.html");
  check("the dashboard shows nothing before signing in", !(await page.isVisible("[data-board]")));
  await page.fill("[data-key]", "wrong-key");
  await page.click("[data-signin]");
  await page.waitForFunction(() => document.querySelector("[data-login-error]").textContent.length > 3);
  check("a wrong staff key is refused", !(await page.isVisible("[data-board]")));
  await page.fill("[data-key]", "local-admin");
  await page.click("[data-signin]");
  await page.waitForSelector("[data-board]:not([hidden])");
  const sums = await page.$$eval("[data-sum]", (els) => Object.fromEntries(els.map((e) => [e.dataset.sum, e.textContent])));
  check("the day's totals: 2 active bookings (12 guests), 1 order of 305 baht", sums.bookings === "2" && sums.guests === "12" && sums.orders === "1" && sums.revenue === "305 ฿", JSON.stringify(sums));
  const cards = await page.$$eval("[data-tables] .admin__card", (els) => els.map((e) => e.textContent));
  check("bookings are listed with name and phone, the cancelled one marked", cards.length === 3 && cards.some((c) => /มะลิ/.test(c) && /0812345678/.test(c) && /Cancelled/.test(c)), cards.join(" || "));
  const orderCard = page.locator("[data-orders] .admin__card", { hasText: orderCode });
  check("the order shows its items", /2 × ลาเต้คั่วบ้าน \(เย็น\)/.test(await orderCard.innerText()));
  await orderCard.locator("button", { hasText: "Accept" }).click();
  await page.waitForFunction((code) => Array.from(document.querySelectorAll("[data-orders] .admin__card")).some((c) => c.textContent.includes(code) && /Accepted/.test(c.textContent)), orderCode);
  check("staff can accept an order", true);
  const lookup = await (await fetch(`${BASE}api/lookup?code=${orderCode}&phone=5678`, { headers: { "x-test-now": NOW } })).json();
  check("the visitor then sees the new status", lookup.found && lookup.found.status === "accepted", JSON.stringify(lookup));
  await shot(page, "admin", { fullPage: true });

  check("no page errors or CSP violations on the dashboard", await clean(page), await problems(page));
  await page.click("[data-signout]");
  check("signing out hides everything again", !(await page.isVisible("[data-board]")) && (await page.evaluate(() => sessionStorage.getItem("shop-admin-key"))) === null);
  await ctx.close();
}

/* ------------------------------------------------------------ accessibility */
{
  const { ctx, page } = await newPage({ bypassCSP: true });
  await page.waitForSelector(".slot");
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const run = (sel) => page.evaluate(async (s) => (await window.axe.run(s)).violations.map((v) => `${v.id} (${v.nodes.map((n) => n.target).join(", ")})`), sel);
  let v = await run("#booking");
  check("axe finds no accessibility violations in the booking section", !v.length, v.join("; "));
  await ctx.close();
  const admin = await newPage({ bypassCSP: true, viewport: { width: 1100, height: 900 }, isMobile: false, hasTouch: false }, BASE + "admin.html");
  await admin.page.fill("[data-key]", "local-admin");
  await admin.page.click("[data-signin]");
  await admin.page.waitForSelector("[data-board]:not([hidden])");
  await admin.page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  v = await admin.page.evaluate(async () => (await window.axe.run()).violations.map((x) => `${x.id} (${x.nodes.map((n) => n.target).join(", ")})`));
  check("axe finds no accessibility violations on the dashboard", !v.length, v.join("; "));
  await admin.ctx.close();
}

/* ------------------------------------------ a host with no backend at all */
{
  const { ctx, page } = await newPage({ noApi: true });
  await page.clock.runFor(500);
  check("without a backend the 'book on LINE' message stays and the form stays hidden",
    (await page.isVisible("[data-book-offline]")) && !(await page.isVisible("[data-book-form]")));
  await page.click(".cg-launch");
  await page.click("[data-cg-start=text]");
  await ask(page, "เอาลาเต้เย็นสองแก้ว รับบ่ายสาม");
  const closing = await ask(page, "แค่นี้");
  check("without a backend pre-orders go to LINE as before", /ส่งทางไลน์/.test(closing) && !(await page.$(".cg-order__place")), closing);
  const a = await ask(page, "จองโต๊ะ 2 คน");
  check("without a backend 'book a table' points to LINE and phone", /ไลน์/.test(a) && /โทร/.test(a), a);
  check("no page errors without a backend", !page.__errors.length, page.__errors.join(" | "));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
