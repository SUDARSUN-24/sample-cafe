/* =============================================================================
   backend/core.mjs — the booking + order system (all the rules, no hosting code).
   -----------------------------------------------------------------------------
   Used in two places with the same code:
     • netlify/functions/api.mjs  — live, storing data in Netlify Blobs (free),
     • tools/serve.mjs            — on your computer, storing data in memory.
   What the shop sells and when it is open comes from backend/shop.generated.mjs,
   which `node tools/bake.mjs` writes from site/config.js. So prices and hours
   are checked on the server too: a visitor cannot send a made-up total.

   Routes (all under /api):
     GET  /health                         is the backend there?
     GET  /availability?date=&party=      free table times for a day
     POST /bookings                       reserve a table
     POST /orders                         place a pre-order for pickup
     GET  /lookup?code=&phone=            a visitor checks their booking/order
     POST /cancel                         a visitor cancels it
     GET  /admin/day?date=                staff: everything for one day
     POST /admin/status                   staff: change a status
   Staff routes need the header  x-admin-key  (the ADMIN_KEY setting).

   Personal data kept: first name, phone number, optional note. Nothing else.
   Records are deleted 30 days after their date.
   ========================================================================== */
import crypto from "node:crypto";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const KEEP_DAYS = 30;
const WRITES_PER_HOUR = 6;       // new bookings + orders from one visitor
const ADMIN_TRIES_PER_HOUR = 10; // wrong staff keys from one visitor

export const TABLE_STATUS = ["confirmed", "seated", "done", "no-show", "cancelled"];
export const ORDER_STATUS = ["new", "accepted", "ready", "done", "cancelled"];

const pad = (n) => String(n).padStart(2, "0");
const toMin = (hhmm) => parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3), 10);
const toHHMM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
const isTime = (s) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const addDays = (date, n) => new Date(Date.parse(date + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const clean = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

class ApiError extends Error {
  constructor(status, code, th, en) {
    super(en);
    this.status = status;
    this.code = code;
    this.th = th;
    this.en = en;
  }
}
const fail = (status, code, th, en) => { throw new ApiError(status, code, th, en); };

export function createApi({ shop, store, adminKey, now = () => new Date() }) {
  /* ------------------------------------------------------------ time + hours */
  // "Now" in the shop's own time zone, whatever the server's clock is set to.
  function shopNow() {
    const parts = {};
    new Intl.DateTimeFormat("en-CA", {
      timeZone: shop.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(now()).forEach((p) => { parts[p.type] = p.value; });
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10) };
  }
  const rangesFor = (date) =>
    (shop.closedDates || []).includes(date) ? [] : shop.weekly[DAYS[new Date(date + "T00:00:00Z").getUTCDay()]] || [];

  function checkDate(date) {
    const today = shopNow().date;
    if (!isDate(date)) fail(400, "bad_date", "วันที่ไม่ถูกต้อง", "That date isn't valid.");
    if (date < today) fail(400, "past_date", "วันที่ผ่านมาแล้ว", "That date has passed.");
    if (date > addDays(today, shop.booking.daysAhead)) {
      fail(400, "too_far", `จองล่วงหน้าได้ไม่เกิน ${shop.booking.daysAhead} วัน`, `You can book up to ${shop.booking.daysAhead} days ahead.`);
    }
    if (!rangesFor(date).length) fail(400, "closed_day", "วันนั้นร้านหยุด", "We're closed that day.");
  }

  /* ------------------------------------------------------------------ tables */
  const active = (b) => b.status !== "cancelled" && b.status !== "no-show";
  async function readAll(prefix) {
    const keys = await store.list(prefix);
    const items = await Promise.all(keys.map((k) => store.get(k)));
    return items.filter(Boolean);
  }
  // Every time a table can be booked on a date, with the seats still free.
  function slotsFor(date, bookings) {
    const b = shop.booking;
    const t = shopNow();
    const out = [];
    rangesFor(date).forEach(([open, close]) => {
      for (let m = toMin(open); m <= toMin(close) - b.lastSeatingMinutes; m += b.slotMinutes) {
        if (date === t.date && m < t.minutes + b.leadMinutes) continue; // too soon, or already gone
        // A party sits for seatMinutes, so it uses seats in every slot it overlaps.
        let busiest = 0;
        for (let s = m; s < m + b.seatMinutes; s += b.slotMinutes) {
          const used = bookings.filter(active).reduce((sum, x) => {
            const start = toMin(x.time);
            return start <= s && s < start + b.seatMinutes ? sum + x.party : sum;
          }, 0);
          busiest = Math.max(busiest, used);
        }
        out.push({ time: toHHMM(m), free: Math.max(0, b.seats - busiest) });
      }
    });
    return out;
  }

  /* ---------------------------------------------------------- shared helpers */
  function person(body) {
    const name = clean(body.name, 40);
    const digits = String(body.phone == null ? "" : body.phone).replace(/\D/g, "");
    if (name.length < 1) fail(400, "bad_name", "กรุณาใส่ชื่อ", "Please enter a name.");
    if (digits.length < 9 || digits.length > 15) fail(400, "bad_phone", "กรุณาใส่เบอร์โทรให้ถูกต้อง", "Please enter a valid phone number.");
    return { name, phone: digits, note: clean(body.note, 200), lang: body.lang === "en" ? "en" : "th" };
  }
  async function newCode() {
    for (let i = 0; i < 6; i++) {
      const bytes = crypto.randomBytes(6);
      const code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
      if (!(await store.get(`code/${code}`))) return code;
    }
    fail(503, "busy", "ระบบไม่ว่าง ลองใหม่อีกครั้ง", "The system is busy. Please try again.");
  }
  // The visitor's address is only kept as a salted hash, and only for an hour.
  const visitor = (ip) => crypto.createHash("sha256").update(`${adminKey || "local"}|${ip || "unknown"}`).digest("hex").slice(0, 24);
  const hourStamp = () => Math.floor(now().getTime() / 3600000);
  async function limit(kind, ip, max) {
    const key = `rate/${hourStamp()}/${kind}/${visitor(ip)}`;
    const seen = (await store.get(key)) || { n: 0 };
    if (seen.n >= max) fail(429, "slow_down", "ทำรายการบ่อยเกินไป กรุณาลองใหม่ภายหลังหรือทักไลน์ร้าน", "Too many requests. Please try later, or message the shop on LINE.");
    await store.set(key, { n: seen.n + 1 });
  }
  const publicView = (r) => (r.type === "table"
    ? { type: r.type, code: r.code, status: r.status, date: r.date, time: r.time, party: r.party, name: r.name }
    : { type: r.type, code: r.code, status: r.status, date: r.date, time: r.time, name: r.name, total: r.total, items: r.items });

  async function findByCode(body) {
    const code = clean(body.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const digits = String(body.phone == null ? "" : body.phone).replace(/\D/g, "");
    const miss = () => fail(404, "not_found", "ไม่พบรายการ กรุณาตรวจรหัสและเบอร์โทร", "We couldn't find that. Please check the code and phone number.");
    if (code.length < 4 || digits.length < 4) miss();
    const index = await store.get(`code/${code}`);
    const record = index && (await store.get(index.key));
    // The phone number is the second half of the "password": the last 4 digits must match.
    if (!record || record.phone.slice(-4) !== digits.slice(-4)) miss();
    return { key: index.key, record };
  }

  /* ------------------------------------------------------------------ routes */
  const routes = {
    "GET /health": async () => ({ ok: true, booking: !!shop.booking.enabled, orders: !!shop.orders.enabled }),

    "GET /availability": async ({ query }) => {
      if (!shop.booking.enabled) fail(404, "off", "ปิดรับจองออนไลน์", "Online booking is off.");
      checkDate(query.date);
      const party = Math.max(1, Math.min(shop.booking.maxParty, parseInt(query.party, 10) || 2));
      const slots = slotsFor(query.date, await readAll(`table/${query.date}/`));
      return { date: query.date, party, slots: slots.map((s) => ({ time: s.time, available: s.free >= party })) };
    },

    "POST /bookings": async ({ body, ip }) => {
      if (!shop.booking.enabled) fail(404, "off", "ปิดรับจองออนไลน์", "Online booking is off.");
      if (body.website) fail(400, "bad_request", "ส่งข้อมูลไม่สำเร็จ", "That didn't go through."); // hidden field: only bots fill it
      checkDate(body.date);
      const party = parseInt(body.party, 10);
      if (!(party >= 1 && party <= shop.booking.maxParty)) {
        fail(400, "bad_party", `จองออนไลน์ได้ 1–${shop.booking.maxParty} ท่าน กลุ่มใหญ่กว่านี้ทักไลน์ร้านได้เลย`, `Online booking is for 1–${shop.booking.maxParty} guests. For bigger groups, message us on LINE.`);
      }
      if (!isTime(body.time)) fail(400, "bad_time", "กรุณาเลือกเวลา", "Please choose a time.");
      const who = person(body);
      await limit("write", ip, WRITES_PER_HOUR);
      const slot = slotsFor(body.date, await readAll(`table/${body.date}/`)).find((s) => s.time === body.time);
      if (!slot) fail(409, "no_slot", "เวลานั้นจองไม่ได้ กรุณาเลือกเวลาอื่น", "That time can't be booked. Please pick another.");
      if (slot.free < party) fail(409, "full", "เวลานั้นเต็มแล้ว กรุณาเลือกเวลาอื่น", "That time is full. Please pick another.");
      const code = await newCode();
      const record = { type: "table", code, status: "confirmed", date: body.date, time: body.time, party, ...who, createdAt: now().toISOString() };
      const key = `table/${body.date}/${code}`;
      await store.set(key, record);
      await store.set(`code/${code}`, { key });
      return { booking: publicView(record) };
    },

    "POST /orders": async ({ body, ip }) => {
      if (!shop.orders.enabled) fail(404, "off", "ปิดรับสั่งออนไลน์", "Online ordering is off.");
      if (body.website) fail(400, "bad_request", "ส่งข้อมูลไม่สำเร็จ", "That didn't go through.");
      const t = shopNow();
      const date = body.date || t.date;
      checkDate(date);
      if (!isTime(body.time)) fail(400, "bad_time", "กรุณาบอกเวลามารับ", "Please give a pickup time.");
      const m = toMin(body.time);
      if (!rangesFor(date).some(([a, b]) => m >= toMin(a) && m <= toMin(b))) fail(400, "closed_time", "เวลานั้นร้านปิด", "We're closed at that time.");
      if (date === t.date && m < t.minutes + shop.orders.leadMinutes) {
        fail(400, "too_soon", `กรุณาเผื่อเวลาเตรียมอย่างน้อย ${shop.orders.leadMinutes} นาที`, `Please allow at least ${shop.orders.leadMinutes} minutes to prepare it.`);
      }
      if (!Array.isArray(body.items) || !body.items.length || body.items.length > 20) fail(400, "bad_items", "รายการไม่ถูกต้อง", "The order is empty or too long.");
      // Prices come from the shop's menu, never from the visitor.
      const items = body.items.map((line) => {
        const item = shop.menu.find((x) => x.en === line.item);
        if (!item) fail(400, "unknown_item", "มีรายการที่ไม่อยู่ในเมนู", "Something in the order isn't on the menu.");
        const qty = parseInt(line.qty, 10);
        if (!(qty >= 1 && qty <= 20)) fail(400, "bad_qty", "จำนวนไม่ถูกต้อง", "A quantity isn't valid.");
        const two = typeof item.price !== "number";
        const variant = two ? (line.variant === "iced" ? "iced" : "hot") : "";
        const unit = two ? item.price[variant] : item.price;
        return { en: item.en, th: item.th, qty, variant, unit, sum: unit * qty };
      });
      const who = person(body);
      await limit("write", ip, WRITES_PER_HOUR);
      const code = await newCode();
      const record = {
        type: "order", code, status: "new", date, time: body.time, items, total: items.reduce((sum, l) => sum + l.sum, 0),
        ...who, createdAt: now().toISOString(),
      };
      const key = `order/${date}/${code}`;
      await store.set(key, record);
      await store.set(`code/${code}`, { key });
      return { order: publicView(record) };
    },

    "GET /lookup": async ({ query }) => ({ found: publicView((await findByCode(query)).record) }),

    "POST /cancel": async ({ body }) => {
      const { key, record } = await findByCode(body);
      if (["done", "seated", "ready", "no-show"].includes(record.status)) {
        fail(409, "too_late", "รายการนี้ยกเลิกออนไลน์ไม่ได้แล้ว กรุณาติดต่อร้าน", "This can no longer be cancelled online. Please contact the shop.");
      }
      record.status = "cancelled";
      record.cancelledAt = now().toISOString();
      await store.set(key, record);
      return { found: publicView(record) };
    },

    "GET /admin/day": async ({ query }) => {
      const date = isDate(query.date) ? query.date : shopNow().date;
      await purge();
      const byTime = (a, b) => (a.time + a.createdAt).localeCompare(b.time + b.createdAt);
      const tables = (await readAll(`table/${date}/`)).sort(byTime);
      const orders = (await readAll(`order/${date}/`)).sort(byTime);
      return {
        date, today: shopNow().date, shop: shop.name, seats: shop.booking.seats,
        open: rangesFor(date),
        tables, orders,
        summary: {
          guests: tables.filter(active).reduce((n, b) => n + b.party, 0),
          bookings: tables.filter(active).length,
          orders: orders.filter((o) => o.status !== "cancelled").length,
          revenue: orders.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.total, 0),
        },
      };
    },

    "POST /admin/status": async ({ body }) => {
      const index = await store.get(`code/${clean(body.code, 12).toUpperCase()}`);
      const record = index && (await store.get(index.key));
      if (!record) fail(404, "not_found", "ไม่พบรายการ", "Not found.");
      const allowed = record.type === "table" ? TABLE_STATUS : ORDER_STATUS;
      if (!allowed.includes(body.status)) fail(400, "bad_status", "สถานะไม่ถูกต้อง", "That status isn't valid.");
      record.status = body.status;
      record.updatedAt = now().toISOString();
      await store.set(index.key, record);
      return { record };
    },
  };

  // Delete what is older than KEEP_DAYS, at most once a day (runs when staff open the dashboard).
  async function purge() {
    const today = shopNow().date;
    const meta = await store.get("meta/purge");
    if (meta && meta.date === today) return;
    await store.set("meta/purge", { date: today });
    const cutoff = addDays(today, -KEEP_DAYS);
    for (const prefix of ["table/", "order/"]) {
      for (const key of await store.list(prefix)) {
        const [, date, code] = key.split("/");
        if (date < cutoff) { await store.delete(key); await store.delete(`code/${code}`); }
      }
    }
    const hour = hourStamp();
    for (const key of await store.list("rate/")) {
      if (parseInt(key.split("/")[1], 10) < hour) await store.delete(key);
    }
  }

  function isAdmin(key) {
    if (!adminKey || typeof key !== "string") return false;
    const a = crypto.createHash("sha256").update(key).digest();
    const b = crypto.createHash("sha256").update(adminKey).digest();
    return crypto.timingSafeEqual(a, b); // same time whether the key is nearly right or not
  }

  // One request in, { status, body } out.
  return async function handle({ method, path, query = {}, body = {}, ip = "", key = "" }) {
    try {
      const route = routes[`${method} ${path}`];
      if (!route) fail(404, "no_route", "ไม่พบหน้านี้", "Not found.");
      if (path.startsWith("/admin/")) {
        if (!isAdmin(key)) {
          await limit("admin", ip, ADMIN_TRIES_PER_HOUR);
          fail(401, "unauthorized", "รหัสพนักงานไม่ถูกต้อง", "The staff key isn't right.");
        }
      }
      if (body === null || typeof body !== "object" || Array.isArray(body)) fail(400, "bad_request", "ข้อมูลไม่ถูกต้อง", "Bad request.");
      return { status: 200, body: await route({ query, body, ip }) };
    } catch (err) {
      if (err instanceof ApiError) return { status: err.status, body: { error: err.code, message: { th: err.th, en: err.en } } };
      console.error("[api]", err);
      return { status: 500, body: { error: "server", message: { th: "ระบบขัดข้อง กรุณาลองใหม่หรือทักไลน์ร้าน", en: "Something went wrong. Please try again, or message the shop on LINE." } } };
    }
  };
}

// A store that lives in memory: for the local server and the tests.
export function memoryStore() {
  const data = new Map();
  return {
    async get(key) { return data.has(key) ? JSON.parse(data.get(key)) : null; },
    async set(key, value) { data.set(key, JSON.stringify(value)); },
    async delete(key) { data.delete(key); },
    async list(prefix) { return Array.from(data.keys()).filter((k) => k.startsWith(prefix)).sort(); },
    clear() { data.clear(); },
  };
}
