/* =============================================================================
   hours.js — "Open now / Closes at 18:00", worked out from config.hours.
   -----------------------------------------------------------------------------
   Pure functions (no DOM), so they can be tested in Node:
     node --test tools/tests/hours.test.mjs

   The trick: the visitor's phone might be set to another time zone (a tourist,
   or a laptop on UTC). We always calculate in the SHOP's time zone with Intl,
   so "open now" is correct wherever the visitor is.
   ========================================================================== */
(function (root) {
  "use strict";

  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const SOON_MINUTES = 60; // "closing soon" in the last hour

  // The date and time *in the shop's time zone* for a given moment.
  function localParts(date, timeZone) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    const p = {};
    fmt.formatToParts(date).forEach((x) => (p[x.type] = x.value));
    return {
      dayIndex: WEEKDAY_INDEX[p.weekday],          // 0 = Monday … 6 = Sunday
      minutes: (+p.hour % 24) * 60 + +p.minute,    // minutes since local midnight
      ymd: `${p.year}-${p.month}-${p.day}`,
    };
  }

  const toMin = (hhmm) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const toHHMM = (min) => {
    const m = ((min % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  };

  // "2026-11-06" + n days, computed in UTC so daylight-saving can't shift it.
  function addDays(ymd, n) {
    const d = new Date(ymd + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  /* Build the opening periods from yesterday to a week ahead, measured in minutes
     from TODAY's local midnight. Example: today 07:30–18:00 → [450, 1080].
     A period that ends after midnight (18:00–02:00) simply ends past 1440.   */
  function periods(hours, now) {
    const list = [];
    const closed = new Set(hours.closedDates || []);
    for (let offset = -1; offset <= 7; offset++) {
      const dayKey = DAYS[(((now.dayIndex + offset) % 7) + 7) % 7];
      if (closed.has(addDays(now.ymd, offset))) continue;
      (hours.weekly[dayKey] || []).forEach(([open, close]) => {
        const start = offset * 1440 + toMin(open);
        let end = offset * 1440 + toMin(close);
        if (end <= start) end += 1440; // overnight, or "00:00" meaning midnight
        list.push({ start, end, offset });
      });
    }
    list.sort((a, b) => a.start - b.start);
    // Merge periods that touch (e.g. 18:00–24:00 then 00:00–02:00).
    const merged = [];
    list.forEach((p) => {
      const last = merged[merged.length - 1];
      if (last && p.start <= last.end) last.end = Math.max(last.end, p.end);
      else merged.push({ ...p });
    });
    return merged;
  }

  /* The main function. Returns for example:
       { state: "open", closesAt: "18:00", minutesLeft: 95, todayKey: "fri" }
       { state: "closed", opensAt: "07:30", opensInDays: 1, opensDayKey: "sat", todayKey: "fri" }
     state is "open", "closing-soon", "closed" or "unknown" (no hours set).   */
  function getStatus(hours, date = new Date()) {
    const now = localParts(date, hours.timeZone || "Asia/Bangkok");
    const todayKey = DAYS[now.dayIndex];
    const list = periods(hours, now);
    if (!list.length) return { state: "unknown", todayKey };

    const current = list.find((p) => p.start <= now.minutes && now.minutes < p.end);
    if (current) {
      const minutesLeft = current.end - now.minutes;
      return {
        state: minutesLeft <= SOON_MINUTES ? "closing-soon" : "open",
        closesAt: toHHMM(current.end),
        minutesLeft,
        todayKey,
      };
    }
    const next = list.find((p) => p.start > now.minutes);
    if (!next) return { state: "closed", todayKey };
    const opensInDays = Math.floor(next.start / 1440);
    return {
      state: "closed",
      opensAt: toHHMM(next.start),
      opensInDays,
      opensDayKey: DAYS[(now.dayIndex + opensInDays) % 7],
      todayKey,
    };
  }

  const DAY_TH = { mon: "จันทร์", tue: "อังคาร", wed: "พุธ", thu: "พฤหัสบดี", fri: "ศุกร์", sat: "เสาร์", sun: "อาทิตย์" };
  const DAY_EN = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

  // Turn a status into short text in both languages: { th: "…", en: "…" }.
  function describe(s) {
    if (s.state === "open") return { th: `เปิดอยู่ · ปิด ${s.closesAt} น.`, en: `Open now · Closes at ${s.closesAt}` };
    if (s.state === "closing-soon") return { th: `ใกล้ปิดแล้ว · ปิด ${s.closesAt} น.`, en: `Closing soon · Closes at ${s.closesAt}` };
    if (s.state === "closed" && s.opensAt) {
      if (s.opensInDays === 0) return { th: `ปิดอยู่ · เปิด ${s.opensAt} น.`, en: `Closed · Opens at ${s.opensAt}` };
      if (s.opensInDays === 1) return { th: `ปิดอยู่ · เปิดพรุ่งนี้ ${s.opensAt} น.`, en: `Closed · Opens tomorrow at ${s.opensAt}` };
      return {
        th: `ปิดอยู่ · เปิดวัน${DAY_TH[s.opensDayKey]} ${s.opensAt} น.`,
        en: `Closed · Opens ${DAY_EN[s.opensDayKey]} at ${s.opensAt}`,
      };
    }
    return null;
  }

  const api = { getStatus, describe, localParts, DAYS };
  root.ShopHours = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
