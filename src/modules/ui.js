// ===== SECTION: User Interface Components =====
// ===== FILE PATH: src/modules/ui.js ==========

/**
 * Injects the bubble's scoped stylesheet once per page load.
 * Uses CSS custom properties for theming so switching themes is a single
 * attribute/class change rather than rewriting inline styles everywhere.
 * Scoped entirely under #floatingBubble so nothing leaks onto the host page.
 */
let stylesInjected = false;
function injectBubbleStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  GM_addStyle(`
    #floatingBubble[data-mq-theme="dark"],
    #floatingBubble.mq-auto-dark {
      --mq-bg: #141b21;
      --mq-surface: #2e3b47;
      --mq-border: #3d4c5a;
      --mq-text: #eef2f5;
      --mq-text-muted: #9fb0bd;
      --mq-accent: #00bfff;
      --mq-accent-2: #00aaff;
      --mq-accent-3: #0088ff;
    }
    #floatingBubble[data-mq-theme="light"],
    #floatingBubble.mq-auto-light {
      --mq-bg: #f7f9fb;
      --mq-surface: #ffffff;
      --mq-border: #dbe3e9;
      --mq-text: #2e3b47;
      --mq-text-muted: #5c6b78;
      --mq-accent: #00bfff;
      --mq-accent-2: #00aaff;
      --mq-accent-3: #0088ff;
    }

    #floatingBubble.mq-bubble {
      position: fixed;
      z-index: 2147483647;
      background: var(--mq-bg);
      color: var(--mq-text);
      border: 1px solid var(--mq-border);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      user-select: none;
      box-sizing: border-box;
      overflow: auto;
      display: flex;
      flex-direction: column;
      width: 460px;
      min-width: 260px;
      min-height: 90px;
      resize: both;
      /* The native resize grip always renders in the inline-end corner.
         The bubble docks bottom-right by default, which puts a plain
         resize handle right in the screen's corner - hard to grab and
         easy to drag off-screen. Flipping direction moves the grip to
         the bottom-LEFT instead, away from that corner; children below
         reset back to ltr so text/layout read normally. */
      direction: rtl;
      cursor: move;
      transition: opacity 0.2s ease;
    }
    #floatingBubble .mq-header,
    #floatingBubble .mq-content,
    #floatingBubble .mq-settings-panel {
      direction: ltr;
    }
    /* Shape/size snap instantly on collapse - animating width/height/border-radius
       together is unreliable across repeated toggles and can leave the bubble
       stuck mid-shape. !important guards against a user's saved custom size
       (see resize persistence below) overriding the fixed FAB dimensions. */
    #floatingBubble.mq-bubble.mq-collapsed {
      width: 48px !important;
      height: 48px !important;
      min-width: 0;
      min-height: 0;
      border-radius: 50%;
      resize: none;
      overflow: hidden;
    }
    #floatingBubble.mq-collapsed .mq-content,
    #floatingBubble.mq-collapsed .mq-title,
    #floatingBubble.mq-collapsed .mq-header-actions,
    #floatingBubble.mq-collapsed .mq-toggle {
      display: none;
    }
    #floatingBubble.mq-collapsed .mq-header {
      height: 48px;
      padding: 0;
      justify-content: center;
      border-radius: 50%;
      border-bottom: none;
    }

    #floatingBubble .mq-header {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      /* Fixed dark-ink band (not theme-dependent) so the blue quill glyph
         always has contrast to sit on - the old blue-on-blue gradient here
         made the icon nearly invisible. Accent color moves to the underline
         so the brand blue is still present without swallowing the glyph. */
      background: linear-gradient(135deg, #2e3b47, #141b21);
      border-bottom: 2px solid var(--mq-accent-2);
      color: #eef2f5;
      font-weight: 600;
      cursor: pointer;
    }
    #floatingBubble .mq-glyph {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 26px;
      flex-shrink: 0;
    }
    #floatingBubble .mq-glyph svg { width: 100%; height: 100%; }
    #floatingBubble .mq-title { flex: 1; white-space: nowrap; }
    #floatingBubble .mq-header-actions { display: flex; align-items: center; gap: 4px; }
    #floatingBubble .mq-icon-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
    }
    #floatingBubble .mq-icon-btn svg { width: 15px; height: 15px; }
    #floatingBubble .mq-icon-btn:hover { background: rgba(255,255,255,0.15); }
    #floatingBubble .mq-toggle { transition: transform 0.25s ease; }
    #floatingBubble.mq-collapsed .mq-toggle { transform: rotate(180deg); }

    #floatingBubble .mq-content {
      padding: 10px;
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      cursor: default;
    }
    #floatingBubble .mq-message {
      margin-bottom: 8px;
      color: #4ade80;
      font-weight: bold;
      min-height: 21px;
      transition: opacity 0.3s ease;
      opacity: 0;
    }
    #floatingBubble .mq-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      font-size: 14px;
      border-radius: 6px;
      border: 1px solid var(--mq-accent-3);
      background-color: var(--mq-accent-3);
      color: #fff;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    #floatingBubble .mq-btn svg { width: 14px; height: 14px; flex-shrink: 0; }
    #floatingBubble .mq-btn:hover:not(:disabled) { background-color: var(--mq-accent-2); }
    #floatingBubble .mq-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    #floatingBubble .mq-flex-container { display: flex; gap: 12px; align-items: flex-start; max-height: 250px; overflow: hidden; }
    #floatingBubble .mq-panel-left {
      flex: 1;
      background: var(--mq-surface);
      border: 1px solid var(--mq-border);
      padding: 8px;
      border-radius: 8px;
      max-height: 250px;
      overflow-y: auto;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 12px;
    }
    #floatingBubble .mq-panel-right {
      width: 150px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      overflow: hidden;
    }
    #floatingBubble .mq-kv-label { font-weight: bold; }
    #floatingBubble .mq-kv-value {
      cursor: pointer;
      color: var(--mq-accent);
      text-decoration: underline;
    }
    #floatingBubble .mq-download-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--mq-accent);
      text-decoration: underline;
      cursor: pointer;
      font-size: 12px;
    }
    #floatingBubble .mq-download-link svg { width: 13px; height: 13px; flex-shrink: 0; }

    #floatingBubble .mq-settings-panel {
      position: absolute;
      top: 46px;
      right: 8px;
      width: 220px;
      background: var(--mq-surface);
      border: 1px solid var(--mq-border);
      border-radius: 8px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.3);
      padding: 10px;
      display: none;
      flex-direction: column;
      gap: 8px;
      font-size: 12px;
      cursor: default;
      z-index: 1;
    }
    #floatingBubble .mq-settings-panel.mq-open { display: flex; }
    #floatingBubble .mq-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    #floatingBubble .mq-select-wrap { position: relative; display: inline-flex; }
    #floatingBubble .mq-select-wrap::after {
      content: "";
      position: absolute;
      right: 6px;
      top: 50%;
      width: 6px;
      height: 6px;
      border-right: 2px solid var(--mq-text-muted);
      border-bottom: 2px solid var(--mq-text-muted);
      transform: translateY(-70%) rotate(45deg);
      pointer-events: none;
    }
    #floatingBubble .mq-settings-panel select {
      /* appearance:none drops the browser's own arrow, which can render
         near-invisible on a dark background and make the control read as
         a plain button - the ::after chevron above replaces it reliably. */
      appearance: none;
      -webkit-appearance: none;
      background: var(--mq-bg);
      color: var(--mq-text);
      border: 1px solid var(--mq-border);
      border-radius: 4px;
      padding: 2px 20px 2px 4px;
    }
    #floatingBubble .mq-version-row { color: var(--mq-text-muted); }

    @media (prefers-reduced-motion: reduce) {
      #floatingBubble, #floatingBubble * { transition: none !important; }
    }
  `);
}

// Faithful copy of assets/icons/icon.svg's artwork (brackets, quill, node),
// stripped of Inkscape/Sodipodi metadata for inline embedding.
// The full logo (brackets + feathers) doesn't read at header-glyph size, even
// the project's own pre-rendered 32px icon is muddy at that scale. This is a
// tight crop of just the pen-nib piece of the real icon.svg artwork (exact
// bounding box computed from its path data, not eyeballed), which stays
// legible small while keeping the same faceted/vector "digitized" look.
const MQ_QUILL_GLYPH_SVG = `<svg viewBox="438 655 164 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path fill="currentColor" d="m537.89,778.41c-.1-8.88-6.62-16.18-15.1-17.53-1-.18-2.02-.25-3.07-.24-1.04.01-2.06.11-3.06.3-8.45,1.53-14.8,8.98-14.7,17.86.1,8.9,6.62,16.2,15.1,17.55l.91,82.34c-10.29-38.78-33.42-73.89-65.9-106.38,21.4-13.54,33-36.57,37.09-66.94,20.35,6.03,40.31,5.74,59.92-.58,4.75,30.23,16.89,52.98,38.54,66.02-31.75,33.2-54.09,68.82-63.52,107.82l-.91-82.34c8.45-1.53,14.8-8.98,14.7-17.88Z"/>
  <path fill="currentColor" d="m563.02,690.26c-28.59,13.53-57.95,14.15-88.14.98l-.23-20.5c28.52,13.22,57.87,13.38,88.14-.98l.23,20.5Z"/>
</svg>`;

// Icons below are Lucide (https://lucide.dev), ISC License, Copyright (c)
// Lucide Icons and Contributors - "chevron-down" is additionally derived
// from Feather, MIT License, Copyright (c) 2013-present Cole Bemis. Full
// license text: assets/lucide/LICENSE. 
const MQ_ICONS = {
  scanText: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8h8"/><path d="M7 12h10"/><path d="M7 16h6"/></svg>`,
  pencilSparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3H8"/><path d="m15.007 5.008 3.987 3.986"/><path d="M20 15v4"/><path d="M21.174 6.813a2.82 2.82 0 0 0-3.986-3.987L3.842 16.175a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="M22 17h-4"/><path d="M4 5v4"/><path d="M6 7H2"/><path d="M9 2v2"/></svg>`,
  clipboardCopy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M16 4h2a2 2 0 0 1 2 2v4"/><path d="M21 14H11"/><path d="m15 10-4 4 4 4"/></svg>`,
  refreshCw: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`,
  imageDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21"/><path d="m14 19 3 3v-5.5"/><path d="m17 22 3-3"/><circle cx="9" cy="9" r="2"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
};

/**
 * Reads persisted bubble settings, merged over defaults.
 * returnToCorner defaults to true to preserve pre-settings-panel behavior.
 */
function loadMqSettings() {
  const defaults = { theme: "dark", returnToCorner: true };
  try {
    return { ...defaults, ...JSON.parse(GM_getValue("mqSettings", "{}")) };
  } catch {
    return defaults;
  }
}

function saveMqSettings(settings) {
  GM_setValue("mqSettings", JSON.stringify(settings));
}

/**
 * Snaps the bubble back to its default bottom-right dock and clears the
 * saved drag position. Shared by the collapse-to-corner behavior and the
 * settings panel's "Reset position" button.
 */
function resetBubblePosition(bubble) {
  bubble.style.left = "auto";
  bubble.style.top = "auto";
  bubble.style.right = "20px";
  bubble.style.bottom = "20px";
  GM_setValue("bubbleX", null);
  GM_setValue("bubbleY", null);
}

let mqAutoListenerAdded = false;

/**
 * Applies the given theme to the bubble element, wiring up a live
 * prefers-color-scheme listener the first time "auto" is used.
 */
function applyMqTheme(bubble, theme) {
  bubble.dataset.mqTheme = theme;
  bubble.classList.remove("mq-auto-dark", "mq-auto-light");
  if (theme !== "auto" || typeof window.matchMedia !== "function") return;

  const setAutoClass = () => {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    bubble.classList.toggle("mq-auto-dark", isDark);
    bubble.classList.toggle("mq-auto-light", !isDark);
  };
  setAutoClass();

  if (!mqAutoListenerAdded) {
    mqAutoListenerAdded = true;
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      const current = document.getElementById("floatingBubble");
      if (current && current.dataset.mqTheme === "auto") setAutoClass();
    });
  }
}

/**
 * Builds the settings panel (theme, return-to-corner, reset position,
 * version) and appends it to the bubble as a sibling of
 * the content area. Returns the panel element and gear toggle button.
 */
function createSettingsPanel(bubble, settings) {
  const panel = document.createElement("div");
  panel.className = "mq-settings-panel";

  const themeRow = document.createElement("div");
  themeRow.className = "mq-settings-row";
  const themeLabel = document.createElement("span");
  themeLabel.textContent = "Theme";
  const themeSelect = document.createElement("select");
  [["dark", "Dark"], ["light", "Light"], ["auto", "Auto"]].forEach(([value, label]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    themeSelect.appendChild(opt);
  });
  themeSelect.value = settings.theme;
  themeSelect.onchange = () => {
    settings.theme = themeSelect.value;
    saveMqSettings(settings);
    applyMqTheme(bubble, settings.theme);
  };
  const themeSelectWrap = document.createElement("span");
  themeSelectWrap.className = "mq-select-wrap";
  themeSelectWrap.appendChild(themeSelect);

  themeRow.appendChild(themeLabel);
  themeRow.appendChild(themeSelectWrap);

  const cornerRow = document.createElement("div");
  cornerRow.className = "mq-settings-row";
  const cornerLabel = document.createElement("span");
  cornerLabel.textContent = "Return to corner when minimized";
  const cornerCheckbox = document.createElement("input");
  cornerCheckbox.type = "checkbox";
  cornerCheckbox.checked = settings.returnToCorner;
  cornerCheckbox.onchange = () => {
    settings.returnToCorner = cornerCheckbox.checked;
    saveMqSettings(settings);
  };
  cornerRow.appendChild(cornerLabel);
  cornerRow.appendChild(cornerCheckbox);

  const resetBtn = document.createElement("button");
  resetBtn.className = "mq-btn";
  resetBtn.textContent = "Reset position";
  resetBtn.onclick = () => resetBubblePosition(bubble);

  const versionRow = document.createElement("div");
  versionRow.className = "mq-version-row";
  versionRow.textContent = `MetaQuill v${GM_info.script.version}`;

  panel.appendChild(themeRow);
  panel.appendChild(cornerRow);
  panel.appendChild(resetBtn);
  panel.appendChild(versionRow);

  return { panel };
}

/**
 * Creates the floating bubble UI container with header and content.
 * Returns references for bubble, content container, and header.
 * Styling is centralized here for easier future theme toggling.
 */
function createFloatingBubbleUI(logger, onToggle, initialMinimized = false) {
  injectBubbleStyles();
  const settings = loadMqSettings();

  // Load saved position
  const savedX = GM_getValue("bubbleX", null);
  const savedY = GM_getValue("bubbleY", null);

  const savedWidth = GM_getValue("bubbleWidth", null);
  const savedHeight = GM_getValue("bubbleHeight", null);

  const bubble = document.createElement("div");
  bubble.id = "floatingBubble";
  bubble.className = "mq-bubble";
  Object.assign(bubble.style, {
    bottom: savedY !== null ? "auto" : "20px",
    right: savedX !== null ? "auto" : "20px",
    left: savedX !== null ? `${savedX}px` : "auto",
    top: savedY !== null ? `${savedY}px` : "auto",
    width: savedWidth !== null ? `${savedWidth}px` : "",
    height: savedHeight !== null ? `${savedHeight}px` : "",
  });
  applyMqTheme(bubble, settings.theme);

  // Persist manual resizes (the `.mq-collapsed` !important rules keep the
  // FAB circle fixed regardless of whatever size gets saved here).
  if (typeof ResizeObserver === "function") {
    let resizeSaveTimer = null;
    new ResizeObserver(() => {
      if (bubble.classList.contains("mq-collapsed")) return;
      clearTimeout(resizeSaveTimer);
      resizeSaveTimer = setTimeout(() => {
        GM_setValue("bubbleWidth", bubble.offsetWidth);
        GM_setValue("bubbleHeight", bubble.offsetHeight);
      }, 200);
    }).observe(bubble);
  }

  const header = document.createElement("div");
  header.className = "mq-header";

  const glyph = document.createElement("span");
  glyph.className = "mq-glyph";
  glyph.innerHTML = MQ_QUILL_GLYPH_SVG;

  const title = document.createElement("span");
  title.className = "mq-title";
  title.textContent = "MetaQuill";

  const actions = document.createElement("span");
  actions.className = "mq-header-actions";

  const gearBtn = document.createElement("button");
  gearBtn.className = "mq-icon-btn mq-gear";
  gearBtn.innerHTML = MQ_ICONS.settings;
  gearBtn.title = "Settings";

  const toggleIcon = document.createElement("span");
  toggleIcon.className = "mq-icon-btn mq-toggle";
  toggleIcon.innerHTML = MQ_ICONS.chevronDown;

  actions.appendChild(gearBtn);
  header.appendChild(glyph);
  header.appendChild(title);
  // Gear goes last (rightmost) so the settings panel below - which aligns to
  // the bubble's right edge - sits directly under it instead of the chevron.
  header.appendChild(toggleIcon);
  header.appendChild(actions);

  const content = document.createElement("div");
  content.id = "floatingBubbleContent";
  content.className = "mq-content";

  const { panel: settingsPanel } = createSettingsPanel(bubble, settings);
  gearBtn.onclick = (e) => {
    e.stopPropagation();
    settingsPanel.classList.toggle("mq-open");
  };

  // Set initial minimized state
  bubble.classList.toggle("mq-collapsed", initialMinimized);

  // Drag functionality
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let bubbleStartX = 0;
  let bubbleStartY = 0;

  const startDrag = (e) => {
    // Don't drag when clicking header, toggle icon, or directly on interactive elements
    if (e.target === header || e.target === toggleIcon) return;

    // Don't drag if clicking directly on buttons, inputs, links, selects, or other interactive elements
    if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(e.target.tagName)) {
      return;
    }

    // Don't drag if clicking the native resize handle. It renders in the
    // bottom-left corner here (see the direction:rtl trick on .mq-bubble).
    if (!bubble.classList.contains("mq-collapsed")) {
      const rect = bubble.getBoundingClientRect();
      if (e.clientX < rect.left + 16 && e.clientY > rect.bottom - 16) return;
    }

    // Don't drag if clicking within the book display area or settings panel
    let element = e.target;
    while (element && element !== bubble) {
      if (element.classList && (element.classList.contains('mq-flex-container') || element.classList.contains('mq-settings-panel'))) {
        return; // Don't start drag
      }
      element = element.parentElement;
    }

    // Allow dragging from bubble background, padding, or non-interactive content areas
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = bubble.getBoundingClientRect();
    bubbleStartX = rect.left;
    bubbleStartY = rect.top;
    bubble.style.cursor = "grabbing";
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", endDrag);
    e.preventDefault();
  };

  const drag = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    const newX = Math.max(0, Math.min(window.innerWidth - bubble.offsetWidth, bubbleStartX + deltaX));
    const newY = Math.max(0, Math.min(window.innerHeight - bubble.offsetHeight, bubbleStartY + deltaY));
    bubble.style.left = `${newX}px`;
    bubble.style.top = `${newY}px`;
    bubble.style.right = "auto";
    bubble.style.bottom = "auto";
  };

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    bubble.style.cursor = "move";
    const rect = bubble.getBoundingClientRect();
    GM_setValue("bubbleX", rect.left);
    GM_setValue("bubbleY", rect.top);
    document.removeEventListener("mousemove", drag);
    document.removeEventListener("mouseup", endDrag);
  };

  bubble.addEventListener("mousedown", startDrag);

  // Function to ensure bubble stays within viewport
  const ensureInViewport = () => {
    const rect = bubble.getBoundingClientRect();
    let newX = rect.left;
    let newY = rect.top;
    let needsReposition = false;

    // Check if bubble is outside viewport bounds
    if (rect.right > window.innerWidth) {
      newX = window.innerWidth - bubble.offsetWidth;
      needsReposition = true;
    }
    if (rect.left < 0) {
      newX = 0;
      needsReposition = true;
    }
    if (rect.bottom > window.innerHeight) {
      newY = window.innerHeight - bubble.offsetHeight;
      needsReposition = true;
    }
    if (rect.top < 0) {
      newY = 0;
      needsReposition = true;
    }

    if (needsReposition) {
      bubble.style.left = `${newX}px`;
      bubble.style.top = `${newY}px`;
      bubble.style.right = "auto";
      bubble.style.bottom = "auto";
      GM_setValue("bubbleX", newX);
      GM_setValue("bubbleY", newY);
      logger.debug("Bubble repositioned to stay in viewport");
    }
  };

  // Ensure bubble is in viewport on creation
  setTimeout(ensureInViewport, 100); // Small delay to ensure DOM is ready

  // Check viewport bounds on window resize
  window.addEventListener("resize", ensureInViewport);

  const setCollapsed = (collapsed) => {
    bubble.classList.toggle("mq-collapsed", collapsed);
    settingsPanel.classList.remove("mq-open");
    logger.debug(collapsed ? "Bubble collapsed" : "Bubble expanded");

    if (collapsed && settings.returnToCorner) {
      // Wait for the collapse transition to finish before docking to the corner
      setTimeout(() => resetBubblePosition(bubble), 310);
    }
    if (onToggle) onToggle(collapsed);
  };

  header.onclick = () => {
    if (bubble.classList.contains("mq-collapsed")) setCollapsed(false);
  };
  toggleIcon.onclick = (e) => {
    e.stopPropagation();
    setCollapsed(!bubble.classList.contains("mq-collapsed"));
  };

  bubble.appendChild(header);
  bubble.appendChild(content);
  bubble.appendChild(settingsPanel);
  document.body.appendChild(bubble);

  return { bubble, content, header };
}

/**
 * Creates a message element used to display temporary messages in the UI.
 * The message element is styled for visibility and fade transitions.
 */
function createFloatingMessage() {
  const msg = document.createElement("div");
  msg.id = "floatingBubbleMessage";
  msg.className = "mq-message";
  return msg;
}

/**
 * Shows a temporary message inside the provided element for a duration.
 * Fades out message smoothly and clears text after timeout.
 * @param {HTMLElement} el Element to display message in
 * @param {string} msg Message text to show
 * @param {number} duration Duration in ms to show message
 */
function showMessage(el, msg, duration = 3000) {
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(showMessage.timeoutId);
  showMessage.timeoutId = setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => {
      el.textContent = "";
    }, 300);
  }, duration);
}

/**
 * Creates the detailed book metadata display area inside the bubble.
 * Shows key-value pairs on left and cover image + download on right.
 * Click on a value copies it to clipboard with logging and message.
 * @param {object} data Book metadata object to display
 * @param {function} showMessageFn Function to display messages
 * @returns {HTMLElement} Container div holding the entire display
 */
function createBookDisplay(data, showMessageFn) {
  const logger = createLogger("createBookDisplay");
  const container = document.createElement("div");
  container.className = "mq-flex-container";

  const prettify = (str) =>
    str
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase())
      .trim();

  // Left pane with formatted text
  const left = document.createElement("div");
  left.className = "mq-panel-left";

  Object.entries(data).forEach(([key, value]) => {
    const isValidKey = Object.prototype.hasOwnProperty.call(bookSchema, key);

    if (!isValidKey) {
      logger.warn(
        `Key "${key}" not found in bookSchema. Available keys: ${Object.keys(
          bookSchema
        ).join(", ")}`
      );
    }

    // Explicitly skip null, undefined, empty string, or empty array
    if (
      value == null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return;
    }

    if (key === "audiobookDuration" && Array.isArray(value) && value.length) {
      const dur = value[0];
      const parts = [];
      if (dur.hours)
        parts.push(`${dur.hours} hour${dur.hours !== 1 ? "s" : ""}`);
      if (dur.minutes)
        parts.push(`${dur.minutes} minute${dur.minutes !== 1 ? "s" : ""}`);
      if (dur.seconds)
        parts.push(`${dur.seconds} second${dur.seconds !== 1 ? "s" : ""}`);
      value = parts.join(", ");
    } else if (Array.isArray(value)) {
      value =
        key === "contributors"
          ? value.map((c) => `${c.name} (${c.role})`).join(", ")
          : value.join(", ");
    }

    // Limit description to 100 characters
    let displayValue = value;
    if (
      key === "description" &&
      typeof value === "string" &&
      value.length > 100
    ) {
      displayValue = value.substring(0, 100) + "... (display truncated, click to copy full text)";
    }

    const div = document.createElement("div");
    div.style.marginBottom = "4px";

    const label = document.createElement("span");
    label.textContent = `${prettify(key)}: `;
    label.className = "mq-kv-label";

    const val = document.createElement("span");
    val.textContent = displayValue;
    val.className = "mq-kv-value";
    val.title = "Click to copy";
    val.onclick = () => {
      navigator.clipboard.writeText(value).then(() => {
        logger.info(`Copied "${key}" to clipboard.`);
        showMessageFn(`Copied ${prettify(key)} to clipboard`);
      });
    };

    div.appendChild(label);
    div.appendChild(val);
    left.appendChild(div);
  });

  container.appendChild(left);

  // Right pane with cover image + download link
  if (data.cover) {
    const right = document.createElement("div");
    right.id = "imgContainer";
    right.className = "mq-panel-right";

    const link = document.createElement("a");
    link.href = data.cover;
    link.target = "_blank";
    link.title = "Open cover image in new tab";
    link.style.display = "block";
    link.style.width = "100%";

    const img = document.createElement("img");
    img.src = data.cover;
    img.alt = data.title || "Cover Image";
    Object.assign(img.style, {
      width: "100%", // full width of container (150px)
      maxHeight: "200px", // limit height so it doesn't get too tall
      height: "auto", // keep aspect ratio
      borderRadius: "6px",
      cursor: "pointer",
      userSelect: "none",
      objectFit: "contain", // prevent cropping, keep image contained
    });

    link.appendChild(img);
    right.appendChild(link);

    const downloadLink = document.createElement("a");
    downloadLink.href = "#";
    downloadLink.className = "mq-download-link";
    downloadLink.innerHTML = MQ_ICONS.imageDown;
    downloadLink.appendChild(document.createTextNode("Download Cover"));

    downloadLink.onclick = async (e) => {
      e.preventDefault();
      try {
        const response = await fetch(data.cover, { mode: "cors" });
        if (!response.ok) throw new Error("Network response was not ok");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        const filename =
          data.cover.split("/").pop().split("?")[0] || "cover.jpg";
        a.download = filename;

        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert(
          "Failed to download image. This may be due to CORS restrictions if the script is not running from the same website as the image. You may need to save the image manually by right-clicking and selecting 'Save image as...'"
        );
        logger.error("Image download failed:", err);
      }
    };

    right.appendChild(downloadLink);
    container.appendChild(right);
  }

  return container;
}

/**
 * Creates a styled button element.
 * @param {string} label Button text label
 * @param {function} onClick Click event handler
 * @param {object} styles Optional CSS styles as an object
 * @returns {HTMLButtonElement}
 */
function createButton(label, onClick, styles = {}, iconSvg = null) {
  const btn = document.createElement("button");
  btn.className = "mq-btn";

  if (iconSvg) {
    const icon = document.createElement("span");
    icon.className = "mq-btn-icon";
    icon.innerHTML = iconSvg;
    btn.appendChild(icon);
  }
  btn.appendChild(document.createTextNode(label));

  Object.assign(btn.style, styles);
  btn.onclick = onClick;

  if (styles.disabled) {
    btn.disabled = true;
  }

  return btn;
}

// Export UI component functions for external usage
const UIComponents = {
  createFloatingBubbleUI,
  createFloatingMessage,
  showMessage,
  createBookDisplay,
  createButton,
};

