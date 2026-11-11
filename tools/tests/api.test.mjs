/* tools/tests/api.test.mjs — the booking + order rules (backend/core.mjs).
     node --test tools/tests/api.test.mjs
   No browser and no network: the same code that runs on Netlify, with an
   in-memory store and a clock fixed to Thursday 12 Nov 2026, 10:00 Bangkok.  */
import test from "node:test";
import assert from "node:assert/strict";
import { createApi, memoryStore } from "../../backend/core.mjs";
import shop from "../../backend/shop.generated.mjs";

const THU = "2026-11-12"; // open 07:30–18:00
const WED = "2026-11-18"; // closed
function setup(at = `${THU}T10:00:00+07:00`) {
  const store = memoryStore();
  const clock = { now: new Date(at) };
  const api = createApi({ shop, store, adminKey: "staff-secret", now: () => clock.now });
  const get = (path, query = {}, extra = {}) => api({ method: "GET", path, query, ...extra });
  const post = (path, body = {}, extra = {}) => api({ method: "POST", path, body, ip: "1.1.1.1", ...extra });
  return { store, clock, api, get, post };
}
const guest = { name: "Mali", phone: "081-234-5678" };
const book = (t, over = {}) => t.post("/bookings", { date: THU, time: "12:00", party: 2, ...guest, ...over });

test("health says what is switched on", async () => {
  const t = setup();
  assert.deepEqual((await t.get("/health")).body, { ok: true, booking: true, orders: true });
});

test("availability: slots follow opening hours, lead time and last seating", async () => {
  const t = setup();
  const { body } = await t.get("/availability", { date: THU, party: "2" });
  const times = body.slots.map((s) => s.time);
  assert.equal(times[0], "10:30", "first slot is at least 30 minutes from now");
  assert.equal(times.at(-1), "17:00", "last seating is 60 minutes before closing");
  assert.ok(body.slots.every((s) => s.available));
  const tomorrow = await t.get("/availability", { date: "2026-11-13", party: "2" });
  assert.equal(tomorrow.body.slots[0].time, "07:30", "another day starts at opening time");
});

test("availability refuses closed days, past days and days too far ahead", async () => {
  const t = setup();
  assert.equal((await t.get("/availability", { date: WED })).body.error, "closed_day");
  assert.equal((await t.get("/availability", { date: "2026-11-11" })).body.error, "past_date");
  assert.equal((await t.get("/availability", { date: "2026-12-20" })).body.error, "too_far");
  assert.equal((await t.get("/availability", { date: "12/11/2026" })).body.error, "bad_date");
  assert.equal((await t.get("/availability", { date: "2026-12-31" })).body.error, "too_far");
});

test("a booking is confirmed with a code and only public fields come back", async () => {
  const t = setup();
  const { status, body } = await book(t, { note: "window seat <b>please</b>" });
  assert.equal(status, 200);
  assert.match(body.booking.code, /^[A-Z2-9]{6}$/);
  assert.equal(body.booking.status, "confirmed");
  assert.equal(body.booking.phone, undefined, "the phone number is not echoed back");
  const saved = await t.store.get(`table/${THU}/${body.booking.code}`);
  assert.equal(saved.phone, "0812345678");
  assert.ok(!/[<>]/.test(saved.note), "angle brackets are stripped from notes");
});

test("seats run out: 16 seats, parties overlap for 90 minutes", async () => {
  const t = setup();
  for (let i = 0; i < 2; i++) assert.equal((await book(t, { party: 6, phone: `08100000${i}0` }, )).status, 200);
  assert.equal((await book(t, { party: 4, phone: "0810000099" })).status, 200); // 16 of 16 at 12:00
  const full = await book(t, { party: 1, phone: "0810000098" });
  assert.equal(full.status, 409);
  assert.equal(full.body.error, "full");
  // 13:00 overlaps the 12:00 sittings (12:00–13:30), 13:30 does not.
  const slots = (await t.get("/availability", { date: THU, party: "2" })).body.slots;
  const at = (time) => slots.find((s) => s.time === time).available;
  assert.equal(at("11:00"), false, "11:00 would still be seated at 12:00");
  assert.equal(at("13:00"), false);
  assert.equal(at("13:30"), true);
  assert.equal(at("10:30"), true);
});

test("bad bookings are refused with a message in both languages", async () => {
  const t = setup();
  const cases = [
    [{ party: 7 }, "bad_party"], [{ party: 0 }, "bad_party"], [{ time: "25:00" }, "bad_time"], [{ time: "10:00" }, "no_slot"],
    [{ time: "17:30" }, "no_slot"], [{ name: "" }, "bad_name"], [{ phone: "12345" }, "bad_phone"], [{ date: WED }, "closed_day"],
    [{ website: "http://spam" }, "bad_request"],
  ];
  for (const [over, code] of cases) {
    const r = await book(t, over);
    assert.equal(r.body.error, code, JSON.stringify(over));
    assert.ok(r.body.message.th && r.body.message.en);
  }
  assert.equal((await t.store.list("table/")).length, 0, "nothing was saved");
});

test("orders: the server prices the order from the menu", async () => {
  const t = setup();
  const { status, body } = await t.post("/orders", {
    time: "15:00", ...guest,
    items: [{ item: "House Latte", qty: 2, variant: "iced", price: 1 }, { item: "Basque Cheesecake", qty: 1 }, { item: "Americano", qty: 1 }],
  });
  assert.equal(status, 200);
  assert.equal(body.order.total, 2 * 85 + 135 + 65, "iced 85, cheesecake 135, americano defaults to hot 65");
  assert.equal(body.order.status, "new");
  assert.equal(body.order.date, THU);
});

test("bad orders are refused", async () => {
  const t = setup();
  const ok = { time: "15:00", ...guest, items: [{ item: "Espresso", qty: 1 }] };
  const cases = [
    [{ items: [{ item: "Unicorn Frappe", qty: 1 }] }, "unknown_item"], [{ items: [] }, "bad_items"], [{ items: [{ item: "Espresso", qty: 99 }] }, "bad_qty"],
    [{ time: "19:00" }, "closed_time"], [{ time: "10:05" }, "too_soon"], [{ time: "" }, "bad_time"], [{ phone: "" }, "bad_phone"], [{ date: WED }, "closed_day"],
  ];
  for (const [over, code] of cases) assert.equal((await t.post("/orders", { ...ok, ...over })).body.error, code, JSON.stringify(over));
});

test("lookup and cancel need the code and the phone's last 4 digits", async () => {
  const t = setup();
  const code = (await book(t)).body.booking.code;
  assert.equal((await t.get("/lookup", { code, phone: "0000000000" })).status, 404);
  assert.equal((await t.get("/lookup", { code: "ZZZZZZ", phone: guest.phone })).status, 404);
  const found = await t.get("/lookup", { code: code.toLowerCase(), phone: "5678" });
  assert.equal(found.body.found.status, "confirmed");
  assert.equal((await t.post("/cancel", { code, phone: "0000" })).status, 404);
  assert.equal((await t.post("/cancel", { code, phone: guest.phone })).body.found.status, "cancelled");
});

test("a cancelled booking frees its seats", async () => {
  const t = setup();
  const first = (await book(t, { party: 6 })).body.booking.code;
  await book(t, { party: 6, phone: "0811111111" });
  await book(t, { party: 4, phone: "0822222222" });
  assert.equal((await book(t, { party: 2, phone: "0833333333" })).body.error, "full");
  await t.post("/cancel", { code: first, phone: guest.phone });
  assert.equal((await book(t, { party: 2, phone: "0833333333" })).status, 200);
});

test("staff routes need the key; the day view lists and totals everything", async () => {
  const t = setup();
  const b = (await book(t)).body.booking.code;
  await t.post("/orders", { time: "15:00", ...guest, items: [{ item: "Espresso", qty: 2 }] });
  assert.equal((await t.get("/admin/day", {}, { key: "" })).status, 401);
  assert.equal((await t.get("/admin/day", {}, { key: "wrong" })).status, 401);
  const day = (await t.get("/admin/day", {}, { key: "staff-secret" })).body;
  assert.equal(day.date, THU);
  assert.deepEqual(day.summary, { guests: 2, bookings: 1, orders: 1, revenue: 120 });
  assert.equal(day.tables[0].phone, "0812345678", "staff see the phone number");
  const moved = await t.post("/admin/status", { code: b, status: "seated" }, { key: "staff-secret" });
  assert.equal(moved.body.record.status, "seated");
  assert.equal((await t.post("/admin/status", { code: b, status: "ready" }, { key: "staff-secret" })).body.error, "bad_status");
  assert.equal((await t.post("/cancel", { code: b, phone: guest.phone })).body.error, "too_late", "a seated booking can't be cancelled online");
});

test("too many wrong staff keys from one visitor are blocked", async () => {
  const t = setup();
  for (let i = 0; i < 10; i++) assert.equal((await t.get("/admin/day", {}, { key: "guess" + i, ip: "9.9.9.9" })).status, 401);
  assert.equal((await t.get("/admin/day", {}, { key: "guess", ip: "9.9.9.9" })).status, 429);
  assert.equal((await t.get("/admin/day", {}, { key: "staff-secret", ip: "9.9.9.9" })).status, 200, "the right key still works");
});

test("one visitor can make 6 bookings/orders an hour, then is asked to wait", async () => {
  const t = setup();
  const times = ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00"];
  for (let i = 0; i < 6; i++) assert.equal((await book(t, { time: times[i], party: 1 })).status, 200);
  assert.equal((await book(t, { time: times[6], party: 1 })).status, 429);
  assert.equal((await book(t, { time: times[6], party: 1 }, )).status, 429);
  assert.equal((await t.api({ method: "POST", path: "/bookings", body: { date: THU, time: "14:00", party: 1, ...guest }, ip: "2.2.2.2" })).status, 200, "another visitor is not affected");
  t.clock.now = new Date(`${THU}T11:01:00+07:00`);
  assert.equal((await book(t, { time: "15:00", party: 1 })).status, 200, "the limit resets the next hour");
  assert.ok(!(await t.store.list("rate/")).some((k) => k.includes("1.1.1.1")), "addresses are stored only as hashes");
});

test("records older than 30 days are deleted when staff open the dashboard", async () => {
  const t = setup();
  const code = (await book(t)).body.booking.code;
  t.clock.now = new Date("2026-12-11T10:00:00+07:00"); // 29 days later
  await t.get("/admin/day", {}, { key: "staff-secret" });
  assert.ok(await t.store.get(`table/${THU}/${code}`), "kept at 29 days");
  t.clock.now = new Date("2026-12-13T10:00:00+07:00"); // 31 days later
  await t.get("/admin/day", {}, { key: "staff-secret" });
  assert.equal(await t.store.get(`table/${THU}/${code}`), null);
  assert.equal(await t.store.get(`code/${code}`), null);
});

test("unknown routes and broken bodies do not crash", async () => {
  const t = setup();
  assert.equal((await t.get("/nope")).status, 404);
  assert.equal((await t.api({ method: "POST", path: "/bookings", body: null })).status, 400);
  assert.equal((await t.api({ method: "POST", path: "/bookings", body: [] })).status, 400);
});
