/* =============================================================================
   admin.js — the staff dashboard (admin.html): one day's table bookings and
   pickup orders, with buttons to move each one along.
   -----------------------------------------------------------------------------
   The staff key is typed in once and kept only for this browser tab
   (sessionStorage). Every request sends it in the x-admin-key header; the
   server (backend/core.mjs) checks it. The list refreshes every 30 seconds.
   Everything from visitors (names, notes) is written with textContent, never
   as HTML.
   ========================================================================== */
(function () {
  "use strict";
  const $ = (sel, root = document) => root.querySelector(sel);
  const ui = {
    shop: $("[data-shop]"), login: $("[data-login]"), key: $("[data-key]"), signin: $("[data-signin]"), loginError: $("[data-login-error]"),
    signout: $("[data-signout]"), board: $("[data-board]"), date: $("[data-date]"), prev: $("[data-prev]"), next: $("[data-next]"),
    today: $("[data-today]"), updated: $("[data-updated]"), tables: $("[data-tables]"), orders: $("[data-orders]"),
  };
  const KEY = "shop-admin-key";
  let key = "";
  try { key = sessionStorage.getItem(KEY) || ""; } catch (e) { /* storage blocked: type the key each time */ }
  let today = "";
  let timer = 0;

  const STATUS = {
    confirmed: "ยืนยันแล้ว · Confirmed", seated: "เข้าร้านแล้ว · Seated", done: "เสร็จสิ้น · Done", "no-show": "ไม่มา · No-show",
    cancelled: "ยกเลิก · Cancelled", new: "ใหม่ · New", accepted: "รับแล้ว · Accepted", ready: "พร้อมรับ · Ready",
  };
  // The usual next step for each status: [new status, button text].
  const NEXT = {
    table: { confirmed: [["seated", "ลูกค้ามาแล้ว · Seat"], ["no-show", "ไม่มา · No-show"]], seated: [["done", "เสร็จ · Done"]] },
    order: { new: [["accepted", "รับออเดอร์ · Accept"]], accepted: [["ready", "พร้อมรับ · Ready"]], ready: [["done", "รับแล้ว · Picked up"]] },
  };
  const ALL = { table: ["confirmed", "seated", "done", "no-show", "cancelled"], order: ["new", "accepted", "ready", "done", "cancelled"] };

  async function call(method, path, body) {
    const res = await fetch("/api" + path, {
      method,
      headers: Object.assign({ "x-admin-key": key }, body ? { "Content-Type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    let data = {};
    try { data = await res.json(); } catch (e) { data = { error: "offline", message: { th: "เชื่อมต่อระบบไม่ได้", en: "Couldn't reach the backend." } }; }
    if (!res.ok && !data.error) data.error = "error";
    return data;
  }
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const addDays = (date, n) => new Date(Date.parse(date + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

  function card(r) {
    const li = el("li", `admin__card is-${r.status}`);
    const top = el("div", "admin__card-top");
    top.append(el("strong", "admin__time", r.time), el("span", "admin__status", STATUS[r.status] || r.status), el("span", "admin__code", r.code));
    li.appendChild(top);
    if (r.type === "table") li.appendChild(el("p", "admin__main", `${r.party} ท่าน · ${r.name}`));
    else {
      li.appendChild(el("p", "admin__main", `${r.name} · ${r.total} บาท`));
      const items = el("ul", "admin__items");
      r.items.forEach((i) => items.appendChild(el("li", "", `${i.qty} × ${i.th}${i.variant ? (i.variant === "iced" ? " (เย็น)" : " (ร้อน)") : ""} · ${i.en}`)));
      li.appendChild(items);
    }
    const phone = el("a", "admin__phone", r.phone);
    phone.href = "tel:" + r.phone;
    li.appendChild(phone);
    if (r.note) li.appendChild(el("p", "admin__note", r.note));

    const actions = el("div", "admin__actions");
    ((NEXT[r.type] || {})[r.status] || []).forEach(([status, text], i) => {
      const b = el("button", i === 0 ? "btn btn--primary" : "btn btn--ghost", text);
      b.type = "button";
      b.addEventListener("click", () => setStatus(r.code, status));
      actions.appendChild(b);
    });
    // Any status, for corrections (e.g. cancelled by phone).
    const select = el("select", "field__input admin__select");
    select.setAttribute("aria-label", `สถานะ · Status ${r.code}`);
    ALL[r.type].forEach((s) => {
      const o = el("option", "", STATUS[s]);
      o.value = s;
      o.selected = s === r.status;
      select.appendChild(o);
    });
    select.addEventListener("change", () => setStatus(r.code, select.value));
    actions.appendChild(select);
    li.appendChild(actions);
    return li;
  }

  function fill(list, records, empty) {
    list.textContent = "";
    if (!records.length) list.appendChild(el("li", "admin__empty", empty));
    records.forEach((r) => list.appendChild(card(r)));
  }

  async function load(date) {
    const data = await call("GET", "/admin/day" + (date ? `?date=${encodeURIComponent(date)}` : ""));
    if (data.error) {
      if (data.error === "unauthorized" || data.error === "slow_down") signOut((data.message || {}).th + " · " + (data.message || {}).en);
      else ui.updated.textContent = (data.message || {}).th || "Error";
      return;
    }
    today = data.today;
    ui.login.hidden = true;
    ui.board.hidden = false;
    ui.signout.hidden = false;
    ui.shop.textContent = data.shop;
    ui.date.value = data.date;
    Object.keys(data.summary).forEach((k) => { $(`[data-sum="${k}"]`).textContent = k === "revenue" ? `${data.summary[k]} ฿` : data.summary[k]; });
    fill(ui.tables, data.tables, data.open.length ? "ยังไม่มีการจอง · No bookings yet" : "ร้านหยุด · Closed this day");
    fill(ui.orders, data.orders, "ยังไม่มีออเดอร์ · No orders yet");
    ui.updated.textContent = "อัปเดต · Updated " + new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  }
  async function setStatus(code, status) {
    const data = await call("POST", "/admin/status", { code, status });
    if (data.error) ui.updated.textContent = (data.message || {}).th || "Error";
    load(ui.date.value);
  }

  function signIn() {
    key = ui.key.value.trim();
    if (!key) return;
    try { sessionStorage.setItem(KEY, key); } catch (e) { /* fine */ }
    ui.loginError.textContent = "";
    start();
  }
  function signOut(message) {
    key = "";
    try { sessionStorage.removeItem(KEY); } catch (e) { /* fine */ }
    clearInterval(timer);
    ui.board.hidden = true;
    ui.signout.hidden = true;
    ui.login.hidden = false;
    ui.key.value = "";
    ui.loginError.textContent = message || "";
  }
  function start() {
    load(ui.date.value);
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden && key) load(ui.date.value); }, 30000);
  }

  ui.signin.addEventListener("click", signIn);
  ui.key.addEventListener("keydown", (e) => { if (e.key === "Enter") signIn(); });
  ui.signout.addEventListener("click", () => signOut(""));
  ui.date.addEventListener("change", () => load(ui.date.value));
  ui.prev.addEventListener("click", () => load(addDays(ui.date.value || today, -1)));
  ui.next.addEventListener("click", () => load(addDays(ui.date.value || today, 1)));
  ui.today.addEventListener("click", () => load(""));
  if (key) start();
})();
