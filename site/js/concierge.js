/* =============================================================================
   concierge.js — the voice concierge: a visitor taps a button and talks to the
   shop in Thai or English. It answers out loud, and the PAGE reacts while it
   talks (highlights a dish, opens the map, switches language, builds a
   pre-order to send on LINE).
   -----------------------------------------------------------------------------
   It is free and has no server, no account and no API key:
     • hearing  = the browser's own speech recognition (Chrome, Edge, Safari),
     • speaking = the browser's own voices,
     • thinking = the small rule-based "brain" in section 5, which only knows
       what is in config.js (menu, prices, hours, directions, your FAQ).
   So it never invents a price, but it is not a chatbot: it understands
   questions about the shop and pre-orders, and says so when it doesn't.
   Browsers without speech recognition (e.g. Firefox) get the same assistant
   as a text chat. Nothing is ordered automatically: the order card ends with
   a "Send on LINE" button the visitor taps themselves.
   Contents
     1. Setup + strings          5. The brain (understand + answer)
     2. Menu catalog + matching  6. Voice (listen + speak)
     3. Panel (the UI)           7. Wiring
     4. Page actions + order
   ========================================================================== */
(function () {
  "use strict";

  const C = window.SHOP_CONFIG;
  const R = window.ShopRender;
  const H = window.ShopHours;
  const cfg = C && C.concierge;
  if (!C || !R || !H || !cfg || !cfg.enabled) return;

  const html = document.documentElement;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const lang = () => (html.lang === "en" ? "en" : "th");
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  const shop = R.both(C.business.name);
  const me = R.both(cfg.agentName || { th: "ผู้ช่วยของร้าน", en: "the cafe assistant" });

  /* ------------------------------------------------------------- 1. Strings */
  const T = {
    launch: { th: "คุยกับร้าน", en: "Talk to us" },
    title: { th: "ผู้ช่วยของร้าน", en: "Cafe concierge" },
    close: { th: "ปิด", en: "Close" },
    intro: {
      th: "ถามเรื่องเมนู เวลาเปิด-ปิด เส้นทาง หรือสั่งล่วงหน้าได้เลย พูดหรือพิมพ์ก็ได้",
      en: "Ask about the menu, opening hours or directions, or start a pre-order. Speak or type.",
    },
    consent: {
      th: "ผู้ช่วยอัตโนมัติ ไม่ใช่พนักงาน เมื่อใช้เสียง เบราว์เซอร์ของคุณจะแปลงเสียงเป็นข้อความ (อาจส่งเสียงไปยังผู้ให้บริการเบราว์เซอร์ เช่น Google หรือ Apple) ร้านไม่ได้บันทึกเสียงไว้",
      en: "An automated assistant, not a person. With voice, your browser turns speech into text (it may send audio to the browser's provider, such as Google or Apple). The shop keeps no recording.",
    },
    start: { th: "เริ่มพูด", en: "Start talking" },
    startText: { th: "พิมพ์แทน", en: "Type instead" },
    noVoice: { th: "เบราว์เซอร์นี้ไม่รองรับการพูด พิมพ์ถามได้เลย", en: "This browser can't listen, so please type." },
    micBlocked: { th: "ใช้ไมโครโฟนไม่ได้ พิมพ์ถามได้เลย", en: "The microphone isn't available, so please type." },
    listening: { th: "กำลังฟังอยู่ พูดได้เลย", en: "Listening, go ahead" },
    speaking: { th: "กำลังพูด", en: "Speaking" },
    idle: { th: "แตะไมค์เพื่อพูด หรือพิมพ์", en: "Tap the mic to talk, or type" },
    textMode: { th: "พิมพ์ถามได้เลย", en: "Type your question" },
    placeholder: { th: "พิมพ์ข้อความ…", en: "Type a message…" },
    send: { th: "ส่ง", en: "Send" },
    mic: { th: "พูด", en: "Talk" },
    micStop: { th: "หยุดฟัง", en: "Stop listening" },
    soundOn: { th: "เสียงตอบ: เปิด", en: "Voice replies: on" },
    soundOff: { th: "เสียงตอบ: ปิด", en: "Voice replies: off" },
    order: { th: "รายการสั่งล่วงหน้า", en: "Your pre-order" },
    total: { th: "รวม", en: "Total" },
    pickup: { th: "รับที่ร้าน", en: "Pickup" },
    name: { th: "ชื่อ", en: "Name" },
    sendLine: { th: "ส่งทางไลน์", en: "Send on LINE" },
    copyOrder: { th: "คัดลอก", en: "Copy" },
    copied: { th: "คัดลอกแล้ว", en: "Copied" },
    notSent: {
      th: "ยังไม่ได้ส่ง กดปุ่มเพื่อส่งรายการให้ร้านทางไลน์",
      en: "Not sent yet. Tap the button to send this to the shop on LINE.",
    },
    hot: { th: "ร้อน", en: "hot" },
    iced: { th: "เย็น", en: "iced" },
    you: { th: "คุณ", en: "You" },
    chips: [
      { th: "แนะนำเมนูหน่อย", en: "What do you recommend?" },
      { th: "ตอนนี้เปิดไหม", en: "Are you open now?" },
      { th: "ไปร้านยังไง", en: "How do I get there?" },
      { th: "สั่งล่วงหน้า", en: "Pre-order" },
    ],
  };

  /* -------------------------------------------- 2. Menu catalog + matching */
  // Keep letters, digits and Thai vowel/tone marks; drop spaces and punctuation.
  const norm = (s) => String(s || "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\p{M}]+/gu, "");
  // Words too general to identify one menu item on their own.
  const WEAK = new Set(["ไทย", "ร้อน", "เย็น", "ใหม่", "สด", "นม", "น้ำ", "เนย", "บ้าน", "hot", "iced", "ice", "the", "and", "with", "fresh", "cream", "house"].map(norm));
  const thaiWords = (() => {
    try {
      const seg = new Intl.Segmenter("th", { granularity: "word" });
      return (s) => Array.from(seg.segment(s)).filter((p) => p.isWordLike).map((p) => p.segment);
    } catch (e) {
      return (s) => [s]; // very old browser: only full names match
    }
  })();

  // One flat list of everything on the menu, built from config.js, so the
  // prices the assistant says always match the prices printed on the page.
  const catalog = [];
  const addItem = (it, category, where) => {
    const n = R.both(it.name);
    const known = catalog.find((c) => c.en === n.en);
    if (known) return known;
    const words = thaiWords(n.th).concat(n.en.split(/[^A-Za-z]+/), it.aliases || []).map(norm).filter((w) => w.length >= 3 && !WEAK.has(w));
    const item = {
      th: n.th, en: n.en, category, where, price: it.price, badges: it.badges || [], desc: it.desc ? R.both(it.desc) : null,
      full: [norm(n.th), norm(n.en)],
      // Thai has no spaces, so Thai words match anywhere; English words must be whole words ("tea", not "steady").
      words: Array.from(new Set(words)).map((w) => ({ w, re: /^[a-z]+$/.test(w) ? new RegExp(`\\b${w}(s|es)?\\b`) : null })),
    };
    catalog.push(item);
    return item;
  };
  C.menu.categories.forEach((cat) => cat.items.forEach((it) => addItem(it, cat.id, "menu")));
  ((C.signature && C.signature.items) || []).forEach((it) => {
    const item = addItem(it, "signature", "signature");
    if (!item.desc && it.desc) item.desc = R.both(it.desc);
  });

  // Best menu item mentioned in a piece of text, or null. A full name beats
  // single words; on a tie the bestseller, then the earlier menu item, wins.
  function findItem(text) {
    const q = norm(text);
    const plain = String(text || "").toLowerCase();
    if (!q) return null;
    let best = null;
    let bestScore = 0;
    catalog.forEach((item) => {
      let score = 0;
      if (item.full.some((f) => f && q.includes(f))) score = 100 + item.full[0].length;
      else item.words.forEach(({ w, re }) => { if (re ? re.test(plain) : q.includes(w)) score += w.length; });
      if (score && item.badges.includes("bestseller")) score += 0.5;
      if (score > bestScore) { best = item; bestScore = score; }
    });
    return bestScore >= 3 ? best : null;
  }
  const twoPrices = (item) => typeof item.price !== "number";
  const unitPrice = (item, variant) => (twoPrices(item) ? item.price[variant === "iced" ? "iced" : "hot"] : item.price);

  /* ----------------------------------------------------------- 3. The panel */
  const el = (tag, cls, inner) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (inner !== undefined) node.innerHTML = inner;
    return node;
  };
  const icon = (name) => `<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
  const label = (node, text) => {
    // Same pattern as the rest of the site: both languages stored, main.js swaps them.
    node.setAttribute("data-aria-label-th", text.th);
    node.setAttribute("data-aria-label-en", text.en);
    node.setAttribute("aria-label", text[lang()]);
  };
  const MIC = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>`;

  const launch = el("button", "cg-launch", `<span class="cg-launch__dot" aria-hidden="true"></span>${MIC}<span>${R.t(T.launch)}</span>`);
  launch.type = "button";
  launch.setAttribute("aria-haspopup", "dialog");
  launch.setAttribute("aria-expanded", "false");

  const panel = el("section", "cg-panel");
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  label(panel, T.title);
  panel.innerHTML =
    `<div class="cg-head">` +
      `<div class="cg-orb" aria-hidden="true"><span></span></div>` +
      `<div class="cg-head__text"><p class="cg-title">${R.t(T.title)}</p><p class="cg-status" data-cg-status role="status"></p></div>` +
      `<button type="button" class="icon-btn cg-close" data-cg-close>${icon("close")}</button>` +
    `</div>` +
    `<div class="cg-intro" data-cg-intro>` +
      `<p class="cg-intro__lead">${R.t(T.intro)}</p>` +
      `<p class="cg-intro__consent">${R.t(T.consent)}</p>` +
      `<div class="cg-intro__actions">` +
        (SR ? `<button type="button" class="btn btn--primary cg-start" data-cg-start="voice">${MIC}<span>${R.t(T.start)}</span></button>` : "") +
        `<button type="button" class="${SR ? "cg-link" : "btn btn--primary cg-start"}" data-cg-start="text">${R.t(SR ? T.startText : T.textMode)}</button>` +
      `</div>` +
      (SR ? "" : `<p class="cg-intro__consent">${R.t(T.noVoice)}</p>`) +
    `</div>` +
    `<div class="cg-live" data-cg-live hidden>` +
      `<div class="cg-scroll" data-cg-scroll tabindex="0">` +
        `<ol class="cg-log" data-cg-log aria-live="polite"></ol>` +
        `<div class="cg-order" data-cg-order hidden></div>` +
      `</div>` +
      `<div class="cg-chips" data-cg-chips></div>` +
      `<div class="cg-input">` +
        (SR ? `<button type="button" class="cg-mic" data-cg-mic aria-pressed="false">${MIC}</button>` : "") +
        `<input type="text" class="cg-input__field" data-cg-field autocomplete="off" enterkeyhint="send" maxlength="200">` +
        `<button type="button" class="cg-input__send" data-cg-send>${icon("arrow-up")}</button>` +
      `</div>` +
      (synth ? `<div class="cg-foot"><button type="button" class="cg-link" data-cg-sound aria-pressed="true"></button></div>` : "") +
    `</div>`;

  const ui = {
    status: $("[data-cg-status]", panel), intro: $("[data-cg-intro]", panel), live: $("[data-cg-live]", panel),
    scroll: $("[data-cg-scroll]", panel), log: $("[data-cg-log]", panel), order: $("[data-cg-order]", panel),
    chips: $("[data-cg-chips]", panel), field: $("[data-cg-field]", panel), send: $("[data-cg-send]", panel),
    mic: $("[data-cg-mic]", panel), sound: $("[data-cg-sound]", panel), close: $("[data-cg-close]", panel),
  };
  label(ui.close, T.close);
  label(ui.send, T.send);
  label(ui.field, T.placeholder);
  if (ui.mic) label(ui.mic, T.mic);
  T.chips.forEach((chip) => {
    const b = el("button", "cg-chip", R.t(chip));
    b.type = "button";
    b.addEventListener("click", () => ask(chip[lang()]));
    ui.chips.appendChild(b);
  });
  document.body.append(launch, panel);

  function setStatus(text, state) {
    ui.status.innerHTML = text ? R.t(text) : "";
    panel.dataset.state = state || "";
    launch.dataset.state = state || "";
  }
  function addLine(who, text) {
    if (!text) return null;
    const li = el("li", `cg-line cg-line--${who}`);
    if (who === "note") li.innerHTML = R.t(text);
    else {
      const tag = el("span", "visually-hidden");
      tag.textContent = (who === "user" ? T.you[lang()] : T.title[lang()]) + ": ";
      li.append(tag, document.createTextNode(text)); // textContent: what people say is never treated as HTML
    }
    ui.log.appendChild(li);
    while (ui.log.children.length > 40) ui.log.firstElementChild.remove();
    ui.scroll.scrollTop = ui.scroll.scrollHeight;
    return li;
  }

  /* ---------------------------------------------- 4. Page actions + order */
  // Scroll so the target sits just under the header (the panel covers the
  // bottom of a phone screen, so the top is the part the visitor can see).
  function scrollToEl(node) {
    if (!node) return;
    const top = node.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? "auto" : "smooth" });
  }
  let spotTimer;
  function spotlight(node) {
    if (!node) return;
    $$(".is-spotlit").forEach((n) => n.classList.remove("is-spotlit"));
    node.classList.add("is-in", "is-spotlit"); // is-in: make sure a scroll-reveal item is visible
    clearTimeout(spotTimer);
    spotTimer = setTimeout(() => node.classList.remove("is-spotlit"), 6000);
  }
  const enName = (node) => (($("[lang=en]", node) || node).textContent || "").trim();

  const page = {
    section(sel) {
      const node = $(sel);
      scrollToEl(node);
      if (sel === "#hours") spotlight($(".hours__table tr.is-today"));
    },
    item(item) {
      let node = null;
      if (item.where === "menu") {
        const tab = document.getElementById(`tab-${item.category}`);
        if (tab && tab.getAttribute("aria-selected") !== "true") tab.click(); // reuse main.js tabs
        node = $$(".menu-item", document.getElementById(`panel-${item.category}`) || document).find((n) => enName($(".menu-item__name", n)) === item.en);
      } else {
        node = $$(".sig-card").find((n) => enName($(".sig-card__name", n)) === item.en);
      }
      // Wait one frame so a tab that was just switched has its final layout.
      if (node) requestAnimationFrame(() => { scrollToEl(node); spotlight(node); });
    },
    map() {
      const box = $("[data-map]");
      if (!box) return page.section("#find");
      const btn = $("[data-map-load]", box);
      const focused = document.activeElement;
      if (btn && !btn.hidden) btn.click(); // reuse main.js: loads the map preview
      // main.js moves focus into the map; give it back so typing and Escape keep working.
      if (focused && panel.contains(focused)) focused.focus({ preventScroll: true });
      scrollToEl(box);
    },
    lang(next) {
      const btn = $(`[data-set-lang="${next}"]`);
      if (btn && lang() !== next) btn.click(); // reuse main.js: saves the choice, updates the page
    },
  };

  // The pre-order being built: lines of { item, qty, variant, sum }.
  let order = null;
  const baht = (n, L) => `${n} ${L === "th" ? "บาท" : "baht"}`;
  function recalc() {
    if (order && !order.lines.length) order = null;
    if (order) {
      order.lines.forEach((l) => { l.sum = unitPrice(l.item, l.variant) * l.qty; });
      order.total = order.lines.reduce((sum, l) => sum + l.sum, 0);
    }
    renderOrder();
  }
  function orderText() {
    if (!order) return "";
    const L = lang();
    return [
      L === "th" ? `สั่งล่วงหน้า ${shop.th}` : `Pre-order for ${shop.en}`,
      ...order.lines.map((l) => `${l.qty} x ${l.item[L]}${l.variant ? ` (${T[l.variant][L]})` : ""} = ${l.sum} ${L === "th" ? "บาท" : "THB"}`),
      `${T.total[L]}: ${order.total} ${L === "th" ? "บาท" : "THB"}`,
      order.pickup ? `${T.pickup[L]}: ${order.pickup}` : "",
      order.name ? `${T.name[L]}: ${order.name}` : "",
    ].filter(Boolean).join("\n");
  }
  // LINE's "message an official account with this text already typed" link.
  // The text is also copied, in case the visitor's LINE app drops the prefill.
  function lineOrderUrl() {
    const line = (C.contact && C.contact.line) || {};
    if (!line.id) return line.url || "#contact";
    return `https://line.me/R/oaMessage/${encodeURIComponent(line.id)}/?${encodeURIComponent(orderText())}`;
  }
  const copy = (text) =>
    navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(text) : Promise.reject(new Error("clipboard unavailable"));

  function renderOrder() {
    const box = ui.order;
    box.hidden = !order;
    box.textContent = "";
    if (!order) return;
    const money = (n) => R.t({ th: `${n} บาท`, en: `${n} THB` });
    const list = el("ul", "cg-order__list");
    order.lines.forEach((l) => {
      const li = el("li", "cg-order__line");
      li.append(
        el("span", "cg-order__name", `${l.qty} × ${R.t({ th: l.item.th, en: l.item.en })}${l.variant ? ` <small>${R.t(T[l.variant])}</small>` : ""}`),
        el("span", "cg-order__sum", money(l.sum))
      );
      list.appendChild(li);
    });
    box.append(el("p", "cg-order__title", R.t(T.order)), list, el("p", "cg-order__total", `<span>${R.t(T.total)}</span><strong>${money(order.total)}</strong>`));
    [[T.pickup, order.pickup], [T.name, order.name]].forEach(([k, v]) => {
      if (!v) return;
      const p = el("p", "cg-order__meta", `<span>${R.t(k)}</span>`);
      const val = el("span");
      val.textContent = v;
      p.appendChild(val);
      box.appendChild(p);
    });
    const send = el("a", "btn btn--primary cg-order__send", `${icon("chat")}<span>${R.t(T.sendLine)}</span>`);
    send.target = "_blank";
    send.rel = "noopener";
    send.href = lineOrderUrl();
    send.addEventListener("click", () => { send.href = lineOrderUrl(); copy(orderText()).catch(() => {}); });
    const copyBtn = el("button", "cg-link", R.t(T.copyOrder));
    copyBtn.type = "button";
    copyBtn.addEventListener("click", () =>
      copy(orderText()).then(() => { copyBtn.innerHTML = R.t(T.copied); setTimeout(() => { copyBtn.innerHTML = R.t(T.copyOrder); }, 1600); }).catch(() => {})
    );
    const actions = el("div", "cg-order__actions");
    actions.append(send, copyBtn);
    box.append(actions, el("p", "cg-order__hint", R.t(T.notSent)));
    ui.scroll.scrollTop = ui.scroll.scrollHeight;
  }

  /* ------------------------------------------------------------ 5. The brain
     reply(text) reads one thing the visitor said, does something on the page,
     and returns the sentence to say back. It is plain keyword matching, in
     this order: an answer still owed (hot or iced?) → the order → questions
     about one item → the shop's own FAQ (config.js) → hours, directions,
     recommendations and the rest → "I'm not sure".                           */
  const has = (text, re) => re.test(text);
  const NUM = {
    หนึ่ง: 1, นึง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9, สิบ: 10,
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  const NUM_RE = new RegExp(`(\\d{1,2})|(${Object.keys(NUM).filter((k) => /[ก-๙]/.test(k)).join("|")})|\\b(${Object.keys(NUM).filter((k) => /[a-z]/.test(k)).join("|")})\\b`, "i");
  const num = (text) => {
    const m = NUM_RE.exec(text);
    return m ? (m[1] ? parseInt(m[1], 10) : NUM[(m[2] || m[3]).toLowerCase()]) : null;
  };
  const variantOf = (text) => (has(text, /เย็น|\b(iced?|cold)\b/i) ? "iced" : has(text, /ร้อน|\bhot\b/i) ? "hot" : "");

  // "บ่ายสาม", "10 โมงครึ่ง", "3 pm", "15:30" → { h, m, rest } (rest = the text without the time).
  function takeTime(text) {
    const half = (s) => (/ครึ่ง|half/.test(s) ? 30 : 0);
    const out = (m, h, min) => ({ h, m: min, rest: text.replace(m[0], " ") });
    let m;
    if ((m = /(\d{1,2})[:.](\d{2})\s*(น\.?|นาฬิกา)?/.exec(text)) && +m[1] < 24 && +m[2] < 60) return out(m, +m[1], +m[2]);
    if ((m = /(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)/i.exec(text))) return out(m, (+m[1] % 12) + (/p/i.test(m[2]) ? 12 : 0), 0);
    if ((m = /เที่ยง(ครึ่ง)?|\bnoon\b/i.exec(text))) return out(m, 12, m[1] ? 30 : 0);
    if ((m = /บ่าย\s*(โมง|\d|หนึ่ง|สอง|สาม|สี่|ห้า)\s*(โมง)?\s*(ครึ่ง)?/.exec(text))) return out(m, 12 + (m[1] === "โมง" ? 1 : num(m[1])), half(m[0]));
    if ((m = /(\d{1,2}|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)\s*โมง\s*(เช้า|เย็น)?\s*(ครึ่ง)?/.exec(text))) {
      const n = num(m[1]);
      return out(m, m[2] === "เย็น" || (!m[2] && n <= 6) ? n + 12 : n, half(m[0]));
    }
    return null;
  }
  const pad = (n) => String(n).padStart(2, "0");
  const todayRanges = () => C.hours.weekly[H.getStatus(C.hours).todayKey] || [];
  const inHours = (h, m) => todayRanges().some(([a, b]) => `${pad(h)}:${pad(m)}` >= a && `${pad(h)}:${pad(m)}` <= b);
  const rangeText = (ranges, L) => ranges.map(([a, b]) => `${a} ${L === "th" ? "ถึง" : "to"} ${b}`).join(L === "th" ? " และ " : " and ");

  const DAY_WORDS = {
    mon: /จันทร์|monday/i, tue: /อังคาร|tuesday/i, wed: /พุธ|wednesday/i, thu: /พฤหัส|thursday/i,
    fri: /ศุกร์|friday/i, sat: /เสาร์|saturday/i, sun: /วันอาทิตย์|sunday/i,
  };
  const DAY_NAMES = {
    mon: { th: "วันจันทร์", en: "Monday" }, tue: { th: "วันอังคาร", en: "Tuesday" }, wed: { th: "วันพุธ", en: "Wednesday" },
    thu: { th: "วันพฤหัสบดี", en: "Thursday" }, fri: { th: "วันศุกร์", en: "Friday" }, sat: { th: "วันเสาร์", en: "Saturday" }, sun: { th: "วันอาทิตย์", en: "Sunday" },
  };
  // Words people use for a menu category. The category's own name from config.js always works too.
  const CATEGORY_WORDS = {
    coffee: /กาแฟ|coffee|espresso/i, "no-coffee": /ไม่(ใช่|มี|ดื่ม|กิน|เอา)กาแฟ|ชา|\btea\b|non.?coffee|no coffee|without coffee/i,
    bakery: /ขนม|ของหวาน|เบเกอรี่|bakery|pastr|dessert|sweet|cake/i, breakfast: /อาหาร|ของกิน|ของคาว|หิว|breakfast|food|\beat\b|hungry|brunch/i,
  };
  function categoryOf(text) {
    const q = norm(text);
    const ordered = C.menu.categories.slice().sort((a, b) => (b.id === "no-coffee") - (a.id === "no-coffee")); // "not coffee" before "coffee"
    return ordered.find((cat) => {
      const n = R.both(cat.name);
      return q.includes(norm(n.th)) || q.includes(norm(n.en)) || (CATEGORY_WORDS[cat.id] && CATEGORY_WORDS[cat.id].test(text));
    }) || null;
  }

  const ctx = { offer: null, pending: null, recIndex: 0 }; // what the last reply was about
  const names = (items, L) => items.map((i) => i[L]).join(L === "th" ? " " : ", ");
  const priceSay = (item, L) =>
    twoPrices(item)
      ? (L === "th" ? `ร้อน ${item.price.hot} เย็น ${item.price.iced} บาท` : `${item.price.hot} baht hot, ${item.price.iced} iced`)
      : baht(item.price, L);

  function orderSummary(L, closing) {
    const lines = order.lines.map((l) => `${l.item[L]}${l.variant ? " " + T[l.variant][L] : ""} ${l.qty}`).join(L === "th" ? " " : ", ");
    const base = L === "th" ? `ได้ค่ะ ${lines} รวม ${order.total} บาท` : `Got it: ${lines}. That's ${order.total} baht`;
    if (closing) {
      return base + (L === "th"
        ? `ค่ะ${order.pickup ? ` รับ ${order.pickup}` : ""} กดปุ่มส่งทางไลน์ในการ์ดเพื่อส่งให้ร้านได้เลยนะคะ ยังไม่ได้ส่งจนกว่าจะกดค่ะ`
        : `${order.pickup ? `, pickup ${order.pickup}` : ""}. Tap Send on LINE on the card to send it to the shop. It isn't sent until you tap.`);
    }
    if (!order.pickup) return base + (L === "th" ? "ค่ะ จะมารับกี่โมงดีคะ" : ". What time will you pick it up?");
    return base + (L === "th" ? "ค่ะ รับอะไรเพิ่มไหมคะ ถ้าครบแล้วบอกว่า แค่นี้ ได้เลยค่ะ" : ". Anything else? Say \"that's all\" when you're done.");
  }
  const askVariant = (item, L) => (L === "th" ? `${item.th} รับร้อนหรือเย็นดีคะ` : `Would you like the ${item.en} hot or iced?`);

  function addToOrder(item, qty, variant) {
    if (!order) order = { lines: [], total: 0, pickup: "", name: "" };
    const v = twoPrices(item) ? variant : "";
    const same = order.lines.find((l) => l.item === item && (!v || !l.variant || l.variant === v));
    if (same) { same.qty = Math.min(20, same.qty + qty); if (v) same.variant = v; return same; }
    const line = { item, qty: Math.min(20, Math.max(1, qty)), variant: v, sum: 0 };
    order.lines.push(line);
    return line;
  }

  function reply(raw, L) {
    const text = String(raw || "").trim();
    const q = text.toLowerCase();
    const say = (th, en) => (L === "th" ? th : en);

    /* An answer we are waiting for: hot or iced? */
    if (ctx.pending) {
      const line = ctx.pending;
      const v = variantOf(q);
      ctx.pending = null;
      if (v && !findItem(q)) {
        line.variant = v;
        recalc();
        return nextVariantOr(L, () => orderSummary(L));
      }
      if (order && !line.variant) { line.variant = "hot"; recalc(); } // no answer: hot, shown on the card
    }

    /* Language */
    if (has(q, /ภาษาอังกฤษ|speak english|in english|english please/i)) { page.lang("en"); return "Sure, English it is. What can I get you?"; }
    if (has(q, /ภาษาไทย|พูดไทย|speak thai|in thai/i)) { page.lang("th"); return "ได้ค่ะ คุยภาษาไทยกันนะคะ รับอะไรดีคะ"; }

    /* Cancel the whole order */
    if (order && has(q, /ยกเลิก|ไม่เอาแล้ว|ล้างรายการ|cancel|clear (the |my )?order|start over|never ?mind/i) && !findItem(q)) {
      order = null; ctx.offer = null; recalc();
      return say("ยกเลิกรายการให้แล้วค่ะ อยากดูเมนูอื่นไหมคะ", "I've cleared the order. Would you like to look at something else?");
    }

    /* Pull a pickup time and a name out of the sentence */
    const wantsOrder = has(q, /เอา|ขอ|สั่ง|รับ|เพิ่ม|ซื้อ|\b(order|i'?ll have|i'?ll take|i'?d like|i want|can i (get|have)|give me|add|get me|buy)\b/i);
    const asksAbout = has(q, /เท่าไหร่|เท่าไร|ราคา|กี่บาท|คืออะไร|เป็นยังไง|อร่อยไหม|มี.*ไหม|แนะนำ|how much|price|cost|what('?s| is)|tell me about|do you have|recommend/i);
    let rest = q;
    let time = null;
    if (order || wantsOrder) {
      time = takeTime(rest);
      if (time) rest = time.rest;
    }
    const nameMatch = /(?:ชื่อ|ในนาม|name is|name's|under the name)\s*([\p{L}\p{M}]{2,20})\s*$/iu.exec(text) || (order ? /^(?:ชื่อ|ในนาม)\s*([\p{L}\p{M}]{2,20})/u.exec(text) : null);

    /* Menu items mentioned, one per "and" part: [{ item, qty, variant }] */
    const parts = rest.split(/\s*(?:,|และ|กับ|แล้วก็|\band\b|\bplus\b|\balso\b)\s*/i).filter(Boolean);
    const found = [];
    parts.forEach((part) => {
      const item = findItem(part);
      if (item && !found.some((f) => f.item === item)) found.push({ item, qty: num(part.replace(/\d{1,3}\s*(บาท|baht|thb)/i, "")) || 1, variant: variantOf(part) });
    });
    // "I'll take it" / "เอาอันนี้" right after we described an item.
    let accepted = false;
    if (!found.length && ctx.offer && (has(q, /^(เอา|รับ|ได้|โอเค|ตกลง|ใช่|ค่ะ|ครับ|จัดไป|ok|okay|yes|yeah|yep|sure|please)/i) || (wantsOrder && has(q, /อันนี้|อันนั้น|นี่|\b(it|that|this|one)\b/i)))) {
      found.push({ item: ctx.offer, qty: num(rest) || 1, variant: variantOf(q) });
      accepted = true;
    }

    /* Take something off the order */
    if (order && found.length && has(q, /ไม่เอา|เอา.*ออก|ลบ|\b(remove|without|no more|take off|drop)\b/i)) {
      order.lines = order.lines.filter((l) => !found.some((f) => f.item === l.item));
      recalc();
      if (!order) return say("เอาออกให้แล้วค่ะ ตอนนี้ยังไม่มีรายการ รับอะไรดีคะ", "Removed. Your order is empty now. What would you like?");
      return orderSummary(L);
    }

    /* Add to the order */
    if (found.length && (accepted || (!asksAbout && (wantsOrder || order)))) {
      found.forEach((f) => addToOrder(f.item, f.qty, f.variant));
      applyMeta(time, nameMatch);
      recalc();
      ctx.offer = null;
      page.item(found[found.length - 1].item);
      const late = lateNote(time, L);
      return nextVariantOr(L, () => late || orderSummary(L));
    }

    /* A question about one item */
    if (found.length) {
      const item = found[0].item;
      ctx.offer = item;
      page.item(item);
      const desc = item.desc ? item.desc[L] : "";
      return say(`${item.th} ${priceSay(item, L)}ค่ะ ${desc} รับเลยไหมคะ`.replace(/\s+/g, " "), `The ${item.en} is ${priceSay(item, L)}. ${desc ? desc.replace(/\.?$/, ".") : ""} Would you like one?`.replace(/\s+/g, " "));
    }

    /* Pickup time or name for an order that exists */
    if (order && (time || nameMatch)) {
      applyMeta(time, nameMatch);
      recalc();
      return lateNote(time, L) || say(
        `ได้ค่ะ${order.pickup ? ` รับ ${order.pickup}` : ""}${order.name ? ` ชื่อ ${order.name}` : ""} รับอะไรเพิ่มไหมคะ ถ้าครบแล้วบอกว่า แค่นี้ ได้เลยค่ะ`,
        `Okay${order.pickup ? `, pickup at ${order.pickup}` : ""}${order.name ? `, under ${order.name}` : ""}. Anything else? Say "that's all" when you're done.`);
    }

    /* Finished ordering */
    if (order && has(q, /แค่นี้|เท่านี้|พอแล้ว|ครบแล้ว|ไม่เอาเพิ่ม|ไม่รับเพิ่ม|ไม่แล้ว|ส่งเลย|ยืนยัน|that'?s (all|it)|nothing else|no thanks|i'?m done|\b(done|confirm|send it|checkout)\b/i)) {
      return orderSummary(L, true);
    }

    /* The shop's own questions and answers, from config.js */
    const qn = norm(q);
    const faq = (cfg.faq || []).find((f) => (f.keys || []).some((k) => qn.includes(norm(k))));
    if (faq) return R.both(faq.answer)[L];

    /* Parking and directions (before hours: "how do I get there" is not about time) */
    if (has(q, /จอด|parking|\bpark\b/i) && C.location.parking) { page.section("#find"); return say(`${R.both(C.location.parking).th}ค่ะ`, `${R.both(C.location.parking).en}.`); }
    if (has(q, /อยู่ไหน|อยู่ที่ไหน|อยู่ตรงไหน|ที่อยู่|ไปยังไง|ไปร้าน|เส้นทาง|แผนที่|เดินทาง|bts|mrt|รถไฟฟ้า|\b(where|address|directions?|map|location|located|get there|find you|how (do|can) i get)\b/i)) {
      page.map();
      const transit = C.location.transit ? R.both(C.location.transit) : null;
      return say(
        `ร้านอยู่${R.both(C.location.address).th.split(" ").slice(0, 2).join(" ")}ค่ะ${transit ? ` ${transit.th}` : ""} เปิดแผนที่กับวิธีเดินมาให้บนหน้าจอแล้วค่ะ`,
        `We're ${R.both(C.location.address).en.split(",").slice(0, 2).join(",").replace(/^Inside/, "inside")}.${transit ? ` ${transit.en.replace(" — ", ", ")}.` : ""} I've opened the map and the walking steps on your screen.`);
    }

    /* Opening hours */
    if (has(q, /เปิด|ปิด|กี่โมง|เวลา|วันหยุด|หยุดวัน|\b(open|opening|close[sd]?|closing|hours|what time|when)\b/i)) {
      page.section("#hours");
      const dayKey = Object.keys(DAY_WORDS).find((d) => DAY_WORDS[d].test(q)) ||
        (has(q, /พรุ่งนี้|tomorrow/i) ? H.DAYS[(H.DAYS.indexOf(H.getStatus(C.hours).todayKey) + 1) % 7] : null);
      if (dayKey) {
        const ranges = C.hours.weekly[dayKey] || [];
        const d = DAY_NAMES[dayKey][L];
        return ranges.length ? say(`${d}เปิด ${rangeText(ranges, L)} ค่ะ`, `On ${d} we're open ${rangeText(ranges, L)}.`) : say(`${d}ร้านหยุดค่ะ`, `We're closed on ${d}.`);
      }
      const status = H.describe(H.getStatus(C.hours));
      const now = status ? R.both(status)[L].replace(/\s*·\s*/g, L === "th" ? " " : ". ") : "";
      const today = todayRanges();
      return say(
        `ตอนนี้ร้าน${now}ค่ะ${today.length ? ` วันนี้เปิด ${rangeText(today, L)}` : " วันนี้ร้านหยุด"} ดูเวลาทั้งสัปดาห์บนหน้าจอได้เลยค่ะ`,
        `${now}.${today.length ? ` Today's hours are ${rangeText(today, L)}.` : " We're closed today."} The full week is on your screen.`);
    }

    /* Recommendations and browsing a category */
    const cat = categoryOf(q);
    const wantsNew = has(q, /ใหม่|\bnew\b/i);
    const wantsVeg = has(q, /มังสวิรัติ|vegetarian|veggie|\bveg\b/i);
    if (has(q, /แนะนำ|ขายดี|อร่อย|เด็ด|ยอดนิยม|อะไรดี|อย่างอื่น|อีกไหม|มีอะไร|recommend|suggest|popular|best|favou?rite|what'?s good|what do you have|anything else|something else/i) || cat || wantsNew || wantsVeg) {
      let pool = catalog.filter((i) => (!cat || i.category === cat.id) && (!wantsNew || i.badges.includes("new")) && (!wantsVeg || i.badges.includes("veg")));
      if (!pool.length) return say("ยังไม่มีเมนูแบบนั้นค่ะ ลองดูเมนูทั้งหมดบนหน้าจอได้เลยค่ะ", "We don't have that at the moment. The full menu is on your screen.");
      const stars = pool.filter((i) => i.badges.includes("bestseller"));
      if (!cat && !wantsNew && !wantsVeg && stars.length) pool = stars;
      else if (stars.length) pool = stars.concat(pool.filter((i) => !stars.includes(i)));
      const pick = pool[ctx.recIndex++ % pool.length];
      const others = pool.filter((i) => i !== pick).slice(0, 2);
      ctx.offer = pick;
      page.item(pick);
      return say(
        `แนะนำ${pick.th}ค่ะ ${priceSay(pick, L)}${pick.desc ? " " + pick.desc.th : ""}${others.length ? ` หรือจะลอง${names(others, L)}ก็ได้ค่ะ` : ""} รับเลยไหมคะ`,
        `I'd go for the ${pick.en}, ${priceSay(pick, L)}.${pick.desc ? " " + pick.desc.en.replace(/\.?$/, ".") : ""}${others.length ? ` There's also the ${names(others, L)}.` : ""} Would you like one?`);
    }

    /* Starting an order without saying what */
    if (has(q, /สั่ง|ล่วงหน้า|\border\b|pre-?order|pick ?up/i)) {
      page.section("#menu");
      return say("ได้เลยค่ะ รับอะไรดีคะ บอกชื่อเมนูกับจำนวนได้เลย เช่น ลาเต้เย็นสองแก้ว", "Of course. What would you like? Tell me the item and how many, for example two iced lattes.");
    }
    if (has(q, /เมนู|รายการ|\bmenu\b/i)) { page.section("#menu"); return say("นี่คือเมนูทั้งหมดค่ะ อยากให้แนะนำไหมคะ", "Here's the full menu. Would you like a recommendation?"); }

    /* Contact, the shop, photos, reviews */
    if (has(q, /ไลน์|line|โทร|เบอร์|ติดต่อ|ไอจี|instagram|\b(phone|call|contact|number)\b/i)) {
      page.section("#contact");
      return say(`ทักไลน์ ${C.contact.line.id} หรือโทร ${C.contact.phoneDisplay} ได้เลยค่ะ ช่องทางติดต่ออยู่บนหน้าจอแล้วค่ะ`, `Message us on LINE at ${C.contact.line.id} or call ${C.contact.phoneDisplay}. The contact details are on your screen.`);
    }
    if (has(q, /เรื่องราว|ประวัติ|เจ้าของ|เปิดมา|\b(story|history|about|owner|who (runs|owns))\b/i) && C.story) {
      page.section("#story");
      return R.both(C.story.body[0])[L];
    }
    if (has(q, /รูป|ภาพ|บรรยากาศ|ที่นั่ง|\b(photos?|pictures?|gallery|inside|atmosphere|seats?|seating|vibe)\b/i)) { page.section("#gallery"); return say("นี่คือบรรยากาศในร้านค่ะ แตะที่รูปเพื่อดูใหญ่ได้เลย", "Here's what it looks like inside. Tap a photo to see it larger."); }
    if (has(q, /รีวิว|ลูกค้าว่า|\breviews?\b/i)) { page.section("#reviews"); return say("นี่คือสิ่งที่ลูกค้าพูดถึงเราค่ะ", "Here's what guests say about us."); }

    /* Small talk */
    if (has(q, /คุณคือใคร|เป็นใคร|เป็น ?ai|เป็นคนไหม|who are you|are you (a |an )?(human|person|robot|ai|bot)/i)) {
      return say(`${me.th}เป็นผู้ช่วยอัตโนมัติของ${shop.th}ค่ะ ตอบได้เรื่องเมนู เวลาเปิดปิด เส้นทาง และรับสั่งล่วงหน้าค่ะ`, `I'm ${me.en}, an automated assistant for ${shop.en}. I can help with the menu, opening hours, directions and pre-orders.`);
    }
    if (has(q, /ขอบคุณ|ขอบใจ|thank/i)) return say("ยินดีค่ะ มีอะไรให้ช่วยอีกไหมคะ", "You're welcome. Anything else?");
    if (has(q, /บาย|ลาก่อน|ไปแล้ว|\b(bye|goodbye|see you)\b/i)) return say("ขอบคุณค่ะ แล้วพบกันที่ร้านนะคะ", "Thank you. See you at the cafe.");
    if (has(q, /สวัสดี|หวัดดี|ดีค่ะ|ดีครับ|\b(hi|hello|hey|good (morning|afternoon|evening))\b/i)) return greeting(L);

    /* Not understood: say so, and say what it can do */
    return say(
      "ขอโทษค่ะ เรื่องนี้ยังตอบไม่ได้ ถามเรื่องเมนู เวลาเปิดปิด เส้นทาง หรือสั่งล่วงหน้าได้ค่ะ ถ้าเป็นเรื่องอื่น ทักไลน์ร้านได้เลยนะคะ",
      "Sorry, I can't help with that one. I can tell you about the menu, opening hours and directions, or take a pre-order. For anything else, please message the shop on LINE.");
  }

  function applyMeta(time, nameMatch) {
    if (!order) return;
    if (time) order.pickup = `${pad(time.h)}:${pad(time.m)}`;
    if (nameMatch) order.name = nameMatch[1].slice(0, 20);
  }
  // Pickup outside today's opening hours: keep the order, but say so.
  function lateNote(time, L) {
    if (!time || !order || inHours(time.h, time.m)) return "";
    const today = todayRanges();
    order.pickup = "";
    recalc();
    return today.length
      ? (L === "th" ? `เวลานั้นร้านปิดค่ะ วันนี้เปิด ${rangeText(today, L)} จะมารับกี่โมงดีคะ` : `We're closed at that time. Today we're open ${rangeText(today, L)}. What time suits you?`)
      : (L === "th" ? "วันนี้ร้านหยุดค่ะ เก็บรายการไว้ให้แล้ว ส่งทางไลน์เพื่อนัดวันรับกับร้านได้เลยค่ะ" : "We're closed today. I've kept your order; send it on LINE to arrange a pickup day with the shop.");
  }
  // If a drink still needs "hot or iced?", ask that first; otherwise say `then()`.
  function nextVariantOr(L, then) {
    const open = order && order.lines.find((l) => twoPrices(l.item) && !l.variant);
    if (!open) return then();
    ctx.pending = open;
    return askVariant(open.item, L);
  }
  const greeting = (L) =>
    L === "th"
      ? `สวัสดีค่ะ ${me.th}จาก${shop.th}ค่ะ รับอะไรดีคะ หรือจะถามเรื่องเมนู เวลาเปิดปิด กับเส้นทางก็ได้นะคะ`
      : `Hi, I'm ${me.en} from ${shop.en}. What can I get you? You can also ask about the menu, opening hours or directions.`;

  /* ------------------------------------------------- 6. Voice: listen + speak */
  let rec = null;
  let listening = false;
  let voiceMode = false;   // true: after each answer, listen again by itself
  let soundOn = true;
  let quiet = 0;           // times in a row the mic heard nothing
  let interim = null;

  function pickVoice(L) {
    const voices = synth ? synth.getVoices() : [];
    const want = L === "th" ? "th" : "en";
    return voices.find((v) => v.lang.toLowerCase().startsWith(want) && /female|google|premium|natural|kanya|samantha/i.test(v.name)) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(want)) || null;
  }
  if (synth) synth.getVoices(); // some browsers load the voice list only after the first request

  const restStatus = () => setStatus(listening ? T.listening : SR ? T.idle : T.textMode, listening ? "listening" : "idle");
  function speak(text, L, done) {
    const finish = () => { restStatus(); done && done(); };
    const voice = soundOn && synth ? pickVoice(L) : null;
    if (!voice) return finish(); // sound off, or this device has no voice for the language: text only
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/"/g, ""));
    u.voice = voice;
    u.lang = voice.lang;
    let ended = false;
    const end = () => { if (!ended) { ended = true; finish(); } };
    u.onend = end;
    u.onerror = end;
    setStatus(T.speaking, "speaking");
    synth.speak(u);
  }

  function listen() {
    if (!SR || listening || panel.hidden) return;
    if (synth) synth.cancel(); // talking over the assistant interrupts it
    rec = new SR();
    rec.lang = lang() === "th" ? "th-TH" : "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = "";
    rec.onstart = () => { listening = true; micState(); restStatus(); };
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else live += e.results[i][0].transcript;
      }
      if (live && !finalText) { // show the words as they are heard
        if (!interim) { interim = addLine("user", live); interim.classList.add("is-interim"); }
        else interim.lastChild.textContent = live;
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { voiceMode = false; addLine("note", T.micBlocked); }
      else if (e.error === "no-speech") quiet++;
      else if (e.error !== "aborted") voiceMode = false; // network or audio problem: wait for a tap
    };
    rec.onend = () => {
      listening = false;
      micState();
      if (interim) { interim.remove(); interim = null; }
      if (finalText.trim()) { quiet = 0; ask(finalText.trim()); }
      else if (voiceMode && quiet < 2 && !panel.hidden) listen(); // heard nothing: try once more, then wait for a tap
      else { voiceMode = false; restStatus(); }
    };
    try { rec.start(); } catch (e) { listening = false; }
  }
  function stopListening() {
    if (rec && listening) { try { rec.abort(); } catch (e) { /* already stopped */ } }
  }
  function micState() {
    if (!ui.mic) return;
    ui.mic.setAttribute("aria-pressed", String(listening));
    label(ui.mic, listening ? T.micStop : T.mic);
  }

  // One turn: what the visitor said (spoken, typed or a chip) → answer on screen and out loud.
  function ask(text) {
    const said = String(text || "").trim();
    if (!said) return "";
    if (ui.live.hidden) showLive();
    // Answer in the language the visitor used, and switch the page to match.
    const L = /[ก-๙]/.test(said) ? "th" : /[a-z]/i.test(said) ? "en" : lang();
    addLine("user", said);
    if (L !== lang()) page.lang(L);
    let answer;
    try { answer = reply(said, L); } catch (err) {
      console.warn("[concierge]", err);
      answer = L === "th" ? "ขอโทษค่ะ มีข้อผิดพลาด ลองถามใหม่อีกครั้งนะคะ" : "Sorry, something went wrong. Please try again.";
    }
    addLine("agent", answer);
    speak(answer, L, () => { if (voiceMode && !panel.hidden) listen(); });
    return answer;
  }

  /* ---------------------------------------------------------------- 7. Wiring */
  function showLive() {
    ui.intro.hidden = true;
    ui.live.hidden = false;
  }
  function start(mode) {
    showLive();
    voiceMode = mode === "voice" && !!SR;
    quiet = 0;
    const hello = greeting(lang());
    addLine("agent", hello);
    speak(hello, lang(), () => { if (voiceMode && !panel.hidden) listen(); });
    if (!voiceMode) ui.field.focus({ preventScroll: true });
  }
  function openPanel() {
    panel.hidden = false;
    launch.setAttribute("aria-expanded", "true");
    html.classList.add("is-concierge-open");
    (ui.intro.hidden ? ui.field : $("[data-cg-start]", panel)).focus({ preventScroll: true });
    if (ui.intro.hidden) restStatus();
  }
  function closePanel() {
    voiceMode = false;
    stopListening();
    if (synth) synth.cancel();
    panel.hidden = true;
    launch.setAttribute("aria-expanded", "false");
    html.classList.remove("is-concierge-open");
    setStatus(null, "");
    launch.focus({ preventScroll: true });
  }
  function sendText() {
    const text = ui.field.value.trim();
    if (!text) return;
    ui.field.value = "";
    voiceMode = false; // typing: don't start listening after the answer
    stopListening();
    ask(text);
  }
  function setSound() {
    if (!ui.sound) return;
    ui.sound.innerHTML = R.t(soundOn ? T.soundOn : T.soundOff);
    ui.sound.setAttribute("aria-pressed", String(soundOn));
  }
  const syncLang = () => { ui.field.placeholder = T.placeholder[lang()]; };
  syncLang();
  setSound();
  // main.js swaps aria-labels when the language changes; placeholders are ours to swap.
  new MutationObserver(syncLang).observe(html, { attributes: true, attributeFilter: ["lang"] });

  launch.addEventListener("click", () => (panel.hidden ? openPanel() : closePanel()));
  ui.close.addEventListener("click", closePanel);
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });
  $$("[data-cg-start]", panel).forEach((b) => b.addEventListener("click", () => start(b.dataset.cgStart)));
  ui.send.addEventListener("click", sendText);
  ui.field.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); sendText(); } });
  if (ui.mic) ui.mic.addEventListener("click", () => {
    if (listening) { voiceMode = false; stopListening(); }
    else { voiceMode = true; quiet = 0; listen(); }
  });
  if (ui.sound) ui.sound.addEventListener("click", () => { soundOn = !soundOn; if (!soundOn && synth) synth.cancel(); setSound(); });
  window.addEventListener("pagehide", () => { stopListening(); if (synth) synth.cancel(); });

  // For the automated tests (tools/tests/concierge.mjs).
  window.ShopConcierge = { ask, catalog, findItem, getOrder: () => order, orderText, takeTime };
})();
