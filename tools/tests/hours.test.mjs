/* Unit tests for site/js/hours.js — run with:  node --test tools/tests/
   No browser needed: hours.js is plain logic. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getStatus, describe } = require("../../site/js/hours.js");

const week = {
  timeZone: "Asia/Bangkok",
  weekly: {
    mon: [["07:30", "18:00"]], tue: [["07:30", "18:00"]], wed: [],
    thu: [["07:30", "18:00"]], fri: [["07:30", "18:00"]],
    sat: [["08:00", "19:00"]], sun: [["08:00", "19:00"]],
  },
  closedDates: ["2026-12-31"],
};
const at = (iso) => new Date(iso);

test("open in the middle of the day", () => {
  const s = getStatus(week, at("2026-11-06T10:00:00+07:00")); // Friday
  assert.equal(s.state, "open");
  assert.equal(s.closesAt, "18:00");
  assert.equal(s.todayKey, "fri");
});

test("closing soon in the last hour", () => {
  assert.equal(getStatus(week, at("2026-11-06T17:15:00+07:00")).state, "closing-soon");
});

test("closes exactly at closing time", () => {
  const s = getStatus(week, at("2026-11-06T18:00:00+07:00"));
  assert.equal(s.state, "closed");
  assert.equal(s.opensAt, "08:00"); // Saturday
  assert.equal(s.opensInDays, 1);
});

test("closed all day Wednesday, opens Thursday", () => {
  const s = getStatus(week, at("2026-11-04T09:00:00+07:00"));
  assert.equal(s.state, "closed");
  assert.equal(s.opensDayKey, "thu");
  assert.equal(describe(s).en, "Closed · Opens tomorrow at 07:30");
});

test("before opening: opens later today", () => {
  const s = getStatus(week, at("2026-11-07T06:00:00+07:00")); // Saturday 06:00
  assert.deepEqual([s.state, s.opensAt, s.opensInDays], ["closed", "08:00", 0]);
});

test("Tuesday evening skips closed Wednesday: opens in 2 days", () => {
  const s = getStatus(week, at("2026-11-03T20:00:00+07:00"));
  assert.equal(s.opensInDays, 2);
  assert.equal(describe(s).th, "ปิดอยู่ · เปิดวันพฤหัสบดี 07:30 น.");
});

test("uses the shop's time zone, not the visitor's", () => {
  // 03:30 UTC = 10:30 in Bangkok → open, whatever the computer's own time zone is.
  assert.equal(getStatus(week, at("2026-11-06T03:30:00Z")).state, "open");
});

test("special closed date", () => {
  assert.equal(getStatus(week, at("2026-12-31T10:00:00+07:00")).state, "closed"); // a Thursday
});

test("overnight hours (bar closing at 02:00)", () => {
  const bar = { timeZone: "Asia/Bangkok", weekly: { mon: [], tue: [], wed: [], thu: [], fri: [["18:00", "02:00"]], sat: [], sun: [] } };
  const s = getStatus(bar, at("2026-11-07T00:30:00+07:00")); // Saturday 00:30, still Friday's night
  assert.equal(s.state, "open");
  assert.equal(s.closesAt, "02:00");
});

test("split day (lunch break)", () => {
  const split = { timeZone: "Asia/Bangkok", weekly: { mon: [["07:00", "11:00"], ["13:00", "18:00"]], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } };
  const s = getStatus(split, at("2026-11-02T12:00:00+07:00")); // Monday lunch
  assert.deepEqual([s.state, s.opensAt], ["closed", "13:00"]);
});

test("no hours at all → unknown", () => {
  const none = { weekly: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } };
  assert.equal(getStatus(none, new Date()).state, "unknown");
  assert.equal(describe({ state: "unknown" }), null);
});
