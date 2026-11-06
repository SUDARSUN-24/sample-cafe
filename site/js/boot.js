/* boot.js — runs in <head>, before the page is drawn, so there is no flash of
   the wrong language and animations know JavaScript is available.
   Kept tiny on purpose (it blocks rendering for a moment). */
(function () {
  var html = document.documentElement;
  // "js" class: CSS only hides elements for reveal animations when JS is running.
  html.classList.add("js");
  try {
    var saved = localStorage.getItem("shop-lang");
    if (saved === "th" || saved === "en") html.lang = saved;
  } catch (e) {
    /* private mode or storage blocked: keep the default language */
  }
  // Safety net: if main.js fails to load, reveal everything after 3 seconds
  // instead of leaving content invisible.
  setTimeout(function () {
    if (!html.classList.contains("is-ready")) html.classList.add("reveal-all");
  }, 3000);
})();
