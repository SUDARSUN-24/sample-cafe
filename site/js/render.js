/* =============================================================================
   render.js — turns config.js into HTML.
   -----------------------------------------------------------------------------
   Every section of the page has one function here that takes the config and
   returns an HTML string. The SAME functions run in two places:

     1. In Node, inside tools/bake.mjs: the HTML is written into index.html,
        so the content works without JavaScript and is visible to Google and
        to LINE/Facebook link previews.
     2. In the browser, inside main.js: only if config.js changed after the
        last bake (live preview while editing).

   Bilingual text: t({th, en}) outputs both languages as two <span>s. CSS shows
   only the one that matches <html lang="…">, so switching language is instant
   and needs no re-rendering. Attributes (alt, aria-label) can't contain spans,
   so attr() stores both versions in data- attributes and main.js swaps them.
   ========================================================================== */
(function (root) {
  "use strict";

  // UI words that are not shop-specific. A shop can override any of them
  // with config.strings = { directions: { th: "…", en: "…" } }.
  const DEFAULT_STRINGS = {
    skip: { th: "ข้ามไปที่เนื้อหา", en: "Skip to content" },
    navLabel: { th: "เมนูหลัก", en: "Main" },
    navFind: { th: "วิธีมาร้าน", en: "Find us" },
    navMenu: { th: "เมนู", en: "Menu" },
    navBook: { th: "จองโต๊ะ", en: "Book" },
    navStory: { th: "เรื่องของเรา", en: "Story" },
    navGallery: { th: "บรรยากาศ", en: "Gallery" },
    navContact: { th: "ติดต่อ", en: "Contact" },
    openMenu: { th: "เปิดเมนู", en: "Open menu" },
    closeMenu: { th: "ปิดเมนู", en: "Close menu" },
    langGroup: { th: "เลือกภาษา", en: "Choose language" },
    directions: { th: "นำทาง", en: "Directions" },
    directionsLong: { th: "นำทางด้วย Google Maps", en: "Directions in Google Maps" },
    addLine: { th: "แอดไลน์", en: "Add on LINE" },
    call: { th: "โทร", en: "Call" },
    line: "LINE",
    instagram: "Instagram",
    hoursLink: { th: "ดูเวลาเปิด–ปิด", en: "See opening hours" },
    scrollCue: { th: "เลื่อนลงเพื่อดูวิธีมาร้าน", en: "Scroll down for directions" },
    findEyebrow: { th: "วิธีมาร้าน", en: "How to find us" },
    findTitle: { th: "หาไม่ยาก ถ้ารู้ว่าต้องมองหาอะไร", en: "Easy to find, once you know what to look for" },
    step: { th: "ขั้นที่", en: "Step" },
    mapTap: { th: "แตะเพื่อเปิดแผนที่", en: "Tap to load the map" },
    mapNoteOsm: { th: "แผนที่จาก OpenStreetMap จะโหลดเมื่อแตะเท่านั้น", en: "The OpenStreetMap map loads only when you tap" },
    mapNoteGoogle: { th: "แผนที่จาก Google Maps จะโหลดเมื่อแตะเท่านั้น", en: "The Google map loads only when you tap" },
    mapTitle: { th: "แผนที่ตำแหน่งร้าน", en: "Map of the shop's location" },
    copyAddress: { th: "คัดลอกที่อยู่", en: "Copy address" },
    copied: { th: "คัดลอกที่อยู่แล้ว ส่งให้คนขับได้เลย", en: "Address copied — paste it to your driver" },
    copyFailed: { th: "คัดลอกไม่สำเร็จ กรุณากดค้างที่ข้อความเพื่อคัดลอก", en: "Couldn't copy — press and hold the text to copy it" },
    transit: { th: "รถไฟฟ้า", en: "Transit" },
    parking: { th: "ที่จอดรถ", en: "Parking" },
    hoursTitle: { th: "เวลาเปิด–ปิด", en: "Opening hours" },
    today: { th: "วันนี้", en: "Today" },
    closed: { th: "ปิด", en: "Closed" },
    sigEyebrow: { th: "เมนูแนะนำ", en: "Signatures" },
    menuEyebrow: { th: "เมนู", en: "Menu" },
    menuTabs: { th: "หมวดเมนู", en: "Menu categories" },
    hot: { th: "ร้อน", en: "Hot" },
    iced: { th: "เย็น", en: "Iced" },
    baht: { th: "บาท", en: "THB" },
    badge_new: { th: "ใหม่", en: "New" },
    badge_bestseller: { th: "ขายดี", en: "Bestseller" },
    badge_veg: { th: "มังสวิรัติ", en: "Vegetarian" },
    storyEyebrow: { th: "เรื่องของเรา", en: "Our story" },
    galleryEyebrow: { th: "บรรยากาศ", en: "Gallery" },
    galleryOpen: { th: "ดูภาพขยาย", en: "View larger" },
    reviewsEyebrow: { th: "รีวิว", en: "Reviews" },
    reviewsRegion: { th: "รีวิวจากลูกค้า", en: "Customer reviews" },
    sampleReviews: {
      th: "ข้อความตัวอย่าง ไม่ใช่รีวิวจริง · ร้านจริงจะแสดงรีวิวจริงที่ได้รับอนุญาตจากลูกค้าเท่านั้น",
      en: "Sample text, not real reviews · A real shop shows only genuine reviews, used with permission",
    },
    prev: { th: "ก่อนหน้า", en: "Previous" },
    next: { th: "ถัดไป", en: "Next" },
    reviewOf: { th: "รีวิวที่", en: "Review" },
    contactEyebrow: { th: "ติดต่อ", en: "Contact" },
    qrCaption: { th: "สแกนเพื่อเพิ่มเพื่อนใน LINE", en: "Scan to add us on LINE" },
    actionBar: { th: "ติดต่อด่วน", en: "Quick contact" },
    lightboxLabel: { th: "ภาพขยาย", en: "Photo viewer" },
    close: { th: "ปิด", en: "Close" },
    prevPhoto: { th: "ภาพก่อนหน้า", en: "Previous photo" },
    nextPhoto: { th: "ภาพถัดไป", en: "Next photo" },
    demoNotice: { th: "เว็บไซต์ตัวอย่าง ข้อมูลร้านทั้งหมดเป็นข้อมูลสมมุติ", en: "Demo website — all shop details are fictional" },
    backToTop: { th: "กลับขึ้นด้านบน", en: "Back to top" },
    newTab: { th: "(เปิดในแท็บใหม่)", en: "(opens in a new tab)" },
    // Booking section (js/booking.js)
    bookEyebrow: { th: "จองโต๊ะ", en: "Reserve" },
    bookParty: { th: "จำนวนคน", en: "Guests" },
    bookDate: { th: "วันที่", en: "Date" },
    bookTime: { th: "เวลา", en: "Time" },
    bookName: { th: "ชื่อ", en: "Name" },
    bookPhone: { th: "เบอร์โทร", en: "Phone" },
    bookNote: { th: "หมายเหตุ (ถ้ามี)", en: "Note (optional)" },
    bookSubmit: { th: "ยืนยันการจอง", en: "Confirm booking" },
    bookLoading: { th: "กำลังดูเวลาว่าง…", en: "Checking free times…" },
    bookNoSlots: { th: "วันนี้ไม่มีเวลาว่างแล้ว ลองเลือกวันอื่น", en: "No free times left that day. Try another date." },
    bookPrivacy: {
      th: "ใช้ชื่อและเบอร์โทรเพื่อการจองนี้เท่านั้น และลบภายใน 30 วันหลังวันจอง",
      en: "Your name and phone are used for this booking only, and deleted within 30 days of the visit.",
    },
    bookOffline: {
      th: "ตอนนี้จองออนไลน์ไม่ได้ ทักไลน์หรือโทรมาจองได้เลย",
      en: "Online booking isn't available right now. Please book on LINE or by phone.",
    },
    bookDoneTitle: { th: "จองเรียบร้อยแล้ว", en: "You're booked" },
    bookDoneCode: { th: "รหัสการจอง", en: "Booking code" },
    bookDoneKeep: {
      th: "เก็บรหัสนี้ไว้ ใช้คู่กับเบอร์โทรเพื่อตรวจสอบหรือยกเลิก",
      en: "Keep this code. With your phone number, it lets you check or cancel the booking.",
    },
    bookAgain: { th: "จองอีกรายการ", en: "Make another booking" },
    manageTitle: { th: "ตรวจสอบหรือยกเลิกการจอง / ออเดอร์", en: "Check or cancel a booking or order" },
    manageCode: { th: "รหัส", en: "Code" },
    manageCheck: { th: "ตรวจสอบ", en: "Check" },
    manageCancel: { th: "ยกเลิกรายการนี้", en: "Cancel this" },
    guests: { th: "ท่าน", en: "guests" },
  };

  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const DAY_NAMES = {
    mon: { th: "จันทร์", en: "Monday" }, tue: { th: "อังคาร", en: "Tuesday" },
    wed: { th: "พุธ", en: "Wednesday" }, thu: { th: "พฤหัสบดี", en: "Thursday" },
    fri: { th: "ศุกร์", en: "Friday" }, sat: { th: "เสาร์", en: "Saturday" },
    sun: { th: "อาทิตย์", en: "Sunday" },
  };

  /* ---------------------------------------------------------- small helpers */

  // Escape text before putting it in HTML, so a "<" or quote in config can't break the page.
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ESC[ch]);
  }

  // Normalise "text" or {th, en} into {th, en}.
  function both(value) {
    if (value == null) return { th: "", en: "" };
    if (typeof value === "object") return { th: value.th ?? value.en ?? "", en: value.en ?? value.th ?? "" };
    return { th: String(value), en: String(value) };
  }

  // Bilingual text → HTML. Identical text is written once.
  function t(value) {
    const v = both(value);
    if (v.th === v.en) return esc(v.th);
    return `<span lang="th" data-l="th">${esc(v.th)}</span><span lang="en" data-l="en">${esc(v.en)}</span>`;
  }

  // Bilingual attribute → name="thai" data-name-th="…" data-name-en="…"
  function attr(name, value) {
    const v = both(value);
    if (v.th === v.en) return `${name}="${esc(v.th)}"`;
    return `${name}="${esc(v.th)}" data-${name}-th="${esc(v.th)}" data-${name}-en="${esc(v.en)}"`;
  }

  // Small inline SVG icon from the sprite in index.html.
  function icon(name, cls = "") {
    return `<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
  }

  function strings(c) {
    return Object.assign({}, DEFAULT_STRINGS, c.strings || {});
  }

  function directionsUrl(c) {
    const loc = c.location;
    if (loc.mapsUrl) return loc.mapsUrl;
    return `https://www.google.com/maps/dir/?api=1&destination=${loc.geo.lat},${loc.geo.lng}`;
  }

  // Links that leave the site open in a new tab; screen readers are told so.
  function extLink(href, inner, cls, S, extra = "") {
    return `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener" ${extra}>${inner}<span class="visually-hidden"> ${t(S.newTab)}</span></a>`;
  }

  // FNV-1a hash: a quick fingerprint of the config, to tell if index.html is up to date.
  function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  }
  function buildId(c, images) {
    return hash(JSON.stringify([c, images || {}]));
  }

  function formatPrice(p, S) {
    if (p == null) return "";
    if (typeof p === "number") return `<span class="price">฿${p}</span>`;
    const parts = [];
    if (p.hot != null) parts.push(`<span class="price-pair"><span class="price-pair__label">${t(S.hot)}</span> ฿${p.hot}</span>`);
    if (p.iced != null) parts.push(`<span class="price-pair"><span class="price-pair__label">${t(S.iced)}</span> ฿${p.iced}</span>`);
    return `<span class="price price--pair">${parts.join('<span class="price-pair__sep" aria-hidden="true">·</span>')}</span>`;
  }

  function badges(list, S, cls = "") {
    if (!list || !list.length) return "";
    const iconFor = { new: "sparkle", bestseller: "flame", veg: "leaf" };
    return `<ul class="badges ${cls}" role="list">${list
      .map((b) => `<li class="badge badge--${esc(b)}">${icon(iconFor[b] || "sparkle")}${t(S["badge_" + b] || b)}</li>`)
      .join("")}</ul>`;
  }

  /* --------------------------------------------------------------- images */

  function imagesOf() {
    return root.SHOP_IMAGES || {};
  }
  function srcset(entry, ext) {
    return entry.widths.map((w) => `assets/img/${entry.file}-${w}.${ext} ${w}w`).join(", ");
  }

  // <picture> with AVIF, WebP and JPEG fallback, explicit width/height (prevents layout
  // shift) and a blurred placeholder (CSS class ph-<name>, generated by bake).
  function picture(c, name, opts = {}) {
    const entry = imagesOf()[name];
    const alt = (c.photos[name] && c.photos[name].alt) || "";
    const sizes = opts.sizes || "100vw";
    const loading = opts.eager ? `fetchpriority="high"` : `loading="lazy" decoding="async"`;
    if (!entry) {
      return `<div class="media media--missing ${opts.cls || ""}" role="img" ${attr("aria-label", alt)}></div>`;
    }
    const jpgW = entry.jpg && entry.jpg.length ? entry.jpg : [entry.widths[0]];
    const jpgSet = jpgW.map((w) => `assets/img/${entry.file}-${w}.jpg ${w}w`).join(", ");
    let sources = "";
    if (opts.portrait && entry.portrait) {
      const p = entry.portrait;
      sources +=
        `<source media="(max-width: 767px)" type="image/avif" srcset="${srcset(p, "avif")}" sizes="${sizes}">` +
        `<source media="(max-width: 767px)" type="image/webp" srcset="${srcset(p, "webp")}" sizes="${sizes}">`;
    }
    sources +=
      `<source type="image/avif" srcset="${srcset(entry, "avif")}" sizes="${sizes}">` +
      `<source type="image/webp" srcset="${srcset(entry, "webp")}" sizes="${sizes}">`;
    return (
      `<picture class="media ph-${esc(name)} ${opts.cls || ""}">${sources}` +
      `<img src="assets/img/${entry.file}-${jpgW[jpgW.length - 1]}.jpg" srcset="${jpgSet}" sizes="${sizes}" ` +
      `width="${entry.w}" height="${entry.h}" ${attr("alt", alt)} ${loading}></picture>`
    );
  }

  function sectionHead(num, eyebrow, title, id, intro) {
    return (
      `<header class="section-head reveal">` +
      `<p class="eyebrow"><span class="eyebrow__num">${num}</span><span class="eyebrow__rule" aria-hidden="true"></span>${t(eyebrow)}</p>` +
      `<h2 class="section-title" id="${id}">${t(title)}</h2>` +
      (intro ? `<p class="section-intro">${t(intro)}</p>` : "") +
      `</header>`
    );
  }

  /* ------------------------------------------------------------- sections */
  const sections = {};

  const bookingOn = (c) => !!(c.booking && c.booking.enabled);
  // "01", "02"… in page order, skipping sections that are switched off.
  function num(c, id) {
    const order = ["find", "signature", "menu", bookingOn(c) && "booking", "story", "gallery",
      c.reviews && c.reviews.items && c.reviews.items.length && "reviews", "contact"].filter(Boolean);
    return String(order.indexOf(id) + 1).padStart(2, "0");
  }
  function navLinks(c, S) {
    return [["find", S.navFind], ["menu", S.navMenu], bookingOn(c) && ["booking", S.navBook], ["story", S.navStory],
      ["gallery", S.navGallery], ["contact", S.navContact]].filter(Boolean);
  }

  sections.header = function (c) {
    const S = strings(c);
    const links = navLinks(c, S);
    return (
      `<div class="site-header__bg" aria-hidden="true"></div>` +
      `<div class="site-header__inner container">` +
      `<a class="brand" href="#top">${t(c.business.name)}</a>` +
      `<nav class="site-nav" ${attr("aria-label", S.navLabel)}><ul role="list">` +
      links.map(([id, label]) => `<li><a class="site-nav__link" href="#${id}">${t(label)}</a></li>`).join("") +
      `</ul></nav>` +
      `<div class="site-header__tools">` +
      `<div class="lang-toggle" role="group" ${attr("aria-label", S.langGroup)}>` +
      `<span class="lang-toggle__thumb" aria-hidden="true"></span>` +
      // Visible "TH"/"EN" + a hidden full name. Screen readers say "TH ภาษาไทย"; the spoken
      // name must contain the visible text, so voice-control users can say "click TH".
      `<button type="button" class="lang-toggle__btn" data-set-lang="th" lang="th" aria-pressed="true">TH<span class="visually-hidden"> ภาษาไทย</span></button>` +
      `<button type="button" class="lang-toggle__btn" data-set-lang="en" lang="en" aria-pressed="false">EN<span class="visually-hidden"> English</span></button>` +
      `</div>` +
      `<button type="button" class="menu-btn" aria-haspopup="dialog" aria-controls="mobile-menu" ${attr("aria-label", S.openMenu)}>` +
      `<span class="menu-btn__bars" aria-hidden="true"><span></span><span></span></span></button>` +
      `</div></div>`
    );
  };

  sections.mobileMenu = function (c) {
    const S = strings(c);
    const links = navLinks(c, S);
    return (
      `<div class="sheet__inner">` +
      `<div class="sheet__top"><p class="sheet__brand">${t(c.business.name)}</p>` +
      `<button type="button" class="icon-btn sheet__close" data-close-sheet ${attr("aria-label", S.closeMenu)}>${icon("close")}</button></div>` +
      `<nav ${attr("aria-label", S.navLabel)}><ol class="sheet__links" role="list">` +
      links.map(([id, label], i) => `<li><a href="#${id}" data-close-sheet><span class="sheet__num">0${i + 1}</span>${t(label)}</a></li>`).join("") +
      `</ol></nav>` +
      `<div class="sheet__actions">` +
      extLink(c.contact.line.url, `${icon("chat")}${t(S.addLine)}`, "btn btn--primary", S) +
      `<a class="btn btn--ghost" href="tel:${esc(c.contact.phone)}">${icon("phone")}${t(S.call)} ${esc(c.contact.phoneDisplay)}</a>` +
      `</div></div>`
    );
  };

  sections.hero = function (c) {
    const S = strings(c);
    const b = c.business;
    const v = c.hero.video;
    const video = v
      ? `<video class="hero__video" data-hero-video muted loop playsinline preload="none" aria-hidden="true">` +
        (v.webm ? `<source src="${esc(v.webm)}" type="video/webm">` : "") +
        (v.mp4 ? `<source src="${esc(v.mp4)}" type="video/mp4">` : "") +
        `</video>`
      : "";
    return (
      `<div class="hero__media" data-parallax>${picture(c, c.hero.photo, { eager: true, portrait: true, sizes: "100vw", cls: "hero__picture" })}${video}</div>` +
      `<div class="hero__scrim" aria-hidden="true"></div>` +
      `<div class="hero__content container">` +
      `<p class="eyebrow eyebrow--light hero__eyebrow" data-hero-reveal>${t(b.eyebrow)}</p>` +
      `<h1 class="hero__title" id="hero-title" data-hero-reveal>${t(b.name)}</h1>` +
      `<p class="hero__tagline" data-hero-reveal>${t(b.tagline)}</p>` +
      `<a class="status" href="#hours" data-open-status data-hero-reveal>` +
      `<span class="status__dot" aria-hidden="true"></span><span class="status__text">${t(S.hoursLink)}</span></a>` +
      `<div class="hero__actions" data-hero-reveal>` +
      extLink(directionsUrl(c), `${icon("pin")}${t(S.directions)}`, "btn btn--light btn--lg", S) +
      extLink(c.contact.line.url, `${icon("chat")}${t(S.addLine)}`, "btn btn--glass btn--lg", S) +
      `</div></div>` +
      `<a class="hero__scroll" href="#find" ${attr("aria-label", S.scrollCue)}><span class="hero__scroll-line" aria-hidden="true"></span></a>`
    );
  };

  sections.find = function (c) {
    const S = strings(c);
    const loc = c.location;
    const steps = loc.steps
      .map(
        (s, i) =>
          `<li class="step reveal">` +
          `<span class="step__marker" aria-hidden="true">${icon(s.icon || "pin")}</span>` +
          `<div class="step__body"><p class="step__num">${t({ th: `${S.step.th} ${i + 1}`, en: `${S.step.en} ${i + 1}` })}</p>` +
          `<h3 class="step__title">${t(s.title)}</h3><p class="step__text">${t(s.text)}</p>` +
          (s.photo ? picture(c, s.photo, { sizes: "(min-width: 1100px) 420px, (min-width: 768px) 40vw, 84vw", cls: "step__photo" }) : "") +
          `</div></li>`
      )
      .join("");
    const rows = DAYS.map((d) => {
      const ranges = c.hours.weekly[d] || [];
      const text = ranges.length ? esc(ranges.map((r) => r.join("–")).join(", ")) : t(S.closed);
      return `<tr data-day="${d}"${ranges.length ? "" : ' class="is-closed"'}><th scope="row">${t(DAY_NAMES[d])}<span class="hours__today">${t(S.today)}</span></th><td>${text}</td></tr>`;
    }).join("");
    const embedNote = loc.embed === "google" ? S.mapNoteGoogle : S.mapNoteOsm;
    const addr = both(loc.address);
    return (
      `<div class="container">` +
      sectionHead(num(c, "find"), S.findEyebrow, S.findTitle, "find-title", loc.address) +
      `<div class="find__grid">` +
      `<ol class="steps" role="list">${steps}</ol>` +
      `<div class="find__card reveal">` +
      `<div class="map" data-map data-lat="${loc.geo.lat}" data-lng="${loc.geo.lng}" data-embed="${esc(loc.embed || "osm")}" ${attr("data-title", S.mapTitle)}>` +
      `<button type="button" class="map__load" data-map-load>` +
      `<span class="map__art" aria-hidden="true"><span class="map__road map__road--a"></span><span class="map__road map__road--b"></span><span class="map__road map__road--c"></span><span class="map__pin">${icon("pin")}</span></span>` +
      `<span class="map__cta">${icon("map")}${t(S.mapTap)}</span>` +
      `<span class="map__note">${t(embedNote)}</span></button></div>` +
      `<div class="find__actions">` +
      extLink(directionsUrl(c), `${icon("pin")}${t(S.directionsLong)}`, "btn btn--primary", S) +
      `<button type="button" class="btn btn--ghost" data-copy-th="${esc(addr.th)}" data-copy-en="${esc(addr.en)}">${icon("copy")}${t(S.copyAddress)}</button>` +
      `</div>` +
      `<dl class="facts">` +
      `<div class="fact">${icon("train", "fact__icon")}<dt>${t(S.transit)}</dt><dd>${t(loc.transit)}</dd></div>` +
      `<div class="fact">${icon("parking", "fact__icon")}<dt>${t(S.parking)}</dt><dd>${t(loc.parking)}</dd></div>` +
      `</dl>` +
      `<div class="hours" id="hours">` +
      `<h3 class="hours__title" id="hours-title">${icon("clock")}${t(S.hoursTitle)}</h3>` +
      `<table class="hours__table"><caption class="visually-hidden">${t(S.hoursTitle)}</caption><tbody>${rows}</tbody></table>` +
      (c.hours.note ? `<p class="hours__note">${t(c.hours.note)}</p>` : "") +
      `</div></div></div></div>`
    );
  };

  sections.signature = function (c) {
    const S = strings(c);
    const sig = c.signature;
    const cards = sig.items
      .map(
        (it) =>
          `<li class="sig-card reveal">` +
          `<div class="sig-card__media">${picture(c, it.photo, { sizes: "(min-width: 1100px) 270px, (min-width: 768px) 30vw, 72vw" })}` +
          badges(it.badges, S, "sig-card__badges") + `</div>` +
          `<div class="sig-card__body"><h3 class="sig-card__name">${t(it.name)}</h3>` +
          `<p class="sig-card__desc">${t(it.desc)}</p>${formatPrice(it.price, S)}</div></li>`
      )
      .join("");
    return (
      `<div class="container">` +
      sectionHead(num(c, "signature"), S.sigEyebrow, sig.title, "signature-title", sig.intro) +
      `</div>` +
      // On phones this row scrolls sideways (CSS scroll-snap); on bigger screens it's a grid.
      // tabindex=0 lets keyboard users focus the row and scroll it with the arrow keys.
      `<ul class="sig-row" role="list" tabindex="0" data-scroll-row data-stagger ${attr("aria-label", sig.title)}>${cards}</ul>`
    );
  };

  sections.menu = function (c) {
    const S = strings(c);
    const m = c.menu;
    const tabs = m.categories
      .map(
        (cat, i) =>
          `<button type="button" class="tabs__tab" role="tab" id="tab-${esc(cat.id)}" aria-controls="panel-${esc(cat.id)}" ` +
          `aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t(cat.name)}</button>`
      )
      .join("");
    const panels = m.categories
      .map(
        (cat) =>
          `<div class="tabs__panel" role="tabpanel" id="panel-${esc(cat.id)}" aria-labelledby="tab-${esc(cat.id)}" tabindex="0">` +
          `<h3 class="tabs__panel-title">${t(cat.name)}</h3><ul class="menu-list" role="list">` +
          cat.items
            .map(
              (it) =>
                `<li class="menu-item"><div class="menu-item__row"><span class="menu-item__name">${t(it.name)}</span>` +
                `<span class="menu-item__dots" aria-hidden="true"></span>${formatPrice(it.price, S)}</div>` +
                (it.desc ? `<p class="menu-item__desc">${t(it.desc)}</p>` : "") +
                badges(it.badges, S) +
                `</li>`
            )
            .join("") +
          `</ul></div>`
      )
      .join("");
    return (
      `<div class="container">` +
      sectionHead(num(c, "menu"), S.menuEyebrow, m.title, "menu-title") +
      `<div class="tabs reveal" data-tabs>` +
      `<div class="tabs__bar"><div class="tabs__list" role="tablist" ${attr("aria-label", S.menuTabs)}>${tabs}` +
      `<span class="tabs__indicator" aria-hidden="true"></span></div></div>` +
      panels +
      `</div>` +
      (m.note ? `<p class="menu-note reveal">${t(m.note)}</p>` : "") +
      `</div>`
    );
  };

  // Table booking. The form is filled in and sent by js/booking.js; until that
  // script has reached the backend, only the "book on LINE" fallback shows.
  sections.booking = function (c) {
    if (!bookingOn(c)) return "";
    const S = strings(c);
    const b = c.booking;
    const field = (id, label, control) => `<div class="field"><label class="field__label" for="${id}">${t(label)}</label>${control}</div>`;
    const party = Array.from({ length: b.maxParty || 6 }, (_, i) => `<option value="${i + 1}"${i === 1 ? " selected" : ""}>${i + 1}</option>`).join("");
    return (
      `<div class="container book__grid">` +
      `<div class="book__intro">` +
      sectionHead(num(c, "booking"), S.bookEyebrow, b.title, "booking-title", b.intro) +
      (b.note ? `<p class="book__note reveal">${icon("info")}<span>${t(b.note)}</span></p>` : "") +
      `</div>` +
      `<div class="book reveal" data-book data-days="${b.daysAhead || 14}">` +
      `<div class="book__offline" data-book-offline><p>${t(S.bookOffline)}</p>` +
      `<div class="book__offline-actions">` +
      extLink(c.contact.line.url, `${icon("chat")}${t(S.addLine)}`, "btn btn--primary", S) +
      `<a class="btn btn--ghost" href="tel:${esc(c.contact.phone)}">${icon("phone")}${t(S.call)} ${esc(c.contact.phoneDisplay)}</a>` +
      `</div></div>` +
      `<div class="book__form" data-book-form hidden>` +
      `<div class="book__row">` +
      field("book-party", S.bookParty, `<select class="field__input" id="book-party" data-book-party>${party}</select>`) +
      field("book-date", S.bookDate, `<select class="field__input" id="book-date" data-book-date></select>`) +
      `</div>` +
      `<div class="field"><p class="field__label" id="book-time-label">${t(S.bookTime)}</p>` +
      `<div class="slots" role="radiogroup" aria-labelledby="book-time-label" data-book-slots></div>` +
      `<p class="book__hint" data-book-slots-msg role="status"></p></div>` +
      `<div class="book__row">` +
      field("book-name", S.bookName, `<input class="field__input" id="book-name" type="text" autocomplete="given-name" maxlength="40" data-book-name>`) +
      field("book-phone", S.bookPhone, `<input class="field__input" id="book-phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" data-book-phone>`) +
      `</div>` +
      field("book-note", S.bookNote, `<input class="field__input" id="book-note" type="text" maxlength="200" data-book-note>`) +
      // Hidden from people; a bot that fills it in is ignored by the server.
      `<div class="visually-hidden" aria-hidden="true"><label for="book-website">Website</label><input id="book-website" type="text" tabindex="-1" autocomplete="off" data-book-website></div>` +
      `<p class="book__error" data-book-error role="alert"></p>` +
      `<button type="button" class="btn btn--primary btn--lg book__submit" data-book-submit>${t(S.bookSubmit)}</button>` +
      `<p class="book__privacy">${t(S.bookPrivacy)}</p>` +
      `</div>` +
      `<div class="book__done" data-book-done hidden tabindex="-1">` +
      `<p class="book__done-title">${icon("check")}${t(S.bookDoneTitle)}</p>` +
      `<p class="book__done-when" data-book-done-when></p>` +
      `<p class="book__code"><span>${t(S.bookDoneCode)}</span><strong data-book-done-code></strong></p>` +
      `<p class="book__hint">${t(S.bookDoneKeep)}</p>` +
      `<button type="button" class="btn btn--ghost" data-book-again>${t(S.bookAgain)}</button>` +
      `</div>` +
      `<details class="manage" data-manage hidden><summary>${t(S.manageTitle)}</summary>` +
      `<div class="book__row">` +
      field("manage-code", S.manageCode, `<input class="field__input" id="manage-code" type="text" autocomplete="off" autocapitalize="characters" maxlength="12" data-manage-code>`) +
      field("manage-phone", S.bookPhone, `<input class="field__input" id="manage-phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" data-manage-phone>`) +
      `</div>` +
      `<button type="button" class="btn btn--ghost" data-manage-check>${t(S.manageCheck)}</button>` +
      `<div class="manage__result" data-manage-result role="status"></div>` +
      `<button type="button" class="btn btn--ghost manage__cancel" data-manage-cancel hidden>${t(S.manageCancel)}</button>` +
      `</details>` +
      `</div></div>`
    );
  };

  sections.story = function (c) {
    const S = strings(c);
    const st = c.story;
    return (
      `<div class="container story__grid">` +
      `<figure class="story__media reveal">${picture(c, st.photo, { sizes: "(min-width: 900px) 42vw, 88vw", cls: "arch" })}</figure>` +
      `<div class="story__text">` +
      `<p class="eyebrow eyebrow--light reveal"><span class="eyebrow__num">${num(c, "story")}</span><span class="eyebrow__rule" aria-hidden="true"></span>${t(S.storyEyebrow)}</p>` +
      `<h2 class="section-title reveal" id="story-title">${t(st.title)}</h2>` +
      st.body.map((p, i) => `<p class="story__p ${i === 0 ? "story__p--lead" : ""} reveal">${t(p)}</p>`).join("") +
      (st.signoff ? `<p class="story__signoff reveal">${t(st.signoff)}</p>` : "") +
      `</div></div>`
    );
  };

  sections.gallery = function (c) {
    const S = strings(c);
    const g = c.gallery;
    const items = g.items
      .map((it, i) => {
        const alt = both((c.photos[it.photo] || {}).alt);
        const label = { th: `${S.galleryOpen.th}: ${alt.th}`, en: `${S.galleryOpen.en}: ${alt.en}` };
        const size = it.size === "tall" ? "gallery__item--tall" : it.size === "wide" ? "gallery__item--wide" : "";
        const sizes = it.size === "wide" ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw";
        return (
          `<li class="gallery__item ${size} reveal">` +
          `<button type="button" class="gallery__btn" data-lightbox-index="${i}" data-photo="${esc(it.photo)}" ${attr("aria-label", label)}>` +
          picture(c, it.photo, { sizes }) +
          `<span class="gallery__zoom" aria-hidden="true">${icon("expand")}</span></button></li>`
        );
      })
      .join("");
    return (
      `<div class="container">` +
      sectionHead(num(c, "gallery"), S.galleryEyebrow, g.title, "gallery-title") +
      `<ul class="gallery" role="list" data-stagger>${items}</ul></div>`
    );
  };

  sections.reviews = function (c) {
    const S = strings(c);
    const r = c.reviews;
    if (!r || !r.items || !r.items.length) return "";
    const slides = r.items
      .map(
        (it, i) =>
          `<figure class="review" data-slide ${attr("aria-label", { th: `${S.reviewOf.th} ${i + 1} / ${r.items.length}`, en: `${S.reviewOf.en} ${i + 1} of ${r.items.length}` })}>` +
          `${icon("quote", "review__mark")}<blockquote class="review__quote"><p>${t(it.quote)}</p></blockquote>` +
          `<figcaption class="review__by"><span class="review__author">${t(it.author)}</span>` +
          (it.source ? `<span class="review__source">${t(it.source)}</span>` : "") +
          `</figcaption></figure>`
      )
      .join("");
    const dots = r.items
      .map((_, i) => `<button type="button" class="carousel__dot" data-dot="${i}" ${attr("aria-label", { th: `${S.reviewOf.th} ${i + 1}`, en: `${S.reviewOf.en} ${i + 1}` })}></button>`)
      .join("");
    return (
      `<div class="container">` +
      sectionHead(num(c, "reviews"), S.reviewsEyebrow, r.title, "reviews-title") +
      (r.isSample ? `<p class="sample-flag reveal">${icon("info")}${t(S.sampleReviews)}</p>` : "") +
      `<div class="carousel reveal" data-carousel>` +
      `<div class="carousel__track" tabindex="0" role="region" ${attr("aria-label", S.reviewsRegion)}>${slides}</div>` +
      `<div class="carousel__controls">` +
      `<button type="button" class="icon-btn" data-carousel-prev ${attr("aria-label", S.prev)}>${icon("arrow-left")}</button>` +
      `<div class="carousel__dots">${dots}</div>` +
      `<button type="button" class="icon-btn" data-carousel-next ${attr("aria-label", S.next)}>${icon("arrow-right")}</button>` +
      `</div></div></div>`
    );
  };

  // QR code as inline SVG. In Node (bake) the qrcode library is loaded; in the browser
  // the library is loaded only if needed (main.js), so normally this is pre-rendered.
  function qrSvg(text) {
    const lib = root.qrcode;
    if (!lib) return "";
    const qr = lib(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const q = 2; // quiet zone, in modules
    let d = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + q} ${y + q}h1v1h-1z`;
    }
    return `<svg class="qr__svg" viewBox="0 0 ${n + q * 2} ${n + q * 2}" role="img" aria-hidden="true" shape-rendering="crispEdges"><path d="${d}"/></svg>`;
  }

  sections.contact = function (c) {
    const S = strings(c);
    const k = c.contact;
    const cs = c.contactSection;
    const tile = (href, ic, label, value, external) => {
      const inner = `<span class="tile__icon">${icon(ic)}</span><span class="tile__text"><span class="tile__label">${t(label)}</span><span class="tile__value">${value}</span></span>${icon("arrow-up-right", "tile__arrow")}`;
      return `<li>${external ? extLink(href, inner, "tile", S) : `<a class="tile" href="${esc(href)}">${inner}</a>`}</li>`;
    };
    return (
      `<div class="container contact__grid">` +
      `<div class="contact__main">` +
      sectionHead(num(c, "contact"), S.contactEyebrow, cs.title, "contact-title", cs.intro) +
      `<ul class="tiles" role="list" data-stagger>` +
      tile(`tel:${k.phone}`, "phone", S.call, esc(k.phoneDisplay), false) +
      tile(k.line.url, "chat", S.line, esc(k.line.id), true) +
      tile(k.instagram.url, "instagram", S.instagram, "@" + esc(k.instagram.handle), true) +
      tile(directionsUrl(c), "pin", S.directions, t(c.location.transit), true) +
      `</ul></div>` +
      `<figure class="qr-card reveal">` +
      `<div class="qr" data-qr="${esc(k.line.url)}">${qrSvg(k.line.url)}</div>` +
      `<figcaption class="qr-card__caption"><span class="qr-card__title">${t(S.qrCaption)}</span><span class="qr-card__id">${esc(k.line.id)}</span></figcaption>` +
      `</figure></div>`
    );
  };

  sections.footer = function (c) {
    const S = strings(c);
    const year = new Date().getFullYear();
    const credit = c.site.credit || {};
    const creditHtml = credit.url ? extLink(credit.url, esc(credit.text), "footer__credit-link", S) : esc(credit.text || "");
    const week = DAYS.map((d) => {
      const r = c.hours.weekly[d] || [];
      return `<li><span>${t(DAY_NAMES[d])}</span><span>${r.length ? esc(r.map((x) => x.join("–")).join(", ")) : t(S.closed)}</span></li>`;
    }).join("");
    return (
      `<div class="container footer__grid">` +
      `<div class="footer__brand"><p class="footer__name">${t(c.business.name)}</p><p class="footer__tagline">${t(c.business.tagline)}</p></div>` +
      `<div class="footer__col"><h2 class="footer__h">${t(S.findEyebrow)}</h2><p>${t(c.location.address)}</p>` +
      `<p><a href="tel:${esc(c.contact.phone)}">${esc(c.contact.phoneDisplay)}</a></p></div>` +
      `<div class="footer__col"><h2 class="footer__h">${t(S.hoursTitle)}</h2><ul class="footer__hours" role="list">${week}</ul></div>` +
      `</div>` +
      `<div class="container footer__bottom">` +
      `<p>© ${year} ${t(c.business.name)}</p>` +
      (c.site.demoNotice ? `<p class="footer__demo">${t(S.demoNotice)}</p>` : "") +
      `<p class="footer__credit">${creditHtml}</p>` +
      `<a class="footer__top" href="#top">${t(S.backToTop)} ${icon("arrow-up")}</a>` +
      `</div>`
    );
  };

  sections.actionBar = function (c) {
    const S = strings(c);
    return (
      `<a class="action-bar__btn" href="tel:${esc(c.contact.phone)}">${icon("phone")}<span>${t(S.call)}</span></a>` +
      extLink(c.contact.line.url, `${icon("chat")}<span>${t(S.line)}</span>`, "action-bar__btn action-bar__btn--line", S) +
      extLink(directionsUrl(c), `${icon("pin")}<span>${t(S.directions)}</span>`, "action-bar__btn", S)
    );
  };

  sections.lightbox = function (c) {
    const S = strings(c);
    return (
      `<div class="lightbox__stage" data-lightbox-stage>` +
      `<figure class="lightbox__figure"><picture class="lightbox__picture"><source type="image/avif"><source type="image/webp"><img class="lightbox__img" alt=""></picture>` +
      `<figcaption class="lightbox__caption"></figcaption></figure></div>` +
      `<p class="lightbox__count" aria-live="polite"></p>` +
      `<button type="button" class="icon-btn icon-btn--light lightbox__close" data-lightbox-close ${attr("aria-label", S.close)}>${icon("close")}</button>` +
      `<button type="button" class="icon-btn icon-btn--light lightbox__nav lightbox__nav--prev" data-lightbox-prev ${attr("aria-label", S.prevPhoto)}>${icon("arrow-left")}</button>` +
      `<button type="button" class="icon-btn icon-btn--light lightbox__nav lightbox__nav--next" data-lightbox-next ${attr("aria-label", S.nextPhoto)}>${icon("arrow-right")}</button>`
    );
  };

  /* ------------------------------------------------- head, SEO, theme CSS */

  function absUrl(c, path) {
    return c.site.url.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
  }

  function head(c) {
    const lang = c.site.defaultLang || "th";
    const other = lang === "th" ? "en" : "th";
    const title = both(c.seo.title);
    const desc = both(c.seo.description);
    const imgs = imagesOf();
    const og = imgs._og ? absUrl(c, `assets/img/${imgs._og.file}`) : "";
    const ogAlt = both((c.photos[c.hero.photo] || {}).alt);
    const theme = c.themes[c.theme];
    const hero = imgs[c.hero.photo];
    let preload = "";
    if (hero) {
      // Preload the hero photo so the browser starts downloading it before CSS is parsed (faster LCP).
      if (hero.portrait) {
        preload += `<link rel="preload" as="image" type="image/avif" imagesrcset="${srcset(hero.portrait, "avif")}" imagesizes="100vw" media="(max-width: 767px)" fetchpriority="high">\n`;
      }
      preload += `<link rel="preload" as="image" type="image/avif" imagesrcset="${srcset(hero, "avif")}" imagesizes="100vw"${hero.portrait ? ' media="(min-width: 768px)"' : ""} fetchpriority="high">\n`;
    }
    return [
      `<title data-title-th="${esc(title.th)}" data-title-en="${esc(title.en)}">${esc(title[lang])}</title>`,
      `<meta name="description" content="${esc(desc[lang])}">`,
      `<link rel="canonical" href="${esc(absUrl(c, ""))}">`,
      `<meta name="theme-color" content="${esc(theme.dark)}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="${esc(both(c.business.name)[lang])}">`,
      `<meta property="og:title" content="${esc(title[lang])}">`,
      `<meta property="og:description" content="${esc(desc[lang])}">`,
      `<meta property="og:url" content="${esc(absUrl(c, ""))}">`,
      `<meta property="og:locale" content="${lang === "th" ? "th_TH" : "en_US"}">`,
      `<meta property="og:locale:alternate" content="${other === "th" ? "th_TH" : "en_US"}">`,
      og ? `<meta property="og:image" content="${esc(og)}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="${esc(ogAlt[lang])}">` : "",
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${esc(title[lang])}">`,
      `<meta name="twitter:description" content="${esc(desc[lang])}">`,
      og ? `<meta name="twitter:image" content="${esc(og)}">` : "",
      `<link rel="icon" href="favicon.ico" sizes="48x48">`,
      `<link rel="icon" href="icon-192.png" type="image/png" sizes="192x192">`,
      `<link rel="apple-touch-icon" href="apple-touch-icon.png">`,
      `<link rel="manifest" href="site.webmanifest">`,
      preload.trim(),
      `<script type="application/ld+json">${jsonLd(c)}</script>`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // LocalBusiness structured data for Google. Reviews are NEVER included: Google's
  // rules forbid self-written reviews in markup, and sample text must not appear there.
  function jsonLd(c) {
    const DAY_SCHEMA = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
    const DAY_SHORT = { mon: "Mo", tue: "Tu", wed: "We", thu: "Th", fri: "Fr", sat: "Sa", sun: "Su" };
    const spec = [];
    const short = [];
    DAYS.forEach((d) =>
      (c.hours.weekly[d] || []).forEach(([opens, closes]) => {
        spec.push({ "@type": "OpeningHoursSpecification", dayOfWeek: `https://schema.org/${DAY_SCHEMA[d]}`, opens, closes });
        short.push(`${DAY_SHORT[d]} ${opens}-${closes}`);
      })
    );
    const imgs = imagesOf();
    const name = both(c.business.name);
    const data = {
      "@context": "https://schema.org",
      "@type": c.business.schemaType || "LocalBusiness",
      "@id": absUrl(c, "#business"),
      name: name.th,
      alternateName: name.en !== name.th ? name.en : undefined,
      description: both(c.seo.description).th,
      url: absUrl(c, ""),
      telephone: c.contact.phone,
      image: imgs._og ? [absUrl(c, `assets/img/${imgs._og.file}`)] : undefined,
      logo: absUrl(c, "icon-512.png"),
      priceRange: c.business.priceRange,
      servesCuisine: c.business.cuisine,
      address: {
        "@type": "PostalAddress",
        streetAddress: both(c.location.address).th,
        addressLocality: c.location.locality,
        addressRegion: c.location.region,
        postalCode: c.location.postalCode,
        addressCountry: c.location.country,
      },
      geo: { "@type": "GeoCoordinates", latitude: c.location.geo.lat, longitude: c.location.geo.lng },
      hasMap: directionsUrl(c),
      openingHours: short,
      openingHoursSpecification: spec,
      specialOpeningHoursSpecification: (c.hours.closedDates || []).map((date) => ({
        "@type": "OpeningHoursSpecification", validFrom: date, validThrough: date, opens: "00:00", closes: "00:00",
      })),
      hasMenu: absUrl(c, "#menu"),
      sameAs: [c.contact.instagram.url, c.contact.line.url].filter(Boolean),
    };
    // "<" is escaped so text in config can never close the <script> tag early.
    return JSON.stringify(data).replace(/</g, "\\u003c");
  }

  // Theme colors + blurred placeholders → css/shop.generated.css (written by bake).
  // Kept in a file (not inline <style>) so the Content-Security-Policy can stay strict.
  function themeCss(c) {
    const th = c.themes[c.theme];
    if (!th) throw new Error(`config.theme "${c.theme}" is not in config.themes`);
    const vars = Object.entries(th)
      .filter(([k]) => k !== "displayFont")
      .map(([k, v]) => `  --c-${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}: ${v};`)
      .join("\n");
    const font = th.displayFont === "sans" ? "var(--font-sans)" : "var(--font-serif)";
    let css = `/* Generated by tools/bake.mjs from config.js — edit config.js, not this file. */\n:root {\n${vars}\n  --font-display: ${font};\n}\n`;
    const imgs = imagesOf();
    Object.keys(imgs).forEach((name) => {
      if (name.startsWith("_") || !imgs[name].lqip) return;
      // Focus point from config.photos keeps the important part of a photo in view when cropped.
      const focus = /^[\d.]+% [\d.]+%$/.test((c.photos[name] || {}).focus || "") ? c.photos[name].focus : "50% 50%";
      css += `.ph-${name}{background-image:url(${imgs[name].lqip});background-position:${focus}}.ph-${name} img{object-position:${focus}}\n`;
      if (imgs[name].portrait) {
        css += `@media (max-width: 767px){.ph-${name}{background-image:url(${imgs[name].portrait.lqip})}}\n`;
      }
    });
    return css;
  }

  // Put every section into the page (browser only).
  function mountAll(doc, c) {
    doc.querySelectorAll("[data-render]").forEach((el) => {
      const fn = sections[el.getAttribute("data-render")];
      if (!fn) return;
      const html = fn(c);
      el.innerHTML = html;
      el.hidden = !html;
    });
  }

  root.ShopRender = {
    sections, head, jsonLd, themeCss, mountAll, buildId, hash, picture, srcset,
    strings, both, esc, t, attr, qrSvg, directionsUrl, DAYS, DAY_NAMES,
  };
})(typeof window !== "undefined" ? window : globalThis);
