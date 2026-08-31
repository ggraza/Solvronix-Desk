/* ================================================================
   Solvronix Desk — Slide-in child table row editor (Task 3)
   The actual open/close animation is pure CSS (grid_row_slide_panel.css,
   @starting-style + transition-behavior: allow-discrete driven by Frappe's
   own display:block/none toggle on .form-in-grid) — Frappe's GridRow/
   GridRowForm classes aren't exposed globally, so patching them isn't an
   option, and this approach needs none of that: it doesn't touch Frappe's
   own open/close logic at all, just restyles what's already there.
   This file only does two small, additive things neither Frappe nor CSS
   alone can: (1) gate the feature behind the Theme Studio toggle, and
   (2) show/hide a shared backdrop, since a slide-in panel with no dimming
   behind it doesn't read as "modal-like" at a glance.
   ================================================================ */
(function () {
  "use strict";

  function isEnabled() {
    var cfg = (window.frappe && frappe.boot && frappe.boot.st_theme_config) || {};
    return cfg.grid_row_slide_panel !== false; // default on, explicit false opts out
  }

  if (!isEnabled()) return;
  document.documentElement.classList.add("st-grid-slide-panel-enabled");
  document.body ?
    document.body.classList.add("st-grid-slide-panel-enabled") :
    document.addEventListener("DOMContentLoaded", function () {
      document.body.classList.add("st-grid-slide-panel-enabled");
    });

  var $backdrop = null;

  function ensureBackdrop() {
    if ($backdrop) return $backdrop;
    $backdrop = $('<div class="st-grid-slide-backdrop"></div>').appendTo("body");
    $backdrop.on("click", function () {
      // Close via Frappe's own toggle — the currently-open panel's header/footer
      // already has Frappe's real click-to-close handler wired (it travels with
      // the element regardless of how it's styled), so this triggers the same
      // row.toggle_view() Frappe's own UI would.
      var $open = $(".form-in-grid:visible").first();
      $open.find(".grid-form-heading").trigger("click");
    });
    return $backdrop;
  }

  function syncBackdrop() {
    // Check the inline style Frappe actually set, not jQuery's :visible —
    // the CSS uses transition-behavior: allow-discrete so the panel keeps
    // rendering (and reads as :visible) for the whole slide-out animation;
    // el.style.display reflects Frappe's real intent immediately instead.
    var anyOpen = false;
    document.querySelectorAll(".form-in-grid").forEach(function (el) {
      if (el.style.display !== "none") anyOpen = true;
    });
    ensureBackdrop().toggleClass("st-open", anyOpen);
  }

  // Frappe only ever toggles display:block/none on an already-in-DOM
  // .form-in-grid (created once per row, reused after) — a MutationObserver
  // on style/class attribute changes, scoped to grid containers, is the
  // established pattern this codebase already uses elsewhere (see
  // solvronix_desk.js's sidebar-repatch observer) for reacting to state
  // Frappe manages internally without an exposed hook.
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var target = mutations[i].target;
      if (target.classList && target.classList.contains("form-in-grid")) {
        syncBackdrop();
        return;
      }
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["style"],
    subtree: true,
  });

  // Escape closes the open panel the same way the backdrop click does.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var $open = $(".form-in-grid:visible").first();
    if ($open.length) $open.find(".grid-form-heading").trigger("click");
  });
})();
