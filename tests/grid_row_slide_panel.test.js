const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const modulePath = path.join(
  __dirname, "..", "solvronix_desk", "public", "js", "grid_row_slide_panel.js"
);

function fakeJQueryElement(overrides = {}) {
  const classes = new Set();
  const handlers = {};
  const el = {
    classes,
    appendTo() { return el; },
    on(event, handler) { handlers[event] = handler; return el; },
    trigger(event) { handlers[event] && handlers[event](); return el; },
    toggleClass(name, force) {
      const add = force === undefined ? !classes.has(name) : force;
      add ? classes.add(name) : classes.delete(name);
      return el;
    },
    hasClass(name) { return classes.has(name); },
    find() { return fakeJQueryElement(); },
    first() { return el; },
    length: 1,
    ...overrides,
  };
  return el;
}

function loadModule({ config = {}, formInGridEls = [] } = {}) {
  const bodyClasses = new Set();
  const docElClasses = new Set();
  let observerCallback = null;
  const keydownHandlers = [];

  class MutationObserver {
    constructor(callback) { observerCallback = callback; }
    observe() {}
    disconnect() {}
  }

  const backdrop = fakeJQueryElement();
  const $ = (selectorOrHtml) => {
    if (typeof selectorOrHtml === "string" && selectorOrHtml.includes("st-grid-slide-backdrop")) {
      return backdrop;
    }
    if (selectorOrHtml === ".form-in-grid:visible") {
      const visible = formInGridEls.filter((e) => e.style.display !== "none");
      return {
        length: visible.length,
        first() {
          const target = visible[0];
          return {
            length: target ? 1 : 0,
            find() {
              return { trigger: () => target && target.onHeadingClick && target.onHeadingClick() };
            },
          };
        },
      };
    }
    return fakeJQueryElement();
  };

  const document = {
    documentElement: { classList: { add(name) { docElClasses.add(name); } } },
    body: { classList: { add(name) { bodyClasses.add(name); } } },
    querySelectorAll(selector) {
      if (selector === ".form-in-grid") return formInGridEls;
      return [];
    },
    addEventListener(type, handler) { if (type === "keydown") keydownHandlers.push(handler); },
  };

  const context = {
    console,
    document,
    window: { frappe: { boot: { st_theme_config: config } } },
    frappe: { boot: { st_theme_config: config } },
    MutationObserver,
    $,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(modulePath, "utf8"), context, { filename: modulePath });

  return {
    bodyClasses,
    docElClasses,
    backdrop,
    fireMutation(target) { observerCallback([{ target }]); },
    fireEscape() { keydownHandlers.forEach((h) => h({ key: "Escape" })); },
  };
}

test("feature is on by default and gates via the Theme Studio config flag", () => {
  const enabled = loadModule({ config: {} });
  assert.equal(enabled.bodyClasses.has("st-grid-slide-panel-enabled"), true);
  assert.equal(enabled.docElClasses.has("st-grid-slide-panel-enabled"), true);

  const disabled = loadModule({ config: { grid_row_slide_panel: false } });
  assert.equal(disabled.bodyClasses.has("st-grid-slide-panel-enabled"), false);
});

test("backdrop opens/closes off Frappe's real inline style, not layout-based visibility", () => {
  const panel = { classList: { contains: () => true }, style: { display: "block" } };
  const runtime = loadModule({ config: {}, formInGridEls: [panel] });

  runtime.fireMutation(panel);
  assert.equal(runtime.backdrop.hasClass("st-open"), true);

  // Frappe's allow-discrete CSS transition keeps the element rendering (and
  // jQuery's :visible true) for the whole close animation -- only the
  // inline style Frappe actually set reflects its real intent immediately,
  // which is what the observer must react to instead.
  panel.style.display = "none";
  runtime.fireMutation(panel);
  assert.equal(runtime.backdrop.hasClass("st-open"), false);
});

test("backdrop click and Escape close the currently open panel via Frappe's own toggle", () => {
  let headingClicked = false;
  const panel = {
    classList: { contains: () => true },
    style: { display: "block" },
    onHeadingClick() { headingClicked = true; },
  };
  const runtime = loadModule({ config: {}, formInGridEls: [panel] });

  runtime.fireMutation(panel);
  runtime.backdrop.trigger("click");
  assert.equal(headingClicked, true);

  headingClicked = false;
  runtime.fireEscape();
  assert.equal(headingClicked, true);
});
