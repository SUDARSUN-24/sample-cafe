/* =============================================================================
   booking.js — the browser side of the booking + order system.
   -----------------------------------------------------------------------------
   Talks to the backend at /api (see backend/core.mjs):
     • fills the "Reserve a table" form with the free times and sends bookings,
     • lets a visitor check or cancel a booking or order with code + phone,
     • gives the voice concierge (concierge.js) two helpers through
       window.ShopApi: prefill the form, and place a pre-order.
   If the backend does not answer (for example on a host without functions),
   the form stays hidden and the "book on LINE" message stays: nothing breaks.
   ========================================================================== */
(function () {
  "use strict";

  const C = window.SHOP_CONFIG;
  const R = window.ShopRender;
  if (!C || !R) return;
  const html = document.documentElement;
  const $ = (sel, root = document) => root.querySelector(sel);
  const lang = () => (html.lang === "en" ? "en" : "th");
  const zone = (C.hours && C.hours.timeZone) || "Asia/Bangkok";
  const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  /* ------------------------------------------------------------ the backend */
  async function call(method, path, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch("/api" + path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
        cache: "no-store",
      });
      if (!/json/.test(res.headers.get("content-type") || "")) throw new Error("no backend");
      const data = await res.json();
      return res.ok ? data : { error: data.error || "error", message: data.message };
    } catch (e) {
      return { error: "offline", message: { th: "เชื่อมต่อระบบไม่ได้ ลองใหม่อีกครั้งหรือทักไลน์ร้าน", en: "Couldn't reach the booking system. Please try again, or message the shop on LINE." } };
    } finally {
      clearTimeout(timer);
    }
  }
  // Asked once per page view: is there a backend, and what does it accept?
  const health = call("GET", "/health").then((h) => ({ booking: !!h.booking, orders: !!h.orders, online: !h.error }));

  /* ------------------------------------------------------------------ dates */
  const iso = (d) => d.toISOString().slice(0, 10);
  function shopToday() {
    const p = {};
    new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
    return `${p.year}-${p.month}-${p.day}`;
  }
  const addDays = (date, n) => iso(new Date(Date.parse(date + "T00:00:00Z") + n * 86400000));
  const isOpen = (date) =>
    !(C.hours.closedDates || []).includes(date) && (C.hours.weekly[DAYS[new Date(date + "T00:00:00Z").getUTCDay()]] || []).length > 0;
  function openDates(daysAhead) {
    const today = shopToday();
    const out = [];
    for (let i = 0; i <= daysAhead; i++) { const d = addDays(today, i); if (isOpen(d)) out.push(d); }
    return out;
  }
  function dateLabel(date, L) {
    const today = shopToday();
    const text = new Intl.DateTimeFormat(L === "th" ? "th-TH-u-ca-gregory" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
      .format(new Date(date + "T00:00:00Z"));
    if (date === today) return (L === "th" ? "วันนี้ · " : "Today · ") + text;
    if (date === addDays(today, 1)) return (L === "th" ? "พรุ่งนี้ · " : "Tomorrow · ") + text;
    return text;
  }

  const STATUS = {
    confirmed: { th: "ยืนยันแล้ว", en: "Confirmed" }, seated: { th: "เข้าร้านแล้ว", en: "Seated" }, done: { th: "เสร็จสิ้น", en: "Completed" },
    "no-show": { th: "ไม่มาตามนัด", en: "No-show" }, cancelled: { th: "ยกเลิกแล้ว", en: "Cancelled" },
    new: { th: "ได้รับออเดอร์แล้ว", en: "Received" }, accepted: { th: "ร้านรับออเดอร์แล้ว", en: "Accepted" }, ready: { th: "พร้อมรับ", en: "Ready for pickup" },
  };

  /* ------------------------------------------------------------- the form */
  const root = $("[data-book]");
  const ui = root && {
    offline: $("[data-book-offline]", root), form: $("[data-book-form]", root), done: $("[data-book-done]", root),
    party: $("[data-book-party]", root), date: $("[data-book-date]", root), slots: $("[data-book-slots]", root),
    slotsMsg: $("[data-book-slots-msg]", root), name: $("[data-book-name]", root), phone: $("[data-book-phone]", root),
    note: $("[data-book-note]", root), website: $("[data-book-website]", root), error: $("[data-book-error]", root),
    submit: $("[data-book-submit]", root), doneWhen: $("[data-book-done-when]", root), doneCode: $("[data-book-done-code]", root),
    again: $("[data-book-again]", root), manage: $("[data-manage]", root), mCode: $("[data-manage-code]", root),
    mPhone: $("[data-manage-phone]", root), mCheck: $("[data-manage-check]", root), mResult: $("[data-manage-result]", root),
    mCancel: $("[data-manage-cancel]", root),
  };
  const S = R.strings(C);
  let chosenTime = "";
  let wantedTime = "";  // a time asked for before the slots arrived (from the concierge)
  let loadId = 0;

  function fillDates() {
    const keep = ui.date.value;
    const dates = openDates(parseInt(root.dataset.days, 10) || 14);
    ui.date.textContent = "";
    dates.forEach((d) => {
      const o = document.createElement("option");
      o.value = d;
      o.textContent = dateLabel(d, lang());
      ui.date.appendChild(o);
    });
    if (dates.includes(keep)) ui.date.value = keep;
  }

  function pick(time) {
    chosenTime = time;
    Array.from(ui.slots.children).forEach((b) => {
      const on = b.dataset.time === time;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on || (!time && b === ui.slots.querySelector("button:not([disabled])")) ? 0 : -1;
    });
  }

  async function loadSlots() {
    const id = ++loadId;
    chosenTime = "";
    ui.slots.textContent = "";
    ui.slotsMsg.innerHTML = R.t(S.bookLoading);
    const data = await call("GET", `/availability?date=${encodeURIComponent(ui.date.value)}&party=${encodeURIComponent(ui.party.value)}`);
    if (id !== loadId) return; // a newer request replaced this one
    if (data.error) { ui.slotsMsg.innerHTML = R.t(data.message); return; }
    const free = data.slots.filter((s) => s.available);
    ui.slotsMsg.innerHTML = free.length ? "" : R.t(S.bookNoSlots);
    data.slots.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "slot";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      b.dataset.time = s.time;
      b.textContent = s.time;
      b.disabled = !s.available;
      b.tabIndex = -1;
      ui.slots.appendChild(b);
    });
    pick(wantedTime && free.some((s) => s.time === wantedTime) ? wantedTime : "");
    wantedTime = "";
  }

  function showError(message) {
    ui.error.innerHTML = message ? R.t(message) : "";
  }

  async function submit() {
    showError(null);
    if (!chosenTime) return showError({ th: "กรุณาเลือกเวลา", en: "Please choose a time." });
    if (!ui.name.value.trim()) { ui.name.focus(); return showError({ th: "กรุณาใส่ชื่อ", en: "Please enter a name." }); }
    if (ui.phone.value.replace(/\D/g, "").length < 9) { ui.phone.focus(); return showError({ th: "กรุณาใส่เบอร์โทรให้ถูกต้อง", en: "Please enter a valid phone number." }); }
    ui.submit.disabled = true;
    const data = await call("POST", "/bookings", {
      date: ui.date.value, time: chosenTime, party: ui.party.value, name: ui.name.value, phone: ui.phone.value,
      note: ui.note.value, website: ui.website.value, lang: lang(),
    });
    ui.submit.disabled = false;
    if (data.error) {
      showError(data.message);
      if (data.error === "full" || data.error === "no_slot") loadSlots();
      return;
    }
    const b = data.booking;
    ui.doneWhen.innerHTML = R.t({
      th: `${dateLabel(b.date, "th")} เวลา ${b.time} น. · ${b.party} ท่าน · ชื่อ ${b.name}`,
      en: `${dateLabel(b.date, "en")} at ${b.time} · ${b.party} ${b.party === 1 ? "guest" : "guests"} · ${b.name}`,
    });
    ui.doneCode.textContent = b.code;
    ui.form.hidden = true;
    ui.done.hidden = false;
    ui.done.focus({ preventScroll: true });
    ui.mCode.value = b.code;
    ui.mPhone.value = ui.phone.value;
    window.dispatchEvent(new CustomEvent("shop:booked", { detail: b }));
  }

  /* ---------------------------------------------------- check or cancel */
  function describe(f) {
    const status = STATUS[f.status] || { th: f.status, en: f.status };
    const what = f.type === "table"
      ? { th: `จองโต๊ะ ${f.party} ท่าน`, en: `Table for ${f.party}` }
      : { th: `ออเดอร์ ${f.total} บาท`, en: `Order, ${f.total} THB` };
    return {
      th: `${what.th} · ${dateLabel(f.date, "th")} ${f.time} น. · สถานะ: ${status.th}`,
      en: `${what.en} · ${dateLabel(f.date, "en")} ${f.time} · Status: ${status.en}`,
    };
  }
  async function manage(cancel) {
    ui.mCancel.hidden = true;
    ui.mResult.innerHTML = R.t(S.bookLoading);
    const data = cancel
      ? await call("POST", "/cancel", { code: ui.mCode.value, phone: ui.mPhone.value })
      : await call("GET", `/lookup?code=${encodeURIComponent(ui.mCode.value)}&phone=${encodeURIComponent(ui.mPhone.value)}`);
    if (data.error) { ui.mResult.innerHTML = R.t(data.message); return; }
    ui.mResult.innerHTML = R.t(describe(data.found));
    ui.mCancel.hidden = !["confirmed", "new", "accepted"].includes(data.found.status);
    if (cancel && data.found.type === "table" && !ui.form.hidden) loadSlots(); // the seats are free again
  }

  /* ---------------------------------------------------------------- start */
  const ready = health.then((h) => {
    if (!root || !h.booking) return h;
    ui.offline.hidden = true;
    ui.form.hidden = false;
    ui.manage.hidden = false;
    fillDates();
    loadSlots();
    ui.party.addEventListener("change", loadSlots);
    ui.date.addEventListener("change", loadSlots);
    ui.slots.addEventListener("click", (e) => { const b = e.target.closest(".slot"); if (b && !b.disabled) pick(b.dataset.time); });
    // Arrow keys move between times, like a radio group.
    ui.slots.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      const free = Array.from(ui.slots.querySelectorAll("button:not([disabled])"));
      const i = free.indexOf(document.activeElement);
      const next = free[(i + step + free.length) % free.length];
      if (next) { e.preventDefault(); pick(next.dataset.time); next.focus(); }
    });
    ui.submit.addEventListener("click", submit);
    ui.again.addEventListener("click", () => { ui.done.hidden = true; ui.form.hidden = false; showError(null); loadSlots(); });
    ui.mCheck.addEventListener("click", () => manage(false));
    ui.mCancel.addEventListener("click", () => manage(true));
    // Date names follow the page language.
    new MutationObserver(fillDates).observe(html, { attributes: true, attributeFilter: ["lang"] });
    return h;
  });

  /* ---------------------------------------------- helpers for the concierge */
  window.ShopApi = {
    ready,                       // resolves to { online, booking, orders }
    openDates, dateLabel, shopToday, addDays, isOpen,
    // Put what the visitor said into the booking form. Returns what it could set.
    async prefill({ party, date, time }) {
      const h = await ready;
      if (!root || !h.booking) return { ok: false };
      if (!ui.done.hidden) { ui.done.hidden = true; ui.form.hidden = false; }
      if (party) ui.party.value = String(Math.max(1, Math.min(ui.party.options.length, party)));
      const dates = Array.from(ui.date.options).map((o) => o.value);
      const dateOk = !date || dates.includes(date);
      if (date && dateOk) ui.date.value = date;
      wantedTime = time || "";
      await loadSlots();
      return { ok: true, dateOk, timeOk: !time || chosenTime === time, date: ui.date.value, party: parseInt(ui.party.value, 10), time: chosenTime };
    },
    placeOrder: (order) => call("POST", "/orders", order),
  };
})();
