/* =============================================================================
   main.js — everything interactive. Runs after the HTML is parsed ("defer").
   -----------------------------------------------------------------------------
   Contents
     1. Setup + live preview (re-render if config.js changed since the bake)
     2. Language switch (TH / EN)
     3. "Open now" status + today's row in the hours table
     4. Header (shrinks on scroll) + mobile action bar (appears after the hero)
     5. Hero parallax + optional video
     6. Scroll reveals + image fade-in
     7. Menu tabs (keyboard accessible)
     8. Gallery lightbox (keyboard + swipe)
     9. Reviews carousel
    10. Map (loads only on tap), copy address, toast, mobile menu, QR fallback
   Every feature checks that its elements exist, so removing a section from
   index.html never breaks the others.
   ========================================================================== */
(function () {
  "use strict";

  const C = window.SHOP_CONFIG;
  const R = window.ShopRender;
  const H = window.ShopHours;
  if (!C || !R || !H) return; // a script failed to load: the baked HTML still works
  const S = R.strings(C);
  const html = document.documentElement;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reducedMotion = () => motionQuery.matches;
  const lang = () => (html.lang === "en" ? "en" : "th");

  /* ------------------------------------------------ 1. Live preview of config */
  function syncWithConfig() {
    const id = R.buildId(C, window.SHOP_IMAGES);
    if (html.dataset.build === id) return; // index.html already matches config.js
    R.mountAll(document, C);
    // Theme colors: setting CSS variables from JS is allowed by the Content-Security-Policy.
    const theme = C.themes[C.theme] || {};
    Object.entries(theme).forEach(([k, v]) => {
      if (k !== "displayFont") html.style.setProperty("--c-" + k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()), v);
    });
    html.style.setProperty("--font-display", theme.displayFont === "sans" ? "var(--font-sans)" : "var(--font-serif)");
    html.dataset.build = id;
    console.info("[shop] config.js changed since the last bake, so the page was rendered in the browser. " +
      "Run `node tools/bake.mjs` so Google and LINE link previews see the new content.");
  }

  /* ------------------------------------------------------- 2. Language switch */
  // Attributes that have translations stored as data-<name>-th / data-<name>-en.
  const I18N_ATTRS = ["alt", "aria-label", "title", "data-title"];

  function applyLang(next, { save = false, animate = false } = {}) {
    html.lang = next;
    $$("[data-set-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.setLang === next)));
    I18N_ATTRS.forEach((name) => {
      $$(`[data-${name}-${next}]`).forEach((el) => el.setAttribute(name, el.getAttribute(`data-${name}-${next}`)));
    });
    const title = $("title");
    if (title && title.dataset["title" + (next === "en" ? "En" : "Th")]) document.title = title.dataset["title" + (next === "en" ? "En" : "Th")];
    if (save) {
      try { localStorage.setItem("shop-lang", next); } catch (e) { /* storage blocked */ }
    }
    if (animate && !reducedMotion()) {
      document.body.classList.remove("is-lang-swapping");
      void document.body.offsetWidth; // restart the CSS animation
      document.body.classList.add("is-lang-swapping");
    }
    tabsApi.forEach((api) => api.refresh()); // tab widths change with the language
  }

  function initLang() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-set-lang]");
      if (btn && btn.dataset.setLang !== lang()) applyLang(btn.dataset.setLang, { save: true, animate: true });
    });
    applyLang(lang());
  }

  /* --------------------------------------------------- 3. Open-now status */
  function updateStatus() {
    const status = H.getStatus(C.hours);
    const text = H.describe(status);
    $$("[data-open-status]").forEach((el) => {
      el.dataset.state = status.state;
      if (text) $(".status__text", el).innerHTML = R.t(text);
    });
    $$(".hours__table tr[data-day]").forEach((tr) => {
      const today = tr.dataset.day === status.todayKey;
      tr.classList.toggle("is-today", today);
      if (today) tr.setAttribute("aria-current", "date");
      else tr.removeAttribute("aria-current");
    });
  }

  /* ------------------------------- 4. Header shrink + mobile action bar */
  function initHeader() {
    const header = $("[data-header]");
    const hero = $("[data-hero]");
    const bar = $("[data-action-bar]");
    if (header) {
      // A 1px marker at the top of the page: when it scrolls out of view, the header shrinks.
      // IntersectionObserver is cheaper than listening to every scroll event.
      const marker = document.createElement("div");
      marker.className = "scroll-marker";
      document.body.prepend(marker);
      new IntersectionObserver(([entry]) => header.classList.toggle("is-scrolled", !entry.isIntersecting)).observe(marker);
    }
    if (bar && hero) {
      const setBar = (show) => {
        bar.classList.toggle("is-visible", show);
        bar.inert = !show; // hidden bar can't be reached with Tab
        if (show) bar.removeAttribute("aria-hidden");
        else bar.setAttribute("aria-hidden", "true");
      };
      setBar(false);
      new IntersectionObserver(([entry]) => setBar(entry.intersectionRatio < 0.2), { threshold: [0, 0.2, 0.5] }).observe(hero);
    }
  }

  /* --------------------------------------------- 5. Parallax + hero video */
  function initParallax() {
    const layer = $("[data-parallax]");
    const hero = $("[data-hero]");
    if (!layer || !hero) return;
    let heroHeight = hero.offsetHeight;
    let queued = false;
    const update = () => {
      queued = false;
      if (reducedMotion()) {
        layer.style.transform = "";
        return;
      }
      const y = window.scrollY;
      if (y > heroHeight) return; // hero is off screen: nothing to move
      // Move the photo down at 18% of the scroll speed (it has 18% extra height, see CSS).
      layer.style.transform = `translate3d(0, ${(y * 0.18).toFixed(1)}px, 0)`;
    };
    // requestAnimationFrame: do the work at most once per frame, never inside the scroll event.
    const onScroll = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => { heroHeight = hero.offsetHeight; onScroll(); }, { passive: true });
    motionQuery.addEventListener("change", update);
    update();

    const video = $("[data-hero-video]");
    const saveData = navigator.connection && navigator.connection.saveData;
    if (video && !reducedMotion() && !saveData) {
      video.preload = "auto";
      video.addEventListener("playing", () => video.classList.add("is-playing"), { once: true });
      video.play().catch(() => { /* autoplay blocked: the photo stays */ });
    }
  }

  /* ----------------------------------------- 6. Reveals + image fade-in */
  function initReveals() {
    // Children of [data-stagger] get --i = 0,1,2… so CSS can delay each one a little more.
    $$("[data-stagger]").forEach((group) => {
      Array.from(group.children).forEach((child, i) => child.style.setProperty("--i", String(i % 8)));
    });
    const items = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-in"));
    } else {
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target); // reveal once, then stop watching
          }
        }),
        { rootMargin: "0px 0px -6% 0px", threshold: 0.08 }
      );
      items.forEach((el) => io.observe(el));
    }
    // Photos fade in over their blurred placeholder once loaded.
    $$(".media img").forEach((img) => {
      const done = () => img.classList.add("is-loaded");
      if (img.complete && img.naturalWidth) done();
      else {
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      }
    });
  }

  // A sideways-scrolling row must be focusable so keyboards can scroll it, but
  // only while it actually scrolls. On desktop it's a grid: no extra Tab stop.
  function initScrollRows() {
    $$("[data-scroll-row]").forEach((row) => {
      const update = () => {
        if (row.scrollWidth > row.clientWidth + 1) row.setAttribute("tabindex", "0");
        else row.removeAttribute("tabindex");
      };
      update();
      if ("ResizeObserver" in window) new ResizeObserver(update).observe(row);
    });
  }

  /* ----------------------------------------------------------- 7. Menu tabs */
  const tabsApi = [];
  function initTabs() {
    $$("[data-tabs]").forEach((root) => {
      const list = $("[role=tablist]", root);
      const tabs = $$("[role=tab]", root);
      const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
      const indicator = $(".tabs__indicator", root);
      let current = Math.max(0, tabs.findIndex((t) => t.getAttribute("aria-selected") === "true"));

      // The underline is one element moved with transform (no layout work = smooth).
      const moveIndicator = () => {
        const tab = tabs[current];
        if (!indicator || !tab) return;
        indicator.style.transform = `translateX(${tab.offsetLeft}px) scaleX(${tab.offsetWidth / 100})`;
      };
      const keepVisible = (tab) => {
        // Scroll the tab row sideways (not the page) if the tab is cut off on a small screen.
        const left = tab.offsetLeft - 16;
        const right = tab.offsetLeft + tab.offsetWidth + 16;
        if (left < list.scrollLeft) list.scrollTo({ left, behavior: reducedMotion() ? "auto" : "smooth" });
        else if (right > list.scrollLeft + list.clientWidth) list.scrollTo({ left: right - list.clientWidth, behavior: reducedMotion() ? "auto" : "smooth" });
      };
      const select = (i, { focus = false, user = false } = {}) => {
        current = (i + tabs.length) % tabs.length;
        tabs.forEach((tab, j) => {
          const on = j === current;
          tab.setAttribute("aria-selected", String(on));
          tab.tabIndex = on ? 0 : -1;
          panels[j].hidden = !on;
        });
        if (user) {
          // Restart the entrance animation (only for clicks; on page load the panel
          // is revealed by the scroll animation instead).
          const panel = panels[current];
          panel.classList.remove("is-entering");
          void panel.offsetWidth; // reading a size forces the browser to notice the removal
          panel.classList.add("is-entering");
          keepVisible(tabs[current]);
        }
        if (focus) tabs[current].focus();
        // Measure in the next frame, after the browser has done its own layout work.
        requestAnimationFrame(moveIndicator);
      };

      list.addEventListener("click", (e) => {
        const tab = e.target.closest("[role=tab]");
        if (tab) select(tabs.indexOf(tab), { user: true });
      });
      // Keyboard pattern from the WAI-ARIA Authoring Practices: arrows move, Home/End jump.
      list.addEventListener("keydown", (e) => {
        const keys = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: tabs.length - 1 };
        if (!(e.key in keys)) return;
        e.preventDefault();
        select(keys[e.key], { focus: true, user: true });
      });

      root.classList.add("is-enhanced");
      select(current);
      // The underline starts animating only after it has its first position.
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-ready")));
      if ("ResizeObserver" in window) new ResizeObserver(moveIndicator).observe(list);
      if (document.fonts) document.fonts.ready.then(moveIndicator);
      tabsApi.push({ refresh: moveIndicator });
    });
  }

  /* ----------------------------------------------------- 8. Gallery lightbox */
  function initLightbox() {
    const dialog = $("[data-lightbox]");
    const buttons = $$("[data-lightbox-index]");
    if (!dialog || !buttons.length || typeof dialog.showModal !== "function") return;
    const stage = $("[data-lightbox-stage]", dialog);
    const figure = $(".lightbox__figure", dialog);
    const [avif, webp] = $$("source", dialog);
    const img = $(".lightbox__img", dialog);
    const caption = $(".lightbox__caption", dialog);
    const counter = $(".lightbox__count", dialog);
    let index = 0;
    let opener = null;

    const altOf = (name) => R.both((C.photos[name] || {}).alt)[lang()];
    const show = (i, direction = 0) => {
      index = (i + buttons.length) % buttons.length;
      const name = buttons[index].dataset.photo;
      const entry = (window.SHOP_IMAGES || {})[name];
      if (!entry) return;
      avif.srcset = R.srcset(entry, "avif");
      webp.srcset = R.srcset(entry, "webp");
      avif.sizes = webp.sizes = "92vw";
      img.width = entry.w;
      img.height = entry.h;
      img.src = `assets/img/${entry.file}-${(entry.jpg || entry.widths).slice(-1)[0]}.jpg`;
      img.alt = altOf(name);
      caption.textContent = altOf(name);
      counter.textContent = `${index + 1} / ${buttons.length}`;
      figure.dataset.direction = String(direction);
      figure.classList.remove("is-switching");
      void figure.offsetWidth;
      figure.classList.add("is-switching");
    };
    const open = (i, btn) => {
      opener = btn;
      show(i);
      dialog.showModal(); // native modal: traps focus, Esc closes, page behind is inert
      html.classList.add("has-modal");
    };
    const close = () => {
      if (!dialog.open) return;
      if (reducedMotion()) return dialog.close();
      dialog.classList.add("is-closing");
      setTimeout(() => { dialog.classList.remove("is-closing"); dialog.close(); }, 200);
    };
    dialog.addEventListener("close", () => {
      html.classList.remove("has-modal");
      if (opener) opener.focus();
    });
    dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(); }); // Esc → animated close

    buttons.forEach((btn, i) => btn.addEventListener("click", () => open(i, btn)));
    $("[data-lightbox-close]", dialog).addEventListener("click", close);
    $("[data-lightbox-prev]", dialog).addEventListener("click", () => show(index - 1, -1));
    $("[data-lightbox-next]", dialog).addEventListener("click", () => show(index + 1, 1));
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") show(index + 1, 1);
      if (e.key === "ArrowLeft") show(index - 1, -1);
    });
    // Click on the dark area around the photo closes it.
    dialog.addEventListener("click", (e) => { if (e.target === dialog || e.target === stage) close(); });

    // Swipe: follow the finger, then go next/previous if it moved far enough.
    let startX = null;
    let dx = 0;
    stage.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      startX = e.clientX;
      dx = 0;
      figure.classList.add("is-dragging");
    });
    stage.addEventListener("pointermove", (e) => {
      if (startX === null) return;
      dx = e.clientX - startX;
      figure.style.transform = `translate3d(${dx}px, 0, 0)`;
    });
    const endSwipe = () => {
      if (startX === null) return;
      figure.classList.remove("is-dragging");
      figure.style.transform = "";
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      startX = null;
    };
    stage.addEventListener("pointerup", endSwipe);
    stage.addEventListener("pointercancel", endSwipe);
  }

  /* ----------------------------------------------------- 9. Reviews carousel */
  function initCarousel() {
    $$("[data-carousel]").forEach((root) => {
      const track = $(".carousel__track", root);
      const slides = $$("[data-slide]", track);
      const dots = $$("[data-dot]", root);
      const prev = $("[data-carousel-prev]", root);
      const next = $("[data-carousel-next]", root);
      let active = 0;
      // Native CSS scroll-snap does the swiping; JS only adds buttons and dots.
      const go = (i) => {
        const target = slides[Math.max(0, Math.min(slides.length - 1, i))];
        track.scrollTo({ left: target.offsetLeft - slides[0].offsetLeft, behavior: reducedMotion() ? "auto" : "smooth" });
      };
      // On wide screens several slides are visible at once: the "active" one is the
      // first visible slide, and "next" is disabled once the last slide is visible.
      const visible = new Set([0]);
      const update = () => {
        active = visible.size ? Math.min(...visible) : active;
        dots.forEach((d, j) => d.setAttribute("aria-current", String(j === active)));
        if (prev) prev.disabled = active === 0;
        if (next) next.disabled = visible.has(slides.length - 1);
      };
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            const i = slides.indexOf(e.target);
            if (e.isIntersecting) visible.add(i);
            else visible.delete(i);
          });
          update();
        },
        { root: track, threshold: 0.6 }
      );
      slides.forEach((s) => io.observe(s));
      prev && prev.addEventListener("click", () => go(active - 1));
      next && next.addEventListener("click", () => go(active + 1));
      dots.forEach((d, i) => d.addEventListener("click", () => go(i)));
      update();
    });
  }

  /* ---------------- 10. Map on tap, copy address, toast, mobile menu, QR */
  function initMap() {
    $$("[data-map-load]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const box = btn.closest("[data-map]");
        const lat = parseFloat(box.dataset.lat);
        const lng = parseFloat(box.dataset.lng);
        const d = 0.006; // how much area around the pin (in degrees) the map shows
        const src = box.dataset.embed === "google"
          ? `https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`
          : `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d * 0.6},${lng + d},${lat + d * 0.6}&layer=mapnik&marker=${lat},${lng}`;
        const frame = document.createElement("iframe");
        frame.className = "map__frame";
        frame.src = src;
        frame.title = box.getAttribute("data-title") || "Map";
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        frame.addEventListener("load", () => box.classList.add("is-ready"), { once: true });
        box.classList.add("is-loading");
        box.appendChild(frame);
        btn.hidden = true;
        frame.focus();
      })
    );
  }

  let toastTimer;
  function toast(message) {
    const el = $("[data-toast]");
    if (!el) return;
    el.innerHTML = R.t(message);
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2800);
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    // Older browsers / file:// preview: the old textarea trick.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.className = "visually-hidden";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (!ok) throw new Error("copy failed");
  }

  function initCopy() {
    $$("[data-copy-th]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const text = btn.getAttribute(`data-copy-${lang()}`) || btn.getAttribute("data-copy-th");
        try {
          await copyText(text);
          toast(S.copied);
          btn.classList.add("is-done");
          setTimeout(() => btn.classList.remove("is-done"), 1600);
        } catch (e) {
          toast(S.copyFailed);
        }
      })
    );
  }

  function initSheet() {
    const sheet = $("[data-sheet]");
    const openBtn = $(".menu-btn");
    if (!sheet || !openBtn || typeof sheet.showModal !== "function") return;
    const close = (after) => {
      if (!sheet.open) return after && after();
      const finish = () => { sheet.classList.remove("is-closing"); sheet.close(); after && after(); };
      if (reducedMotion()) return finish();
      sheet.classList.add("is-closing");
      setTimeout(finish, 220);
    };
    openBtn.addEventListener("click", () => {
      sheet.showModal();
      openBtn.setAttribute("aria-expanded", "true");
      html.classList.add("has-modal");
    });
    sheet.addEventListener("close", () => {
      openBtn.setAttribute("aria-expanded", "false");
      html.classList.remove("has-modal");
    });
    sheet.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    sheet.addEventListener("click", (e) => {
      const link = e.target.closest("[data-close-sheet]");
      if (e.target === sheet) return close();
      if (!link) return;
      const href = link.getAttribute("href");
      if (href && href.startsWith("#")) {
        // Close first, then jump: scrolling a page behind an open modal doesn't work.
        e.preventDefault();
        close(() => {
          const target = document.querySelector(href);
          if (target) {
            target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
            history.pushState(null, "", href);
          }
        });
      } else {
        close();
      }
    });
    openBtn.setAttribute("aria-expanded", "false");
  }

  // The QR code is normally baked into the HTML. Only if it's missing (config changed
  // without baking) do we download the QR library and draw it here.
  function initQr() {
    const box = $("[data-qr]");
    if (!box || box.querySelector("svg")) return;
    const script = document.createElement("script");
    script.src = "js/vendor/qrcode.js";
    script.onload = () => { box.innerHTML = R.qrSvg(box.dataset.qr); };
    document.head.appendChild(script);
  }

  /* ------------------------------------------------------------------ start */
  syncWithConfig();
  initLang();
  updateStatus();
  setInterval(updateStatus, 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) updateStatus(); });
  initHeader();
  initParallax();
  initReveals();
  initScrollRows();
  initTabs();
  initLightbox();
  initCarousel();
  initMap();
  initCopy();
  initSheet();
  initQr();
  html.classList.add("is-ready");
})();
