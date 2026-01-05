// ==UserScript==
// @name         MetaQuill
// @namespace    https://github.com/kyle-mckay/metaquill
// @updateURL    https://raw.githubusercontent.com/kyle-mckay/metaquill/main/metaquill.user.js
// @downloadURL  https://raw.githubusercontent.com/kyle-mckay/metaquill/main/metaquill.user.js
// @author       kyle-mckay
// @version      1.6.1
// @description  Extract book metadata from supported sites like Goodreads and optionally inject into sites like Hardcovers.app for easier book creation.
// @match        https://www.goodreads.com/*
// @match        https://hardcover.app/*
// @match        https://audible.ca/*
// @match        https://app.thestorygraph.com/books/*
// @include /^https:\/\/(www\.)?amazon\.[a-z.]+\/dp\/[A-Z0-9]{10}(?:[/?].*)?$/
// @include /^https:\/\/(www\.)?amazon\.[a-z.]+\/[^\/]+\/dp\/[A-Z0-9]{10}(?:[/?].*)?$/
// @include /^https:\/\/(www\.)?google\.[a-z.]+\/books(?:[/?].*)?$/
// @include /^https:\/\/(?:www\.)?books\.google\.[a-z.]+(?:[/?].*)?$/
// @icon         https://raw.githubusercontent.com/kyle-mckay/metaquill/refs/heads/main/assets/icons/icon-128.png
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @license      MIT
// ==/UserScript==

const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

let currentLogLevel = LogLevel.INFO; // Change this to control global verbosity
let bubbleRefresh = 2000; // The number of miliseconds the bubble refreshes the URL. Allows buttons to show/hide dynamically during normal navigation.

// ===== SECTION: Utilities and Functions =====
// ===== FILE PATH: src/modules/utilities.js ==========

/**
 * Logging utility with configurable verbosity levels and named loggers.
 *
 * LogLevel enum defines severity levels: ERROR (0), WARN (1), INFO (2), DEBUG (3).
 * currentLogLevel controls the global log output verbosity.
 * bubbleRefresh sets refresh interval for UI bubbles (not related to logging).
 *
 * createLogger(fnName): Returns a logger object scoped to the given function/module name.
 * Each logger method prepends the fnName to the message for clear context.
 *
 * log(level, ...args): Internal function routing logs to console based on level and currentLogLevel.
 */

function createLogger(fnName) {
  return {
    error: (msg, ...args) => log(LogLevel.ERROR, `[${fnName}] ${msg}`, ...args),
    warn: (msg, ...args) => log(LogLevel.WARN, `[${fnName}] ${msg}`, ...args),
    info: (msg, ...args) => log(LogLevel.INFO, `[${fnName}] ${msg}`, ...args),
    debug: (msg, ...args) => log(LogLevel.DEBUG, `[${fnName}] ${msg}`, ...args),
  };
}

function log(level, ...args) {
  if (level <= currentLogLevel) {
    switch (level) {
      case LogLevel.ERROR:
        console.error("[MetaQuill] [ERROR]", ...args);
        break;
      case LogLevel.WARN:
        console.warn("[MetaQuill] [WARN]", ...args);
        break;
      case LogLevel.INFO:
        console.info("[MetaQuill] [ℹINFO]", ...args);
        break;
      case LogLevel.DEBUG:
        console.debug("[MetaQuill] [DEBUG]", ...args);
        break;
    }
  }
}

/**
 * Schema definition object representing the structure of extracted book metadata.
 * Fields include identifiers, descriptive info, contributors, publication details, and more.
 * This serves as the standardized data container for book extraction results.
 */
const bookSchema = {
  title: "",
  subtitle: "",
  urlSlug: "",
  headline: "", // Description headline field
  description: "", // Multi text book description
  literaryType: "", // Fiction, Non-Fiction or 'Unknown or Not Applicable'
  bookCategory: "", // Book, Novella, Short Story, Graphic Novel, Fan Fiction, Research Paper, Poetry, Collection, Web Novel, Light Novel
  compilation: "", // If it is a compilation of other books
  seriesName: "",
  seriesNumber: "",
  isbn10: "",
  isbn13: "",
  asin: "",
  sourceId: "", // The source ID from the extracted site (Goodreads, Amazon, Google Books, etc.)
  cover: "", // Image URL
  authors: [], // Array of authors
  contributors: [], // Array of contributors and their role
  publisher: "",
  readingFormat: "", // Physical Book, Audiobook, E-Book
  pageCount: null,
  audiobookDuration: [], // Hours, Minutes, Seconds
  editionFormat: "", // Hardcover, Paperback, Kindle
  editionInfo: "", // Reprint, Large Print, etc.
  releaseDate: "",
  releaseLanguage: "",
  releaseCountry: "",
};

/**
 * Attempts to retrieve a higher resolution version of a given image URL.
 * Handles general Amazon-style thumbnails and Goodreads-hosted images.
 *
 * - For Amazon images, removes size modifiers (e.g., `._SY75_`) to get original.
 * - For Goodreads images, replaces the `i` suffix with `l` to request a large version.
 * - If the Goodreads high-res URL fails to load (404), falls back to original URL.
 *
 * @param {string} src - The original image URL.
 * @returns {Promise<string>} - A promise that resolves to the high-resolution image URL or original.
 */
/**
 * Attempts to resolve the highest resolution version of a given image URL.
 * Tries known transformations for Amazon and Goodreads, checks each image,
 * and returns the URL of the largest image by pixel area.
 *
 * @param {string} src - The original image URL
 * @returns {Promise<string>} - The URL of the highest resolution image
 */
async function getHighResImageUrl(src) {
  const logger = createLogger("getHighResImageUrl");
  logger.debug(`Original source URL: ${src}`);

  const candidates = new Set();

  // Add original URL
  candidates.add(src);

  // Amazon cleaned format (removes ._SY75_, etc.)
  candidates.add(src.replace(/\._[^.]+(?=\.)/, ""));

  // Goodreads fallback: remove 'compressed.photo.' if present
  if (src.includes("goodreads.com")) {
    // Base URLs for both with and without compressed.photo.
    const baseUrls = [src, src.replace("compressed.photo.", "")];

    const suffixes = ["i", "l", "m", ""]; // suffix variants

    baseUrls.forEach((baseUrl) => {
      const match = baseUrl.match(/(goodreads\.com\/books\/\d+)([ilm]?)\//);
      if (match) {
        const base = match[1];
        const originalSuffix = match[2];

        suffixes.forEach((suffix) => {
          if (suffix !== originalSuffix) {
            const variant = baseUrl.replace(
              new RegExp(`${base}${originalSuffix}\\/`),
              `${base}${suffix}/`
            );
            candidates.add(variant);
          }
        });
      } else {
        // If no suffix pattern found, just add the baseUrl as is.
        candidates.add(baseUrl);
      }
    });
  }

  const urls = Array.from(candidates);

  logger.debug("Attempting to find highest resolution cover...");
  const tested = await Promise.all(
    urls.map(
      (url) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            logger.debug(
              `Loaded: ${url} [${img.naturalWidth}x${img.naturalHeight}]`
            );
            resolve({ url, resolution: img.naturalWidth * img.naturalHeight });
          };
          img.onerror = () => {
            logger.warn(`Failed to load: ${url}`);
            resolve({ url, resolution: 0 });
          };
          img.src = url;
        })
    )
  );

  const best = tested.reduce((a, b) => (b.resolution > a.resolution ? b : a));

  logger.debug(`Selected URL: ${best.url}`);
  return best.url;
}

/**
 * Saves the given book data object to persistent storage using GM_setValue.
 * Logs each step including warnings when no data is provided and errors during serialization or saving.
 * @param {Object} data - Book data to be saved.
 */
function saveBookData(data) {
  const logger = createLogger("saveBookData");

  if (!data) {
    logger.warn("No data provided to save.");
    return;
  }

  try {
    const jsonData = JSON.stringify(data);
    logger.debug("Serialized data:", jsonData);
    GM_setValue("bookData", jsonData);
    GM_setValue("lastExtractionTime", Date.now());
    logger.info("Book data saved successfully.");
  } catch (error) {
    logger.error("Failed to save book data:", error);
  }
}

/**
 * Loads book data from persistent storage using GM_getValue.
 * Returns a parsed object or an empty object on failure.
 * Logs the raw data retrieved and any errors encountered during parsing.
 * @returns {Object} Parsed book data object.
 */
function loadBookData() {
  const logger = createLogger("loadBookData");
  try {
    const rawData = GM_getValue("bookData", "{}");
    logger.debug("Raw stored data:", rawData);
    const bookData = JSON.parse(rawData);
    logger.info("Book data loaded successfully.");
    return bookData;
  } catch (error) {
    logger.error("Failed to load or parse book data:", error);
    return {}; // Return empty object on failure to avoid breaking code
  }
}

/**
 * Converts an HTML element's content to plain text while preserving line breaks.
 * Replaces <br> tags with newline characters and wraps <p> elements with newlines.
 * Clones the element to avoid modifying the original DOM.
 * @param {HTMLElement} htmlElement - The source HTML element.
 * @returns {string} Text content with line breaks preserved.
 */
function htmlToTextWithLineBreaks(htmlElement) {
  if (!htmlElement) return "";

  // Clone the element so we don't modify the original DOM
  const clone = htmlElement.cloneNode(true);

  // Replace <br> with newline characters
  clone.querySelectorAll("br").forEach((br) => {
    br.replaceWith("\n");
  });

  // Replace <p> with newlines before and after
  clone.querySelectorAll("p").forEach((p) => {
    const text = p.textContent.trim();
    const textWithBreaks = "\n" + text + "\n";
    p.replaceWith(textWithBreaks);
  });

  // Get the cleaned text
  return clone.textContent.trim();
}

/**
 * Deduplicates an array of authors (strings) or contributors (objects).
 *
 * - For authors (array of strings), it trims whitespace and removes duplicates based on name.
 * - For contributors (array of objects with `name` and `role`), it deduplicates based on
 *   a composite key of name + role, ignoring case and extra whitespace.
 *
 * @param {Array<string|Object>} arr - The array to deduplicate.
 * @returns {Array} - A new deduplicated array.
 */
function dedupeObject(arr) {
  const logger = createLogger("dedupeObject");
  logger.debug(`Initialized with data: ${JSON.stringify(arr)}`);
  if (!Array.isArray(arr)) {
    logger.debug("Input is not an array");
    return [];
  }

  if (arr.length === 0) {
    logger.debug("Empty array, nothing to dedupe");
    return [];
  }

  // Deduplicating authors (strings)
  if (typeof arr[0] === "string") {
    logger.debug(`Deduplicating ${arr.length} author(s)`);
    const deduped = [...new Set(arr.map((name) => name.trim()))];
    logger.debug(`Resulting author count: ${deduped.length}`);
    return deduped;
  }

  // Deduplicating contributors (objects)
  logger.debug(`Deduplicating ${arr.length} contributor(s)`);
  const seen = new Set();
  const deduped = [];

  for (const obj of arr) {
    const key = `${obj.name.trim().toLowerCase()}|${obj.role
      .trim()
      .toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(obj);
    } else {
      logger.debug(`Skipping duplicate: ${obj.name} (${obj.role})`);
    }
  }

  logger.debug(`Resulting contributor count: ${deduped.length}`);
  return deduped;
}

/**
 * Converts an ISO 639 language code (optionally with region) to its display name.
 *
 * @param {string} code - Language code (e.g., 'en', 'pt-BR', 'fr-CA').
 * @param {string} [locale='en'] - Output language for the display name.
 * @returns {string} - Full language name (e.g., 'English', 'Portuguese (Brazil)').
 */
function getLanguageName(code, locale = 'en') {
  const logger = createLogger("getLanguageName");
  logger.debug(`Attempting to normalize language code: ${code}`)
  try {
    // Intl.DisplayNames handles both plain language codes and language+region codes
    const displayNames = new Intl.DisplayNames([locale], { type: 'language' });
    return displayNames.of(code);
  } catch {
    logger.error(`Failed to get language name for code: ${code}`);
    return ""; // fallback if invalid code
  }
}

/**
 * Site-specific modules for detecting and extracting book data.
 * Each module provides:
 * - detect(): returns boolean if the current page matches the site structure.
 * - extract(): calls site-specific extraction function and returns extracted data.
 *
 * Uses createLogger for debug tracing of detection and extraction processes.
 */
const siteModules = {
  "goodreads.com": {
    detect() {
      const logger = createLogger("siteModules.goodreads.detect");
      logger.debug("Running detection on www.goodreads.com");

      const found =
        document.querySelector('h1[data-testid="bookTitle"]') !== null;
      logger.debug(`Detection result: ${found}`);

      return found;
    },
    extract() {
      const logger = createLogger("siteModules.goodreads.extract");
      logger.debug("Calling extractGoodreads()");

      const result = extractGoodreads();
      logger.debug("extractGoodreads() returned:", result);

      return result;
    },
  },
  amazon: {
    detect() {
      const logger = createLogger("siteModules.amazon.detect");
      logger.debug("Running detection on amazon");

      const found = Boolean(document.querySelector("#productTitle"));
      logger.debug(`Detection result: ${found}`);

      return found;
    },
    extract() {
      const logger = createLogger("siteModules.amazon.extract");
      logger.debug("Calling extractAmazon()");

      const result = extractAmazon();
      logger.debug("extractAmazon() returned:", result);

      return result;
    },
  },
  google: {
    detect() {
      const logger = createLogger("siteModules.google.detect");
      logger.debug("Running detection on google");
      // TODO: Update found
      const found = true;
      logger.debug(`Detection result: ${found}`);

      return found;
    },
    extract() {
      const logger = createLogger("siteModules.google.extract");
      logger.debug("Calling extractGoogle()");

      const result = extractGoogle();
      logger.debug("extractGoogle() returned:", result);

      return result;
    },
  },
  storygraph: {
    detect() {
      const logger = createLogger("siteModules.storygraph.detect");
      logger.debug("Running detection on storygraph");

      // More comprehensive detection that doesn't rely on specific dynamic content
      const hasBookStructure = Boolean(
        document.querySelector(".book-title-author-and-series") ||
          document.querySelector(".book-cover") ||
          document.querySelector(".edition-info")
      );

      // Also check URL pattern as backup
      const isBookPage = window.location.pathname.includes("/books/");

      const found = hasBookStructure && isBookPage;

      logger.debug(
        `Detection result: ${found} (hasBookStructure: ${hasBookStructure}, isBookPage: ${isBookPage})`
      );
      return found;
    },
    extract() {
      const logger = createLogger("siteModules.storygraph.extract");
      logger.debug("Calling extractStoryGraph()");

      const result = extractStoryGraph();
      logger.debug("extractStoryGraph() returned:", result);

      return result;
    },
  },
  // add other site modules here
};

// ===== SECTION: User Interface Components =====
// ===== FILE PATH: src/modules/ui.js ==========

/**
 * UI component function to add a floating preview panel ("bubble") to the page.
 *
 * This panel displays stored book metadata in a JSON formatted view on the left,
 * and shows the book cover image with a clickable link and download option on the right.
 *
 * Key behaviors:
 * - Loads book data from persistent storage.
 * - Skips rendering if no valid data or panel already exists.
 * - Creates a fixed-position panel anchored to bottom-left of viewport.
 * - Includes a close button to remove the panel.
 * - Uses monospace font and styled containers for readability.
 * - Excludes the cover URL from JSON preview to reduce clutter.
 * - The cover image opens in a new tab when clicked.
 * - A download link below the cover triggers a save of the image.
 * - All style and DOM creation is done programmatically.
 * - Uses logging to track loading, error, and lifecycle events.
 */
function addPreviewPanel() {
  const logger = createLogger("addPreviewPanel");

  let data;
  try {
    data = loadBookData();
  } catch (err) {
    logger.error("Failed to load book data:", err);
    return;
  }

  if (!data || Object.keys(data).length === 0 || !data.title) {
    logger.warn("No valid book data to display:", data);
    return;
  }

  if (document.getElementById("bookPreviewPanel")) {
    logger.debug("Preview panel already exists.");
    return;
  }

  const panel = document.createElement("div");
  panel.id = "bookPreviewPanel";
  Object.assign(panel.style, {
    position: "fixed",
    bottom: "10px",
    left: "10px",
    width: "600px",
    maxHeight: "400px",
    background: "#fdfdfd",
    border: "1px solid #888",
    borderRadius: "8px",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.2)",
    padding: "12px",
    fontFamily: "monospace",
    fontSize: "11px",
    overflowY: "auto",
    zIndex: 99999,
    display: "flex",
    gap: "12px",
  });

  const closeBtn = document.createElement("button");
  closeBtn.innerText = "✖";
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "8px",
    right: "8px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "14px",
  });
  closeBtn.title = "Close";
  closeBtn.onclick = () => {
    logger.debug("Preview panel closed.");
    panel.remove();
  };

  // Left pane: JSON preview excluding cover image
  const jsonPreview = document.createElement("pre");
  Object.assign(jsonPreview.style, {
    flex: "1",
    background: "#eee",
    padding: "6px",
    borderRadius: "6px",
    maxHeight: "380px",
    overflowY: "auto",
    whiteSpace: "pre-wrap",
  });
  const dataClone = { ...data };
  delete dataClone.cover; // exclude cover URL from JSON preview
  jsonPreview.textContent = JSON.stringify(dataClone, null, 2);

  // Right pane: cover image + download link
  const rightPane = document.createElement("div");
  Object.assign(rightPane.style, {
    width: "150px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
  });

  if (data.cover) {
    const link = document.createElement("a");
    link.href = data.cover;
    link.target = "_blank";
    link.title = "Open cover image in new tab";
    link.style.display = "block";
    link.style.width = "100%";

    const img = document.createElement("img");
    img.src = data.cover;
    img.alt = data.title || "Cover Image";
    img.style.width = "100%";
    img.style.borderRadius = "6px";
    img.style.cursor = "pointer";

    link.appendChild(img);
    rightPane.appendChild(link);

    const downloadLink = document.createElement("a");
    downloadLink.href = data.cover;
    downloadLink.download = ""; // filename from URL
    downloadLink.textContent = "⬇️ Download Cover";
    Object.assign(downloadLink.style, {
      color: "#0055aa",
      textDecoration: "underline",
      cursor: "pointer",
      fontSize: "12px",
      userSelect: "none",
    });

    rightPane.appendChild(downloadLink);
  }

  panel.appendChild(closeBtn);
  panel.appendChild(jsonPreview);
  panel.appendChild(rightPane);
  document.body.appendChild(panel);
  logger.debug("Preview panel injected.");
}

/**
 * Creates the floating bubble UI container with header and content.
 * Returns references for bubble, content container, and header.
 * Styling is centralized here for easier future theme toggling.
 */
function createFloatingBubbleUI(logger, onToggle, initialMinimized = false) {
  const bubble = document.createElement("div");
  bubble.id = "floatingBubble";
  Object.assign(bubble.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "600px", // expanded width
    background: "#fff",
    border: "1px solid #888",
    borderRadius: "10px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
    zIndex: 99999,
    fontFamily: "sans-serif",
    fontSize: "14px",
    color: "#222",
    userSelect: "none",
    overflow: "hidden",
    transition: "height 0.3s ease, width 0.3s ease, visibility 0.3s ease",
    height: "auto", // start expanded
  });

  const header = document.createElement("div");
  header.style.cssText = `
    background: #0055aa;
    color: #fff;
    padding: 8px;
    cursor: pointer;
    font-weight: bold;
    user-select: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  header.textContent = "Book Metadata";

  const toggleIcon = document.createElement("span");
  toggleIcon.textContent = "▼";
  toggleIcon.style.transition = "transform 0.3s ease";
  header.appendChild(toggleIcon);

  const content = document.createElement("div");
  content.id = "floatingBubbleContent";
  Object.assign(content.style, {
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    maxHeight: "350px",
    overflowY: "auto",
    visibility: "visible", // start visible
    height: "auto",
    transition: "height 0.3s ease, visibility 0.3s ease",
  });

  const btnContainer = document.createElement("div");
  btnContainer.style.display = "flex";
  btnContainer.style.flexWrap = "nowrap";
  btnContainer.style.gap = "8px";
  btnContainer.style.marginBottom = "8px";

  // Set initial minimized state
  if (initialMinimized) {
    content.style.height = "0";
    content.style.visibility = "hidden";
    bubble.style.width = "200px";
    toggleIcon.style.transform = "rotate(180deg)";
  }

  header.onclick = () => {
    if (content.style.visibility === "hidden") {
      // Expand
      content.style.visibility = "visible";
      content.style.height = "auto";
      bubble.style.width = "600px"; // expanded width
      toggleIcon.style.transform = "rotate(0deg)"; // arrow up
      logger.debug("Bubble expanded");
    } else {
      // Collapse
      content.style.height = "0";
      content.style.visibility = "hidden";
      bubble.style.width = "200px"; // collapsed width
      toggleIcon.style.transform = "rotate(180deg)"; // arrow down
      logger.debug("Bubble collapsed");
    }
    const isMinimized = content.style.visibility === "hidden";
    if (onToggle) onToggle(isMinimized);
  };

  bubble.appendChild(header);
  bubble.appendChild(content);
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
  Object.assign(msg.style, {
    marginBottom: "8px",
    color: "#007700",
    fontWeight: "bold",
    minHeight: "18px",
    transition: "opacity 0.3s ease",
    opacity: "0",
    userSelect: "none",
  });
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
  container.className = "floatingBubbleFlexContainer";
  Object.assign(container.style, {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    maxHeight: "250px",
    overflow: "hidden",
  });

  const prettify = (str) =>
    str
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase())
      .trim();

  // Left pane with formatted text
  const left = document.createElement("div");
  Object.assign(left.style, {
    flex: "1",
    background: "#eee",
    padding: "6px",
    borderRadius: "6px",
    maxHeight: "250px",
    overflowY: "auto",
    fontFamily: "monospace",
    fontSize: "12px",
    userSelect: "none",
  });

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
    if (
      key === "description" &&
      typeof value === "string" &&
      value.length > 100
    ) {
      value = value.substring(0, 100) + "... (full description redacted due to length)";
    }

    const div = document.createElement("div");
    div.style.marginBottom = "4px";

    const label = document.createElement("span");
    label.textContent = `${prettify(key)}: `;
    label.style.fontWeight = "bold";

    const val = document.createElement("span");
    val.textContent = value;
    val.style.cursor = "pointer";
    val.style.color = "#0055aa";
    val.style.textDecoration = "underline";
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
    Object.assign(right.style, {
      width: "150px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "6px",
      overflow: "hidden",
    });

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
    downloadLink.textContent = "⬇️ Download Cover";
    Object.assign(downloadLink.style, {
      color: "#0055aa",
      textDecoration: "underline",
      cursor: "pointer",
      fontSize: "12px",
      userSelect: "none",
    });

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
function createButton(label, onClick, styles = {}) {
  const btn = document.createElement("button");
  btn.textContent = label;
  Object.assign(btn.style, {
    padding: "6px 10px",
    fontSize: "14px",
    borderRadius: "4px",
    border: "1px solid #0077cc",
    backgroundColor: "#0077cc",
    color: "#fff",
    cursor: "pointer",
    userSelect: "none",
    transition: "background-color 0.3s ease",
    ...styles,
  });

  btn.onmouseenter = () => {
    btn.style.backgroundColor = "#005fa3";
  };
  btn.onmouseleave = () => {
    btn.style.backgroundColor = "#0077cc";
  };
  btn.onclick = onClick;

  if (styles.disabled) {
    btn.disabled = true;
    btn.style.opacity = "0.6";
    btn.style.cursor = "not-allowed";
  }

  return btn;
}

// Export UI component functions for external usage
const UIComponents = {
  addPreviewPanel,
  createFloatingBubbleUI,
  createFloatingMessage,
  showMessage,
  createBookDisplay,
  createButton,
};

// ===== SECTION: Amazon Extraction =====
// ===== FILE PATH: src/extractors/amazon.js ==========

/**
 * Extracts book metadata from an Amazon book product page.
 *
 * This async function scrapes key information such as:
 * - Title, subtitle, reading format, edition info, release date
 * - Description text with line breaks preserved
 * - Cover image URL
 * - Authors, contributors, and publisher info from byline
 * - Detailed product info depending on format (audiobook or regular book)
 *
 * Utilizes DOM queries to target Amazon's page structure, with fallback and normalization logic.
 * Logs detailed debug info at every step for traceability.
 * Returns a populated bookSchema object with extracted data.
 */
async function extractAmazon() {
  const logger = createLogger("extractAmazon");
  logger.debug("Invoked extractAmazon()");

  let data = bookSchema;

  // == Product Header ==

  // Title Field
  data.title = getAmazonTitle();
  logger.debug(`Title extracted: ${data.titile}`);

  // Subtitle Field - reading format, edition info, release data
  const { readingFormat, editionFormat, editionInfo, releaseDate } =
    parseAmazonSubtitle();
  data.readingFormat = readingFormat;
  logger.debug(`Reading format retreived: ${data.readingFormat}`);
  data.editionFormat = editionFormat;
  logger.debug(`Edition format retreived: ${data.editionFormat}`);
  data.editionInfo = editionInfo;
  logger.debug(`Edition info retreived: ${data.editionInfo}`);
  data.releaseDate = releaseDate;
  logger.debug(`Release date retreived: ${data.releaseDate}`);

  // Parse byline - authors, contributors, publisher from byline
  data = parseAmazonByline(data);

  // Parse Series
  const { seriesName, seriesNumber } = getAmazonSeries();
  data.seriesName = seriesName;
  data.seriesNumber = seriesNumber;
  logger.debug("Retreived series name:", data.seriesName);
  logger.debug("Retreived series number:", data.seriesNumber);

  // Extract Cover
  data.cover = await getHighResImageUrl(getAmazonCover());
  logger.debug(`Cover retrieved: ${data.cover}`);

  // Extract description
  data.description = getAmazonDescription();
  logger.debug(`Description Retreived: ${data.description}`);

  // Parse Product Details
  data = parseAmazonProductDetails(data);

  logger.debug("Final extracted Amazon data:", data);
  return data;
}

// #region Amazon Helper Functions

/**
 * Extracts the product title from an Amazon product page.
 *
 * This function queries the DOM for the element containing the product's title
 * (typically found in the element with id `#productTitle`), trims any excess whitespace,
 * and returns the clean string. It logs any issues encountered, such as a missing title
 * element or errors during extraction.
 *
 * @returns {string} The cleaned product title or an empty string if unavailable.
 */
function getAmazonTitle() {
  const logger = createLogger("getAmazonTitle");

  try {
    const titleEl = document.querySelector("#productTitle");

    if (titleEl) {
      return titleEl.textContent.trim();
    } else {
      logger.warn("Title element not found");
      return "";
    }
  } catch (error) {
    logger.error("Error extracting title:", error);
    return "";
  }
}

/**
 * Extracts the cover image URL from an Amazon product page.
 *
 * Looks for the main product image (typically found in the element with ID 'landingImage').
 * Returns the image URL if found, or an empty string otherwise.
 *
 * @returns {string} The cover image URL or an empty string.
 */
function getAmazonCover() {
  const logger = createLogger("getAmazonCover");

  try {
    const coverImgEl = document.getElementById("landingImage");

    if (coverImgEl?.src) {
      logger.debug(`Cover image URL extracted: ${coverImgEl.src}`);
      return coverImgEl.src;
    }

    logger.warn("Cover image not found");
    return "";
  } catch (error) {
    logger.error("Error extracting cover image:", error);
    return "";
  }
}

/**
 * Extracts the book description from an Amazon product page.
 *
 * Targets the expanded content section within the #bookDescription_feature_div.
 * Converts the HTML content to plain text with preserved line breaks.
 *
 * @returns {string} The cleaned description text or an empty string if unavailable.
 */
function getAmazonDescription() {
  const logger = createLogger("getAmazonDescription");

  try {
    const descriptionContainer = document.querySelector(
      "#bookDescription_feature_div .a-expander-content"
    );

    if (descriptionContainer) {
      const description = htmlToTextWithLineBreaks(descriptionContainer);
      logger.debug("Description extracted with line breaks.");
      return description;
    } else {
      logger.debug("Description element not found.");
      return "";
    }
  } catch (error) {
    logger.error("Error extracting description:", error);
    return "";
  }
}

/**
 * Extracts series information from an Amazon book product page.
 *
 * Looks for the series widget, typically in the format:
 *   "Book 20 of 29: Backyard Starship"
 * Parses out the book number within the series and the series name.
 *
 * @returns {{ seriesName: string|null, seriesNumber: string|null }}
 *          Returns nulls if the widget is missing or the format is unrecognized.
 */
function getAmazonSeries() {
  const logger = createLogger("getAmazonSeries");

  try {
    // Locate the link inside the series widget container
    const seriesWidget = document.querySelector(
      "#seriesBulletWidget_feature_div a"
    );

    // If the element doesn't exist, exit early
    if (!seriesWidget) {
      logger.warn("Series widget not found");
      return { seriesName: null, seriesNumber: null };
    }

    // Extract and trim the widget text (e.g., "Book 20 of 29: Backyard Starship")
    const text = seriesWidget.textContent.trim();
    logger.debug(`Extracted text: ${text}`);

    // Match book number and series name
    const match = text.match(/Book\s+(\d+)\s+of\s+\d+:\s+(.+)/i);

    // If pattern doesn't match expected structure, exit with nulls
    if (!match) {
      logger.warn(`Series format did not match expected pattern: "${text}"`);
      return { seriesName: null, seriesNumber: null };
    }

    // Parse captured values
    const seriesNumber = match[1];
    const seriesName = match[2];

    logger.debug(`Series number: ${seriesNumber}`);
    logger.debug(`Series name: ${seriesName}`);

    return { seriesName, seriesNumber };
  } catch (error) {
    logger.error("Error extracting Amazon series info:", error);
    return { seriesName: null, seriesNumber: null };
  }
}

/**
 * Extracts subtitle details from Amazon book product pages.
 * Determines reading format (e.g., E-Book, Physical Book, Audiobook),
 * edition format, edition-specific info, and release date by parsing the
 * `#productSubtitle`, `#productBinding`, and `#productVersion` elements.
 *
 * Handles various subtitle formats with or without delimiter characters.
 *
 * Uses structured logging to capture debug and error context for troubleshooting.
 *
 * @returns {Object} An object containing:
 *   - readingFormat: string
 *   - editionFormat: string
 *   - editionInfo: string
 *   - releaseDate: string
 */
function parseAmazonSubtitle() {
  const logger = createLogger("parseAmazonSubtitle");

  let readingFormat = "";
  let editionFormat = "";
  let editionInfo = "";
  let releaseDate = "";

  try {
    const subtitleEl = document.querySelector("#productSubtitle");
    const bindingEl = document.querySelector("#productBinding");
    const versionEl = document.querySelector("#productVersion");

    if (subtitleEl) {
      // Extract and trim subtitle content
      const subtitleText = subtitleEl.textContent.trim();
      logger.debug(`Subtitle extracted: ${subtitleText}`);

      // Try multiple delimiters: –, -, |, or other common separators
      const delimiters = ["–", "-", "|", "•"];
      let parts = [subtitleText]; // Default to single part if no delimiter found
      let usedDelimiter = null;

      // Find the first delimiter that actually splits the text
      for (const delimiter of delimiters) {
        const testParts = subtitleText
          .split(delimiter)
          .map((part) => part.trim())
          .filter((part) => part.length > 0);
        if (testParts.length > 1) {
          parts = testParts;
          usedDelimiter = delimiter;
          logger.debug(
            `Split subtitle using delimiter "${delimiter}": ${JSON.stringify(
              parts
            )}`
          );
          break;
        }
      }

      // Define format detection rules
      const formatRules = [
        {
          keywords: ["kindle", "ebook"],
          readingFormat: "E-Book",
          editionFormat: "",
          preserveEditionInfo: true,
        },
        {
          keywords: ["hardcover", "paperback", "mass market", "large print"],
          readingFormat: "Physical Book",
          editionFormat: "",
          preserveEditionInfo: true,
        },
        {
          keywords: ["audiobook"],
          readingFormat: "Audiobook",
          editionFormat: "Audible",
          preserveEditionInfo: false,
        },
      ];

      const parseFormat = (text) => {
        const lowerText = text.toLowerCase();

        for (const rule of formatRules) {
          if (rule.keywords.some((keyword) => lowerText.includes(keyword))) {
            return {
              readingFormat: rule.readingFormat,
              editionFormat: rule.editionFormat,
              editionInfo: rule.preserveEditionInfo ? text : "",
            };
          }
        }

        // Fallback - no format detected
        return {
          readingFormat: "",
          editionFormat: "",
          editionInfo: text,
        };
      };

      if (parts.length >= 2) {
        // Multiple parts found - first part is likely format, last part is likely date
        const formatPart = parts[0];
        const datePart = parts[parts.length - 1];

        const formatResult = parseFormat(formatPart);
        readingFormat = formatResult.readingFormat || formatPart; // fallback to raw text
        editionFormat = formatResult.editionFormat;
        editionInfo = formatResult.editionInfo;

        // Check if the last part looks like a date
        if (
          datePart &&
          (datePart.match(/\d{4}/) ||
            datePart.match(/\d{1,2}\/\d{1,2}\/\d{4}/) ||
            datePart.match(/\w+\s+\d{1,2},?\s+\d{4}/))
        ) {
          releaseDate = datePart;
        }

        logger.debug(`Reading format: ${readingFormat}`);
        logger.debug(`Edition info: ${editionInfo}`);
        logger.debug(`Release date: ${releaseDate}`);
      } else if (parts.length === 1) {
        // Single part - try to extract format info from the whole string
        const singleText = parts[0];
        logger.debug(
          `Single subtitle part, attempting to parse: ${singleText}`
        );

        const formatResult = parseFormat(singleText);
        readingFormat = formatResult.readingFormat;
        editionFormat = formatResult.editionFormat;
        editionInfo = formatResult.editionInfo;

        if (!readingFormat) {
          logger.debug("No specific format detected, storing as edition info");
        }

        logger.debug(`Reading format: ${readingFormat}`);
        logger.debug(`Edition info: ${editionInfo}`);
      }
    } else if (bindingEl) {
      // Fallback for audiobook layout
      const bindingText = bindingEl.textContent.trim();
      let versionText = versionEl ? versionEl.textContent.trim() : "";

      // Clean up version text by removing leading dashes and whitespace
      versionText = versionText.replace(/^[–\-]+\s*/, "");

      readingFormat = "Audiobook";
      editionFormat = "Audible";
      editionInfo = versionText || "";

      logger.debug(`Reading format set to: ${readingFormat}`);
      logger.debug(`Edition format set to: ${editionFormat}`);
      logger.debug(`Edition info set to: ${editionInfo}`);

      releaseDate = "";
    } else {
      logger.debug("Subtitle and audiobook elements not found");
    }
  } catch (error) {
    logger.error(`Error extracting details from product subtitle: ${error}`);
  }

  return { readingFormat, editionFormat, editionInfo, releaseDate };
}

/**
 * parseAmazonByline
 * -----------------
 * Extracts and normalizes author, contributor, and publisher data from the
 * Amazon byline section (#bylineInfo). It parses roles from text like "(Author)",
 * "(Editor)", etc., then updates the passed `data` object accordingly.
 *
 * @param {Object} data - Book metadata object to update.
 * @returns {Object} Updated data object with `authors`, `contributors`, and `publisher`.
 */
function parseAmazonByline(data) {
  const logger = createLogger("parseAmazonByline");
  logger.debug("Extracting authors, contributors, and publisher");

  try {
    const bylineSpans = document.querySelectorAll("#bylineInfo .author");
    const authors = [];
    const contributors = [];
    let publisherName = "";

    bylineSpans.forEach((span) => {
      const name = span.querySelector("a")?.textContent?.trim();
      const roleRaw = span
        .querySelector(".contribution .a-color-secondary")
        ?.textContent?.trim();
      if (!name || !roleRaw) return;

      // Clean and normalize roles by removing parentheses and splitting by comma/space
      const roles = roleRaw
        .replace(/[()]/g, "")
        .split(/[,\s]+/)
        .filter(Boolean)
        .map((r) => r.toLowerCase());

      // If explicitly marked as an author, add to authors list
      if (roles.includes("author")) {
        authors.push(name);
      }

      // If marked as publisher, store name; otherwise treat as contributor
      if (roles.includes("publisher")) {
        publisherName = name;
      } else {
        const contributorRoles = roles.filter((r) => r !== "author");

        if (contributorRoles.length > 0) {
          // Capitalize and join multiple roles for display
          const roleDisplay = contributorRoles
            .map((r) => r.charAt(0).toUpperCase() + r.slice(1))
            .join(" ");
          contributors.push({ name, role: roleDisplay });
        }
      }
    });

    // Deduplicate and append parsed authors
    data.authors = dedupeObject([...(data.authors || []), ...authors]);
    logger.debug(`Authors parsed: ${JSON.stringify(data.authors)}`);

    // Deduplicate and append parsed contributors
    data.contributors = dedupeObject([
      ...(data.contributors || []),
      ...contributors,
    ]);
    logger.debug(`Contributors parsed: ${JSON.stringify(data.contributors)}`);

    // Set publisher if not already populated
    if (data.publisher) {
      logger.debug(
        `Publisher is already set to '${data.publisher}', skipping '${publisherName}'`
      );
    } else {
      data.publisher = publisherName;
      logger.debug(`Publisher parsed: ${data.publisher}`);
    }
  } catch (error) {
    logger.error(`Error parsing byline: ${error}`);
  }

  return data;
}

/**
 * parseContributorField
 * ---------------------
 * Parses a contributor field from metadata headers into a structured format.
 *
 * This function takes a header label (e.g. "Author", "Translator", "Editor")
 * and a string of names separated by commas, and returns an object with either:
 *   - an `authors` array (if the header is "Author"), or
 *   - a `contributors` array with objects of the form { name, role }
 *
 * Usage:
 * const result = parseContributorField("Editor", "Jane Smith, John Doe");
 * // result => { contributors: [{ name: "Jane Smith", role: "Editor" }, { name: "John Doe", role: "Editor" }] }
 *
 * @param {string} header - The label for the contributor type (e.g., "Author", "Translator")
 * @param {string} valueText - The comma-separated list of contributor names
 * @returns {Object} An object with either `authors` or `contributors`
 */
function parseContributorField(header, valueText) {
  // Split the contributor string by commas and clean up each name
  const names = valueText
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  // If this is the "Author" field, return them directly as authors
  if (header.toLowerCase() === "author") {
    return {
      authors: names,
    };
  }

  // Convert header to Title Case for consistent role formatting
  const role = header
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Build contributor objects with the normalized role
  const contributors = names.map((name) => ({
    name,
    role,
  }));

  return {
    contributors,
  };
}

/**
 * parseAmazonProductDetails
 * -------------------------
 * Extracts structured metadata from Amazon product detail sections depending on the reading format.
 * Supports both Audible (audiobook) and physical/ebook detail structures.
 *
 * This function populates fields such as authors, contributors, series name, duration,
 * publisher, release date, ASIN, language, page count, and ISBNs into the provided `data` object.
 *
 * Usage:
 * const parsedData = parseAmazonProductDetails(existingData);
 * // Modifies and returns `existingData` with enriched fields from the DOM.
 *
 * @param {Object} data - An object to enrich with metadata scraped from the Amazon product page
 * @returns {Object} The updated data object with new metadata fields (if found)
 */
function parseAmazonProductDetails(data) {
  const logger = createLogger("parseAmazonProductDetails");

  try {
    const readingFormatLower = (data.readingFormat || "").toLowerCase();
    const isAudiobook =
      readingFormatLower.includes("audiobook") ||
      readingFormatLower === "audiobook";

    // Get the appropriate container based on format
    let detailsContainer;
    let detailItems = [];

    if (isAudiobook) {
      // --- Audible product page (Audiobook format) ---
      detailsContainer = document.querySelector(
        "#audibleProductDetails table.a-keyvalue"
      );
      if (detailsContainer) {
        const rows = detailsContainer.querySelectorAll("tr");
        detailItems = Array.from(rows).map((row) => ({
          label: (
            row.querySelector("th")?.textContent?.trim() || ""
          ).toLowerCase(),
          value: row.querySelector("td")?.textContent?.trim() || "",
          valueElement: row.querySelector("td"),
        }));
      }
    } else {
      // --- Physical/Ebook product page ---
      detailsContainer = document.querySelector(
        "#detailBullets_feature_div ul.detail-bullet-list"
      );
      if (detailsContainer) {
        const items = detailsContainer.querySelectorAll("li");
        detailItems = Array.from(items)
          .map((li) => {
            const labelEl = li.querySelector("span.a-text-bold");
            const valueEl = labelEl ? labelEl.nextElementSibling : null;
            if (!labelEl || !valueEl) return null;

            let label = labelEl.textContent || "";
            label = label
              .replace(/[‏:\u200E\u200F]/g, "")
              .trim()
              .toLowerCase();

            return {
              label: label,
              value: valueEl.textContent.trim(),
              valueElement: valueEl,
            };
          })
          .filter((item) => item !== null);
      }
    }

    if (!detailsContainer) {
      logger.debug(
        `${isAudiobook ? "Audible" : "Detail bullets"} container not found`
      );
      return data;
    }

    // Process all detail items with unified switch statement
    detailItems.forEach(({ label, value, valueElement }) => {
      if (!label || !value) return;

      logger.debug(`Processing label: "${label}", value: "${value}"`);

      switch (label) {
        case "best sellers rank":
          // Skip unneeded rank data
          logger.debug("Skipping Best Sellers Rank");
          break;

        case "author":
          const authors = parseContributorField(label, value);
          logger.debug(`Parsed authors: ${JSON.stringify(authors)}`);
          if (authors.authors) {
            data.authors = dedupeObject([
              ...(data.authors || []),
              ...authors.authors,
            ]);
            logger.debug(`Authors added to data: ${data.authors}`);
          } else {
            logger.debug("No authors detected");
          }
          break;

        case "narrator":
          const narrator = parseContributorField(label, value);
          logger.debug(`Parsed narrator: ${JSON.stringify(narrator)}`);
          if (narrator?.contributors?.length) {
            data.contributors = dedupeObject([
              ...(data.contributors || []),
              ...narrator.contributors,
            ]);
            logger.debug(
              `Narrators added to contributors: ${data.contributors}`
            );
          } else {
            logger.debug("No narrators detected");
          }
          break;

        case "part of series":
          if (!data.seriesName) {
            data.seriesName = value;
            logger.debug(`Series name: ${data.seriesName}`);
          } else {
            logger.debug(`Skipped seriesName: already set: ${data.seriesName}`);
          }
          break;

        case "listening length":
          if (!data.audiobookDuration?.length) {
            // Extract "X hours Y minutes" style duration
            const durationParts =
              value
                .toLowerCase()
                .match(/\d+\s*hours?|\d+\s*minutes?|\d+\s*seconds?/g) || [];
            const durationObj = { hours: 0, minutes: 0, seconds: 0 };

            durationParts.forEach((part) => {
              if (part.includes("hour"))
                durationObj.hours = parseInt(part, 10) || 0;
              else if (part.includes("minute"))
                durationObj.minutes = parseInt(part, 10) || 0;
              else if (part.includes("second"))
                durationObj.seconds = parseInt(part, 10) || 0;
            });

            data.audiobookDuration = [durationObj];
            logger.debug(`Audiobook duration: ${JSON.stringify(durationObj)}`);
          }
          break;

        case "publisher":
        case "publication date":
          // Handle both "publisher" and "publication date" labels
          if (label === "publisher") {
            if (!data.publisher) {
              data.publisher = value;
              logger.debug(`Publisher: ${data.publisher}`);
            } else {
              logger.debug(`Skipped publisher: already set: ${data.publisher}`);
            }
          } else if (label === "publication date") {
            if (!data.releaseDate) {
              data.releaseDate = value;
              logger.debug(`Release date: ${data.releaseDate}`);
            } else {
              logger.debug(
                `Skipped releaseDate: already set: ${data.releaseDate}`
              );
            }
          }
          break;

        case "program type":
          if (!data.readingFormat) {
            data.readingFormat = value;
            logger.debug(
              `Reading format (Program Type): ${data.readingFormat}`
            );
          } else {
            logger.debug(
              `Skipped readingFormat: already set: ${data.readingFormat}`
            );
          }
          break;

        case "version":
          if (!data.editionInfo) {
            data.editionInfo = value.replace(/^–+\s*/, "");
            logger.debug(`Edition info: ${data.editionInfo}`);
          } else {
            logger.debug(
              `Skipped editionInfo: already set: ${data.editionInfo}`
            );
          }
          break;

        case "language":
          if (!data.releaseLanguage) {
            data.releaseLanguage = value;
            logger.debug(`Release language: ${data.releaseLanguage}`);
          } else {
            logger.debug(
              `Skipped releaseLanguage: already set: ${data.releaseLanguage}`
            );
          }
          break;

        case "print length":
          if (!data.pageCount) {
            const pageCountMatch = value.match(/\d+/);
            if (pageCountMatch) {
              data.pageCount = parseInt(pageCountMatch[0], 10);
              logger.debug(`Page count: ${data.pageCount}`);
            }
          } else {
            logger.debug(`Skipped pageCount: already set: ${data.pageCount}`);
          }
          break;

        case "isbn-10":
          if (!data.isbn10) {
            data.isbn10 = value.replace(/-/g, "");
            logger.debug(`ISBN-10: ${data.isbn10}`);
          } else {
            logger.debug(`Skipped ISBN-10: already set: ${data.isbn10}`);
          }
          break;

        case "isbn-13":
          if (!data.isbn13) {
            data.isbn13 = value.replace(/-/g, "");
            logger.debug(`ISBN-13: ${data.isbn13}`);
          } else {
            logger.debug(`Skipped ISBN-13: already set: ${data.isbn13}`);
          }
          break;

        case "asin":
          if (!data.asin) {
            data.asin = value;
            logger.debug(`ASIN: ${data.asin}`);
          } else {
            logger.debug(`Skipped asin: already set: ${data.asin}`);
            break;
          }
          if (!data.sourceId) {
            data.sourceId = value;
            logger.debug(`Source ID: ${data.sourceId}`);
          } else {
            logger.debug(`Skipped source id: already set: ${data.sourceId}`);
          }
          break;

        default:
          // Handle "Audible release date" keys and other dynamic patterns
          if (/^audible\.\w+\s+release date$/i.test(label)) {
            if (!data.releaseDate) {
              data.releaseDate = value;
              logger.debug(`Release date (Audible): ${data.releaseDate}`);
            } else {
              logger.debug(
                `Skipped releaseDate: already set: ${data.releaseDate}`
              );
            }
          } else {
            logger.warn(`Unrecognized label: "${label}": "${value}"`);
          }
          break;
      }
    });
  } catch (error) {
    logger.error(`Error extracting from product details: ${error}`);
  }

  return data;
}

// #endregion

// ===== SECTION: Goodreads Extraction =====
// ===== FILE PATH: src/extractors/goodreads.js ==========

/**
 * Extracts book metadata from a Goodreads book page.
 * 
 * This async function scrapes various details including:
 * - Cover image URL
 * - Title and authors (including expanding "...more" contributors if present)
 * - Description text
 * - Series name and number
 * - Detailed lists of authors and contributors with roles
 * - Edition details like format, publication date, publisher, ISBNs, ASIN, and language
 * 
 * Uses DOM queries targeting Goodreads' page structure, with logic to normalize and parse key fields.
 * Waits briefly to load expanded contributor data if necessary.
 * Logs detailed debug messages to trace extraction steps.
 * Returns a populated bookSchema object with extracted metadata.
 */
async function extractGoodreads() {
  const logger = createLogger("extractGoodreads");
  logger.debug("Invoked extractGoodreads()");

  const data = bookSchema;

  data.sourceId = getGoodreadsBookId(window.location.href);
  logger.debug(`Source ID: ${data.sourceId}`);

  // Expand "...more" contributors if present, to access full contributor list
  const moreContributorsBtn = document.querySelector(
    ".ContributorLinksList .Button__labelItem"
  );
  if (
    moreContributorsBtn &&
    moreContributorsBtn.textContent.trim() === "...more"
  ) {
    moreContributorsBtn.click();
    logger.debug('Clicked "...more" contributor button');

    // Wait 500ms for contributors to load after clicking
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Extract cover image URL
  const coverEl =
    document.querySelector(".BookCover__image img.ResponsiveImage")?.src ||
    null;
  data.cover = await getHighResImageUrl(coverEl);
  logger.debug("Extracted cover:", coverEl);

  // Extract book title
  const titleEl = document.querySelector('h1[data-testid="bookTitle"]');
  data.title = titleEl?.textContent.trim() || "";
  logger.debug("Extracted title:", data.title);

  // Initial authors extraction from itemprop=name spans
  data.authors = Array.from(
    document.querySelectorAll('span[itemprop="name"]')
  ).map((el) => el.textContent.trim());
  logger.debug("Initial authors extracted:", data.authors);

  // Extract description text
  const descEl = document.querySelector(
    'div[data-testid="description"] span.Formatted'
  );
  data.description = descEl?.textContent.trim() || "";
  logger.debug("Extracted description:", data.description);

  // Extract series name and number if present
  const seriesAnchor = document.querySelector('h3[aria-label*="series"] a');
  if (seriesAnchor) {
    const fullText = seriesAnchor.textContent.trim();
    const match = fullText.match(/^(.*)\s*#([\d.]+)$/);
    if (match) {
      data.seriesName = match[1];
      data.seriesNumber = match[2];
    } else {
      data.seriesName = fullText;
      data.seriesNumber = "";
    }
    logger.debug("Extracted series:", {
      name: data.seriesName,
      number: data.seriesNumber,
    });
  }

  // Parse detailed authors and contributors with roles to avoid duplicates
  const authorsSet = new Set();
  const contributorsSet = new Set();
  const authors = [];
  const contributors = [];

  const container = document.querySelector(".ContributorLinksList");
  if (container) {
    // Select all spans with tabindex="-1" inside the container
    const allSpans = container.querySelectorAll("span[tabindex='-1']");

    allSpans.forEach((span) => {
      // For each span, find all contributor links
      span.querySelectorAll("a.ContributorLink").forEach((link) => {
        const nameEl = link.querySelector(".ContributorLink__name");
        const roleEl = link.querySelector(".ContributorLink__role");

        const name = nameEl?.textContent.trim() || "";
        const role =
          roleEl?.textContent.trim().replace(/[()\u00A0]/g, "") || "";

        // Distinguish contributors by presence of role, avoid duplicates
        if (role) {
          const key = `${name}|${role}`;
          if (!contributorsSet.has(key)) {
            contributors.push({ name, role });
            contributorsSet.add(key);
          }
        } else {
          if (!authorsSet.has(name)) {
            authors.push(name);
            authorsSet.add(name);
          }
        }
      });
    });
  }

  data.authors = authors;
  data.contributors = contributors;
  logger.debug("Final authors:", authors);
  logger.debug("Contributors:", contributors);

  // Extract edition details such as format, published date, ISBN, etc.
  const editionDetails = document.querySelector(".EditionDetails");
  if (editionDetails) {
    const items = editionDetails.querySelectorAll(".DescListItem");
    items.forEach((item) => {
      const label =
        item.querySelector("dt")?.textContent.trim().toLowerCase() || "";
      const value = item.querySelector("dd")?.textContent.trim() || "";

      switch (label) {
        case "format": {
          const parts = value.split(",");
          const rawFormat =
            parts.length === 1 ? parts[0].trim() : parts[1].trim();
          const pageMatch = parts[0].match(/\d+/);
          data.pageCount = pageMatch ? parseInt(pageMatch[0], 10) : null;

          // Normalize reading format and edition info
          const formatMap = {
            "audible audio": {
              readingFormat: "Audiobook",
              editionInfo: "Audible",
              editionFormat: "",
            },
            "audio cd": {
              readingFormat: "Audiobook",
              editionInfo: "CD",
              editionFormat: "",
            },
            "kindle edition": {
              readingFormat: "E-Book",
              editionInfo: "Kindle",
              editionFormat: "",
            },
            ebook: {
              readingFormat: "E-Book",
              editionInfo: "",
              editionFormat: "",
            },
            paperback: {
              readingFormat: "Physical Book",
              editionInfo: "Paperback",
              editionFormat: "",
            },
            hardcover: {
              readingFormat: "Physical Book",
              editionInfo: "Hardcover",
              editionFormat: "",
            },
          };

          const normalized = formatMap[rawFormat.toLowerCase()];
          if (normalized) {
            data.readingFormat = normalized.readingFormat;
            data.editionInfo = normalized.editionInfo;
            data.editionFormat = normalized.editionFormat || undefined;
          } else {
            data.editionFormat = rawFormat;
          }

          logger.debug("Extracted format:", {
            editionFormat: data.editionFormat,
            readingFormat: data.readingFormat,
            editionInfo: data.editionInfo,
            pageCount: data.pageCount,
          });
          break;
        }

        case "published": {
          data.releaseDate = value.split(" by ")[0].trim();
          const byIndex = value.toLowerCase().indexOf(" by ");
          if (byIndex !== -1) {
            data.publisher = value.substring(byIndex + 4).trim();
          }
          logger.debug("Extracted published date & publisher:", {
            releaseDate: data.releaseDate,
            publisher: data.publisher,
          });
          break;
        }

        case "isbn": {
          const cleaned = value.trim();
          const isbnMatch = cleaned.match(
            /(\d{13})(?:\s*\(ISBN10:\s*(\d{10})\))?/i
          );
          if (isbnMatch) {
            data.isbn13 = isbnMatch[1];
            if (isbnMatch[2]) {
              data.isbn10 = isbnMatch[2];
            }
          } else {
            const digits = cleaned.replace(/\D/g, "");
            if (digits.length === 13) data.isbn13 = digits;
            else if (digits.length === 10) data.isbn10 = digits;
          }
          logger.debug("Extracted ISBNs:", {
            isbn13: data.isbn13,
            isbn10: data.isbn10,
          });
          break;
        }

        case "asin": {
          data.asin = value.trim();
          logger.debug("Extracted ASIN:", data.asin);
          break;
        }

        case "language": {
          data.releaseLanguage = value;
          logger.debug("Extracted language:", data.releaseLanguage);
          break;
        }
      }
    });
  }

  logger.debug("Returning data object:", data);
  return data;
}

/**
 * Extracts the Goodreads book ID from a Goodreads book URL.
 *
 * @param {string} url - The Goodreads book URL.
 * @returns {string|null} - The extracted numeric book ID, or null if not found.
 */
function getGoodreadsBookId(url) {
  const regex = /goodreads\.com\/book\/show\/(\d+)(?:[-/]|$)/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// ===== SECTION: Google Books Extraction =====
// ===== FILE PATH: src/extractors/google.js ==========

/**
 * Main extractor function for Google Books pages.
 *
 * First attempts to fetch data from the Google Books API, then falls back to DOM
 * extraction for any fields that weren't populated from the API response.
 * Aggregates book metadata by querying the API and DOM, calling helper functions.
 * Populates a standard schema with title, ISBNs, publisher, language, page count,
 * description, reading format, and authors. Logs each extracted value.
 *
 * @returns {object} Book metadata following the `bookSchema` format.
 */
async function extractGoogle() {
  const logger = createLogger("extractGoogle");
  logger.debug("Invoked extractGoogle()");

  let data = bookSchema;

  data.sourceId = getGoogleBooksIdFromUrl(window.location.href);
  logger.debug(`Source ID: ${data.sourceId}`);

  // First, attempt to get data from the Google Books API
  let apiData = null;
  if (data.sourceId) {
    try {
      apiData = await fetchGoogleBooksApiData(data.sourceId);
      logger.debug("Successfully fetched API data");
    } catch (error) {
      logger.warn(
        "Failed to fetch API data, will rely on DOM extraction:",
        error
      );
    }
  }

  // Map API data to our schema if available
  if (apiData?.volumeInfo) {
    mapApiDataToSchema(data, apiData.volumeInfo, apiData.saleInfo);
    logger.debug("Mapped API data to schema");
  }

  // Cover extraction: Try fife method first (higher quality), fall back to API
  // Note: We use the custom fife method instead of API imageLinks because
  // it provides higher resolution images than the standard API response
  if (!data.cover) {
    data.cover = getGoogleBooksCoverUrl(data.sourceId);
    logger.debug(`Cover URL from fife method: ${data.cover}`);
  }
  if (!data.cover && apiData?.volumeInfo?.imageLinks?.large) {
    data.cover = apiData.volumeInfo.imageLinks.large;
    logger.debug(`Cover URL from API fallback: ${data.cover}`);
  }

  // DOM fallbacks for fields not populated by API
  const root = document.querySelector(".r0Sd2e");

  if (!data.title) {
    data.title = getGoogleBookTitle();
    logger.debug(`Title from DOM: ${data.title}`);
  }

  if (!data.isbn10 || !data.isbn13) {
    const { isbn10, isbn13 } = extractIsbns(root);
    if (!data.isbn10) data.isbn10 = isbn10;
    if (!data.isbn13) data.isbn13 = isbn13;
    logger.debug(
      `ISBNs from DOM - ISBN-10: ${data.isbn10}, ISBN-13: ${data.isbn13}`
    );
  }

  // Release date: DOM first (more detailed), API fallback
  data.releaseDate = getGoogleBookReleaseDate();
  if (!data.releaseDate && apiData?.volumeInfo?.publishedDate) {
    data.releaseDate = apiData.volumeInfo.publishedDate;
    logger.debug(`Release date from API fallback: ${data.releaseDate}`);
  }
  logger.debug(`Final release date: ${data.releaseDate}`);

  if (!data.publisher) {
    data.publisher = getGoogleBookPublisher();
    logger.debug(`Publisher from DOM: ${data.publisher}`);
  }

  if (!data.releaseLanguage) {
    data.releaseLanguage = getGoogleBookLanguage();
    logger.debug(`Language from DOM: ${data.releaseLanguage}`);
  }

  if (!data.pageCount) {
    data.pageCount = getGoogleBookPageCount();
    logger.debug(`Page count from DOM: ${data.pageCount}`);
  }

  if (!data.description) {
    data.description = getGoogleBookDescription();
    logger.debug(`Description from DOM: ${data.description}`);
  }

  if (!data.readingFormat || !data.editionInfo) {
    const { readingFormat, editionInfo } = getGoogleBookReadingFormat();
    if (!data.readingFormat) data.readingFormat = readingFormat;
    if (!data.editionInfo) data.editionInfo = editionInfo;
    logger.debug(`Reading format from DOM: ${data.readingFormat}`);
    logger.debug(`Edition info from DOM: ${data.editionInfo}`);
  }

  if (!data.authors?.length) {
    const authors = getGoogleBookAuthors();
    data.authors = dedupeObject([...(data.authors || []), ...authors]);
    logger.debug(`Authors from DOM: ${data.authors}`);
  }

  // TODO Audiobooks?
  // TODO Other contributors?
  // TODO Series name extraction (not available in API or easily parseable from DOM)

  logger.debug(`Returning book data:`, data);
  return data;
}

/**
 * Fetches book data from the Google Books API.
 *
 * @param {string} volumeId - The Google Books volume ID.
 * @returns {Promise<object>} - The API response data.
 * @throws {Error} - If the API request fails.
 */
async function fetchGoogleBooksApiData(volumeId) {
  const logger = createLogger("fetchGoogleBooksApiData");
  const apiUrl = `https://www.googleapis.com/books/v1/volumes/${volumeId}`;

  logger.debug(`Fetching API data from: ${apiUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    logger.debug("API data fetched successfully");
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    logger.error("Failed to fetch API data:", error);
    throw error;
  }
}

/**
 * Maps Google Books API data to our book schema.
 *
 * @param {object} data - The book schema object to populate.
 * @param {object} volumeInfo - The volumeInfo section from API response.
 * @param {object} saleInfo - The saleInfo section from API response.
 */
function mapApiDataToSchema(data, volumeInfo, saleInfo) {
  const logger = createLogger("mapApiDataToSchema");

  // Basic info
  if (volumeInfo.title) {
    data.title = volumeInfo.title;
    logger.debug(`API title: ${data.title}`);
  }

  if (volumeInfo.subtitle) {
    data.subtitle = volumeInfo.subtitle;
    logger.debug(`API subtitle: ${data.subtitle}`);
  }

  if (volumeInfo.description) {
    // Remove HTML tags from description
    data.description = volumeInfo.description.replace(/<[^>]*>/g, "");
    logger.debug(`API description: ${data.description.slice(0, 100)}...`);
  }

  // Authors
  if (volumeInfo.authors?.length) {
    data.authors = [...volumeInfo.authors];
    logger.debug(`API authors: ${data.authors.join(", ")}`);
  }

  // Publisher and dates
  if (volumeInfo.publisher) {
    data.publisher = volumeInfo.publisher;
    logger.debug(`API publisher: ${data.publisher}`);
  }

  // Note: Release date will be handled by DOM first approach in main function

  // Language
  if (volumeInfo.language) {
    data.releaseLanguage = getLanguageName(volumeInfo.language);
    logger.debug(`API language: ${data.releaseLanguage}`);
  }

  // Page count
  if (volumeInfo.pageCount) {
    data.pageCount = volumeInfo.pageCount;
    logger.debug(`API page count: ${data.pageCount}`);
  }

  // ISBNs
  if (volumeInfo.industryIdentifiers?.length) {
    for (const identifier of volumeInfo.industryIdentifiers) {
      if (identifier.type === "ISBN_10") {
        data.isbn10 = identifier.identifier;
        logger.debug(`API ISBN-10: ${data.isbn10}`);
      } else if (identifier.type === "ISBN_13") {
        data.isbn13 = identifier.identifier;
        logger.debug(`API ISBN-13: ${data.isbn13}`);
      }
    }
  }

  // Reading format
  const readingFormat = determineReadingFormat(volumeInfo, saleInfo);
  if (readingFormat) {
    data.readingFormat = readingFormat;
    logger.debug(`API reading format: ${data.readingFormat}`);
  }

  // Book category mapping from API categories
  const bookCategory = mapApiCategoriesToBookCategory(volumeInfo.categories);
  if (bookCategory) {
    data.bookCategory = bookCategory;
    logger.debug(`API book category: ${data.bookCategory}`);
  }

  // Literary type mapping from API categories
  const literaryType = mapApiCategoriesToLiteraryType(volumeInfo.categories);
  if (literaryType) {
    data.literaryType = literaryType;
    logger.debug(`API literary type: ${data.literaryType}`);
  }

  // Series information
  if (volumeInfo.seriesInfo?.bookDisplayNumber) {
    data.seriesNumber = volumeInfo.seriesInfo.bookDisplayNumber.toString();
    logger.debug(`API series number: ${data.seriesNumber}`);
  }
}

/**
 * Determines reading format from API data.
 *
 * @param {object} volumeInfo - The volumeInfo from API.
 * @param {object} saleInfo - The saleInfo from API.
 * @returns {string} - The reading format.
 */
function determineReadingFormat(volumeInfo, saleInfo) {
  const logger = createLogger("determineReadingFormat");

  // Check if it's an ebook
  if (saleInfo?.isEbook === true || volumeInfo?.readingModes?.text === true) {
    logger.debug("Determined as E-Book from API data");
    return "E-Book";
  }

  // For now, assume physical book if not ebook
  // Audiobook detection would need additional logic or DOM fallback
  if (volumeInfo?.printType === "BOOK") {
    logger.debug("Determined as Physical Book from API data");
    return "Physical Book";
  }

  logger.warn("Could not determine reading format from API data");
  return "";
}

/**
 * Maps Google Books API categories to literary type.
 *
 * @param {string[]} categories - Array of category strings from API.
 * @returns {string} - Mapped literary type: 'Fiction', 'Non-Fiction', or 'Unknown or Not Applicable'.
 */
function mapApiCategoriesToLiteraryType(categories) {
  const logger = createLogger("mapApiCategoriesToLiteraryType");
  if (!categories?.length) {
    logger.warn("No categories available for literary type mapping");
    return "";
  }
  const categoryString = categories.join(" ").toLowerCase();

  // Check for fiction indicators
  if (
    categoryString.includes("fiction") &&
    !categoryString.includes("non-fiction")
  ) {
    logger.debug(`Category indicates Fiction: ${categoryString}`);
    return "Fiction";
  }

  // Check for non-fiction indicators
  if (
    categoryString.includes("non-fiction") ||
    categoryString.includes("nonfiction") ||
    categoryString.includes("biography") ||
    categoryString.includes("autobiography") ||
    categoryString.includes("memoir") ||
    categoryString.includes("history") ||
    categoryString.includes("science") ||
    categoryString.includes("reference") ||
    categoryString.includes("self-help") ||
    categoryString.includes("business") ||
    categoryString.includes("politics") ||
    categoryString.includes("philosophy") ||
    categoryString.includes("psychology") ||
    categoryString.includes("religion") ||
    categoryString.includes("health") ||
    categoryString.includes("cooking") ||
    categoryString.includes("travel") ||
    categoryString.includes("true crime") ||
    categoryString.includes("education") ||
    categoryString.includes("parenting") ||
    categoryString.includes("crafts") ||
    categoryString.includes("medical") ||
    categoryString.includes("law") ||
    categoryString.includes("economics") ||
    categoryString.includes("sociology") ||
    categoryString.includes("anthropology")
  ) {
    logger.debug(`Category indicates Non-Fiction: ${categoryString}`);
    return "Non-Fiction";
  }

  // Default if unclear
  logger.warn("Unable to determine literary type");
  return "";
}

/**
 * Maps Google Books API categories to our book category schema.
 *
 * @param {string[]} categories - Array of category strings from API.
 * @returns {string} - Mapped book category.
 */
function mapApiCategoriesToBookCategory(categories) {
  //TODO Convert to global function for reuse across extractors
  const logger = createLogger("mapApiCategoriesToBookCategory");
  if (!categories?.length) {
    logger.warn("No categories provided from API");
    return "";
  }

  const categoryString = categories.join(" ").toLowerCase();
  logger.debug(`Processing categories: ${categoryString}`);

  // Check for specific types in order of specificity
  let bookCategory = null;
  if (categoryString.includes("light novel")) {
    logger.debug("Determined as Light Novel from API categories");
    bookCategory = "Light Novel";
  } else if (
    categoryString.includes("graphic novel") ||
    categoryString.includes("comics") ||
    categoryString.includes("manga")
  ) {
    bookCategory = "Graphic Novel";
  } else if (categoryString.includes("poetry")) {
    bookCategory = "Poetry";
  } else if (categoryString.includes("novella")) {
    bookCategory = "Novella";
  } else if (categoryString.includes("short story")) {
    bookCategory = "Short Story";
  } else if (categoryString.includes("collection")) {
    bookCategory = "Collection";
  }

  // Default to Book for most cases
  if (!bookCategory) {
    logger.debug("Defaulted to Book from API categories");
    return "Book";
  } else {
    // Return the determined category
    logger.debug(`Mapped book category: ${bookCategory}`);
    return bookCategory;
  }
}

// #region Google Book Helpers (DOM-based fallbacks)

/**
 * Extracts the book title from the Google Books page.
 *
 * @returns {string} Title text or empty string if not found.
 */
function getGoogleBookTitle() {
  const logger = createLogger("getGoogleBookTitle");
  try {
    const titleEl = document.querySelector(
      'div.zNLTKd[aria-level="1"][role="heading"]'
    );
    if (titleEl) {
      const title = titleEl.textContent.trim();
      logger.debug(`Title extracted: ${title}`);
      return title;
    } else {
      logger.warn("Google Book title element not found");
      return "";
    }
  } catch (error) {
    logger.error("Error extracting Google Book title:", error);
    return "";
  }
}

/**
 * Finds a container element by a label prefix.
 *
 * @param {HTMLElement} rootElement Root DOM node to start search from.
 * @param {string} label Label prefix to match.
 * @returns {HTMLElement|null} Matched container or null.
 */
function findContainerByLabel(rootElement, label) {
  const containers = rootElement.querySelectorAll("div.wDYxhc");
  for (const container of containers) {
    const labelSpan = container.querySelector("span.w8qArf");
    if (labelSpan && labelSpan.textContent.trim().startsWith(label)) {
      return container;
    }
  }
  return null;
}

/**
 * Retrieves text from a container's value span.
 *
 * @param {HTMLElement|null} container
 * @returns {string|null}
 */
function getTextFromContainer(container) {
  if (!container) return null;
  const valueSpan = container.querySelector("span.LrzXr.kno-fv.wHYlTd.z8gr9e");
  return valueSpan ? valueSpan.textContent.trim() : null;
}

/**
 * Retrieves text from the first anchor in the container.
 *
 * @param {HTMLElement|null} container
 * @returns {string|null}
 */
function getLinkTextFromContainer(container) {
  if (!container) return null;
  const link = container.querySelector("a.fl");
  return link ? link.textContent.trim() : null;
}

/**
 * Extracts ISBN-10 and ISBN-13 from the details panel.
 *
 * @returns {{ isbn10: string|null, isbn13: string|null }}
 */
function extractIsbns() {
  const logger = createLogger("extractIsbns");
  logger.debug("Invoked extractIsbns()");

  const containers = document.querySelectorAll("div.zloOqf.PZPZlf");

  for (const container of containers) {
    const label = container.querySelector(".w8qArf");
    if (label?.textContent?.toLowerCase().startsWith("isbn")) {
      const valueEl = container.querySelector(".LrzXr");
      const isbnText = valueEl?.textContent?.trim();
      logger.debug(`Raw ISBN text: ${isbnText}`);
      if (isbnText) {
        const parts = isbnText.split(",").map((s) => s.trim());
        let isbn10 = null;
        let isbn13 = null;

        for (const part of parts) {
          if (part.length === 13) isbn13 = part;
          else if (part.length === 10) isbn10 = part;
        }

        return { isbn10, isbn13 };
      }
    }
  }

  logger.warn("ISBN container not found");
  return { isbn10: null, isbn13: null };
}

/**
 * Extracts the published date from the page.
 *
 * @returns {string}
 */
function getGoogleBookReleaseDate() {
  const logger = createLogger("getGoogleBookReleaseDate");
  try {
    const allDetailBlocks = Array.from(
      document.querySelectorAll("div.zloOqf.PZPZlf")
    );

    for (const block of allDetailBlocks) {
      const labelSpan = block.querySelector("span.w8qArf");
      if (labelSpan && labelSpan.textContent.trim().startsWith("Published")) {
        const valueSpan = block.querySelector(
          "span.LrzXr.kno-fv.wHYlTd.z8gr9e"
        );
        if (valueSpan) {
          const publishedDate = valueSpan.textContent.trim();
          logger.debug(`Published date extracted: ${publishedDate}`);
          return publishedDate;
        }
      }
    }

    logger.warn("Published date element not found");
    return "";
  } catch (error) {
    logger.error("Error extracting published date:", error);
    return "";
  }
}

/**
 * Extracts the publisher name from the details section.
 *
 * @returns {string}
 */
function getGoogleBookPublisher() {
  const logger = createLogger("getGoogleBookPublisher");
  try {
    const allDetailBlocks = Array.from(
      document.querySelectorAll("div.zloOqf.PZPZlf")
    );

    for (const block of allDetailBlocks) {
      const labelSpan = block.querySelector("span.w8qArf");
      if (labelSpan && labelSpan.textContent.trim().startsWith("Publisher")) {
        const valueSpan = block.querySelector(
          "span.LrzXr.kno-fv.wHYlTd.z8gr9e"
        );
        if (valueSpan) {
          const anchor = valueSpan.querySelector("a.fl");
          const publisher = (
            anchor?.textContent || valueSpan.textContent
          ).trim();
          logger.debug(`Publisher extracted: ${publisher}`);
          return publisher;
        }
      }
    }

    logger.warn("Publisher element not found");
    return "";
  } catch (error) {
    logger.error("Error extracting publisher:", error);
    return "";
  }
}

/**
 * Extracts the release language from the info panel.
 *
 * @returns {string|null}
 */
function getGoogleBookLanguage() {
  const logger = createLogger("getGoogleBookLanguage");
  try {
    const labelNodes = Array.from(
      document.querySelectorAll("div.zloOqf.PZPZlf")
    );

    for (const node of labelNodes) {
      const label = node.querySelector("span.w8qArf")?.textContent?.trim();
      if (label?.startsWith("Language")) {
        const value = node
          .querySelector("span.LrzXr, span.LrzXr a")
          ?.textContent?.trim();
        logger.debug(`Language extracted: ${value}`);
        return value || null;
      }
    }

    logger.warn("Language not found");
    return null;
  } catch (err) {
    logger.error("Failed to extract language", err);
    return null;
  }
}

/**
 * Extracts and parses page count as a number.
 *
 * @returns {number|null}
 */
function getGoogleBookPageCount() {
  const logger = createLogger("getGoogleBookPageCount");
  try {
    const labelNodes = Array.from(
      document.querySelectorAll("div.zloOqf.PZPZlf")
    );

    for (const node of labelNodes) {
      const label = node.querySelector("span.w8qArf")?.textContent?.trim();
      if (label?.startsWith("Page count")) {
        const valueText = node.querySelector("span.LrzXr")?.textContent?.trim();
        const pageCount = valueText
          ? parseInt(valueText.replace(/[^\d]/g, ""), 10)
          : null;

        if (!isNaN(pageCount)) {
          logger.debug(`Page count extracted: ${pageCount}`);
          return pageCount;
        }

        logger.warn(`Invalid page count text: "${valueText}"`);
        return null;
      }
    }

    logger.warn("Page count label not found");
    return null;
  } catch (err) {
    logger.error("Failed to extract page count", err);
    return null;
  }
}

/**
 * Extracts the full description text with formatting preserved.
 *
 * @returns {string}
 */
function getGoogleBookDescription() {
  const logger = createLogger("getGoogleBookDescription");
  try {
    const descriptionContainer = document.querySelector("div.Y0Qrof");
    if (!descriptionContainer) {
      logger.warn("Description container not found.");
      return "";
    }

    const descriptionText = htmlToTextWithLineBreaks(descriptionContainer);
    logger.debug(`Description extracted: ${descriptionText.slice(0, 80)}...`);
    return descriptionText;
  } catch (err) {
    logger.error("Error while extracting book description", err);
    return "";
  }
}

/**
 * Normalizes raw format string to one of: Audiobook, E-Book, or Physical Book.
 *
 * @param {string} rawFormat
 * @returns {string}
 */
function normalizeReadingFormat(rawFormat) {
  const format = rawFormat.toLowerCase();

  if (format.includes("audio")) return "Audiobook";
  if (
    format.includes("ebook") ||
    format.includes("e-book") ||
    format.includes("digital")
  )
    return "E-Book";
  if (
    format.includes("physical") ||
    format.includes("hardcover") ||
    format.includes("paperback") ||
    format.includes("book")
  )
    return "Physical Book";

  return "Physical Book"; // Fallback
}

/**
 * Extracts and normalizes reading format from the details section.
 *
 * @returns {string}
 */
function getGoogleBookReadingFormat() {
  const logger = createLogger("getGoogleBookReadingFormat");
  try {
    const formatContainer = [
      ...document.querySelectorAll("div.zloOqf.PZPZlf"),
    ].find((div) =>
      div.querySelector("span.w8qArf")?.textContent.includes("Format")
    );

    if (!formatContainer) {
      logger.warn("Reading format container not found.");
      return { readingFormat: "", editionInfo: "" };
    }

    const formatValueEl = formatContainer.querySelector(
      "span.LrzXr.kno-fv.wHYlTd.z8gr9e"
    );
    if (!formatValueEl) {
      logger.warn("Reading format value element not found.");
      return { readingFormat: "", editionInfo: "" };
    }

    const rawFormat = formatValueEl.textContent.trim();
    logger.debug(`Raw reading format extracted: ${rawFormat}`);

    const normalizedFormat = normalizeReadingFormat(rawFormat);
    logger.debug(`Normalized reading format: ${normalizedFormat}`);
    return { readingFormat: normalizedFormat, editionInfo: rawFormat };
  } catch (error) {
    logger.error("Error extracting reading format:", error);
    return { readingFormat: "", editionInfo: "" };
  }
}

/**
 * Extracts author names from the Google Books info panel.
 *
 * @returns {string[]} Array of author names.
 */
function getGoogleBookAuthors() {
  const logger = createLogger("getGoogleBookAuthors");
  try {
    const authorContainer = Array.from(
      document.querySelectorAll("div.zloOqf.PZPZlf")
    ).find((div) => div.textContent.trim().toLowerCase().startsWith("author"));

    if (!authorContainer) {
      logger.warn("Author container not found.");
      return [];
    }

    const anchorElements = authorContainer.querySelectorAll("a.fl");
    const authors = Array.from(anchorElements).map((a) => a.textContent.trim());

    if (authors.length === 0) {
      logger.warn("No author links found within container.");
    } else {
      logger.debug(`Authors extracted: ${authors.join(", ")}`);
    }

    return authors;
  } catch (err) {
    logger.error("Error while extracting book authors", err);
    return [];
  }
}

/**
 * Extracts the Google Books volume ID from a given URL.
 * Supports localized domains and multiple URL formats.
 *
 * @param {string} url - The current page URL.
 * @returns {string|null} - The extracted volume ID or null if not found.
 */
function getGoogleBooksIdFromUrl(url) {
  const patterns = [
    /books\/edition\/(?:[^/]+\/)?([A-Za-z0-9_-]{10,})/, // e.g., books/edition/_/PYsFzwEACAAJ
    /books\?id=([A-Za-z0-9_-]{10,})/, // e.g., books?id=PYsFzwEACAAJ
    /\/volume\/([A-Za-z0-9_-]{10,})/, // e.g., volume/PYsFzwEACAAJ
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Constructs a Google Books cover image URL with maximum resolution.
 * Uses the 'fife' parameter to force large image dimensions.
 * Dynamically uses the current domain to avoid CORS issues.
 *
 * @param {string} volumeId - The Google Books volume ID.
 * @returns {string} - The full URL to the highest-resolution cover image.
 */
function getGoogleBooksCoverUrl(volumeId) {
  if (!volumeId) return null;

  // Get the current domain from the page we're on
  const currentDomain = window.location.hostname; // e.g., "www.google.ca" or "books.google.com"
  const protocol = window.location.protocol; // "https:"

  const baseUrl = `${protocol}//${currentDomain}/books/publisher/content/images/frontcover/${volumeId}`;
  const params = new URLSearchParams({
    fife: "w1600-h2400", // High-resolution; adjust if needed
  });

  return `${baseUrl}?${params.toString()}`;
}

// #endregion

// ===== SECTION: StoryGraph Extraction =====
// ===== FILE PATH: src/extractors/storygraph.js ==========

/**
 * Extracts book metadata from a StoryGraph book page.
 *
 * This async function scrapes various details including:
 * - Cover image URL
 * - Title and series information
 * - Authors and contributors with roles
 * - Edition details like format, publication date, publisher, ISBN, and language
 * - Description text (expands "read more" if present)
 * - Page count and audiobook duration
 *
 * Uses DOM queries targeting StoryGraph's page structure, with logic to normalize and parse key fields.
 * Waits briefly to load expanded description if necessary.
 */
async function extractStoryGraph() {
  const logger = createLogger("extractStoryGraph");
  logger.debug("Invoked extractStoryGraph()");

  const data = { ...bookSchema };

  data.sourceId = getStoryGraphBookId(window.location.href);
  logger.debug(`Source ID: ${data.sourceId}`);

  // Extract cover image URL
  const coverEl = document.querySelector(".book-cover img");
  if (coverEl?.src) {
    data.cover = await getHighResImageUrl(coverEl.src);
    logger.debug("Extracted cover:", data.cover);
  }

  // Extract book title
  const titleEl = document.querySelector(".book-title-author-and-series h3");
  const rawTitle = titleEl?.childNodes[0]?.textContent.trim();
  data.title = rawTitle || "";
  logger.debug("Extracted title:", data.title);

  // Extract series information
  extractSeriesInfo(data);

  // Extract contributors (authors, narrators, etc.)
  extractStoryGraphContributors(data);

  // Extract edition information
  extractStoryGraphEditionInfo(data);

  // Extract description (may need to expand)
  await extractStoryGraphDescription(data);

  logger.debug("Returning data object:", data);
  return data;
}

/**
 * Extracts series name and number from StoryGraph page
 */
function extractSeriesInfo(data) {
  const logger = createLogger("extractSeriesInfo");
  const h3 = document.querySelector(".book-title-author-and-series h3");
  if (!h3) return;

  // Look for series info in the first paragraph (has font-semibold class)
  const seriesParagraph = h3.querySelector("p.font-semibold");

  if (seriesParagraph) {
    const seriesLinks = seriesParagraph.querySelectorAll("a");

    if (seriesLinks.length >= 2) {
      const seriesTitle = seriesLinks[0]?.textContent.trim();
      const seriesPlaceMatch = seriesLinks[1]?.textContent.match(/#(\d+)/);

      if (seriesTitle) {
        data.seriesName = seriesTitle;
        logger.debug("Extracted series name:", data.seriesName);
      }

      if (seriesPlaceMatch) {
        data.seriesNumber = seriesPlaceMatch[1];
        logger.debug("Extracted series number:", data.seriesNumber);
      }
    }
  } else {
    logger.debug(
      "No series information found (no paragraph with font-semibold class)"
    );
  }
}

/**
 * Extracts contributors (authors, narrators, etc.) from StoryGraph page
 */
function extractStoryGraphContributors(data) {
  const logger = createLogger("extractStoryGraphContributors");
  const contributors = [];
  const authors = [];

  const h3 = document.querySelector(".book-title-author-and-series h3");
  if (!h3) {
    logger.warn("No h3 element found for contributors");
    return;
  }

  // Check if there's a series (indicated by p.font-semibold)
  const hasSeriesParagraph = h3.querySelector("p.font-semibold");

  // If there's a series, authors are in the second paragraph
  // If no series, authors are in the first paragraph
  const contributorParagraph = hasSeriesParagraph
    ? h3.querySelector("p:nth-of-type(2)")
    : h3.querySelector("p:nth-of-type(1)");

  if (contributorParagraph) {
    contributorParagraph.querySelectorAll("a").forEach((a) => {
      const name = a.textContent.trim();
      if (!name) return;

      // Check the next sibling for role (e.g. (Narrator))
      const nextText = a.nextSibling?.textContent?.trim();
      const roleMatch = nextText?.match(/\(([^)]+)\)/);
      const role = roleMatch ? roleMatch[1] : "Author";

      if (role === "Author") {
        if (!authors.includes(name)) {
          authors.push(name);
        }
      } else {
        // Check if contributor with this name already exists
        let existingContributor = contributors.find((c) => c.name === name);
        if (existingContributor) {
          // Add role if not already present
          if (!existingContributor.role.includes(role)) {
            existingContributor.role = `${existingContributor.role}, ${role}`;
          }
        } else {
          contributors.push({ name, role });
        }
      }
    });
  } else {
    logger.warn("No contributor paragraph found");
  }

  data.authors = dedupeObject(authors);
  data.contributors = dedupeObject(contributors);

  logger.debug("Extracted authors:", data.authors);
  logger.debug("Extracted contributors:", data.contributors);
}

/**
 * Extracts edition information from StoryGraph page
 */
function extractStoryGraphEditionInfo(data) {
  const logger = createLogger("extractStoryGraphEditionInfo");
  // Show the edition info section (it might be hidden)
  const editionInfo = document.querySelector(".edition-info");
  if (editionInfo) {
    editionInfo.style.display = "block";
  }

  const editionEl = document.querySelector(".edition-info");
  if (!editionEl) {
    logger.warn("No edition info element found");
    return;
  }

  editionEl.querySelectorAll("p").forEach((p) => {
    const label = p
      .querySelector("span.font-semibold")
      ?.innerText.trim()
      .replace(":", "");
    const value = p.childNodes[1]?.textContent.trim();

    if (!label || !value) return;

    switch (label) {
      case "ISBN/UID":
        // Try to determine if it's ISBN-10 or ISBN-13 based on length
        const cleanedIsbn = value.replace(/[-\s]/g, "");
        if (cleanedIsbn.length === 13) {
          data.isbn13 = cleanedIsbn;
        } else if (cleanedIsbn.length === 10) {
          data.isbn10 = cleanedIsbn;
        }
        logger.debug("Extracted ISBN:", {
          isbn10: data.isbn10,
          isbn13: data.isbn13,
        });
        break;

      case "Format":
        if (value.toLowerCase() === "audio") {
          data.readingFormat = "Audiobook";
        } else if (value.toLowerCase() === "digital") {
          data.readingFormat = "E-Book";
        } else {
          data.readingFormat = "Physical Book";
          data.editionFormat = value;
        }
        logger.debug("Extracted format:", {
          readingFormat: data.readingFormat,
          editionFormat: data.editionFormat,
        });
        break;

      case "Language":
        data.releaseLanguage = value;
        logger.debug("Extracted language:", data.releaseLanguage);
        break;

      case "Publisher":
        data.publisher = value;
        logger.debug("Extracted publisher:", data.publisher);
        break;

      case "Edition Pub Date":
        data.releaseDate = value;
        logger.debug("Extracted publication date:", data.releaseDate);
        break;
    }
  });

  // Extract page count and audiobook duration
  const durationEl = document.querySelector("p.text-sm.font-light");
  if (durationEl) {
    const value = durationEl.innerText.trim();

    // Extract audiobook duration
    const timeMatch = value.match(
      /(\d+)\s*hours?\s*(?:,|and)?\s*(\d+)?\s*minutes?/i
    );
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10) || 0;
      const minutes = parseInt(timeMatch[2], 10) || 0;

      data.audiobookDuration = [
        {
          hours: hours,
          minutes: minutes,
          seconds: 0,
        },
      ];
      logger.debug("Extracted audiobook duration:", data.audiobookDuration);
    }

    // Extract page count
    const pagesMatch = value.match(/(\d+)\s*pages?/i);
    if (pagesMatch) {
      data.pageCount = parseInt(pagesMatch[1], 10);
      logger.debug("Extracted page count:", data.pageCount);
    }
  }
}

/**
 * Extracts description from StoryGraph page, expanding "read more" if present
 */
async function extractStoryGraphDescription(data) {
  const logger = createLogger("extractStoryGraphDescription");
  // Click "read more" button if present to expand full description
  const readMoreBtn = document.querySelector(".read-more-btn");
  if (readMoreBtn) {
    readMoreBtn.click();
    logger.debug('Clicked "read more" button');

    // Wait for description to expand
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const descriptionEl = document.querySelector(".blurb-pane .trix-content");
  if (descriptionEl) {
    data.description = htmlToTextWithLineBreaks(descriptionEl);
    logger.debug("Extracted description length:", data.description.length);
  } else {
    logger.warn("No description element found");
  }
}

/**
 * Extracts the StoryGraph book ID from a StoryGraph book URL.
 *
 * @param {string} url - The StoryGraph book URL.
 * @returns {string|null} - The extracted book ID, or null if not found.
 */
function getStoryGraphBookId(url) {
  const logger = createLogger("getStoryGraphBookId");
  const regex = /thestorygraph\.com\/books\/([^/?]+)/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// ===== SECTION: Hardcover Functionality =====
// ===== FILE PATH: src/modules/hardcover.js ==========

/**
 * Checks if the current page is a hardcover.app import/edit page
 * by matching the URL against known patterns for manual/new edit pages.
 * Logs the URL and the result of the test.
 * @returns {boolean} True if on hardcover.app book import or edit page.
 */
function isHardcoverImportPage() {
  const logger = createLogger("isHardcoverImportPage");
  const url = location.href;
  const regex =
    /^https:\/\/hardcover\.app\/books\/([^/]+\/)?(editions\/[^/]+\/)?edit$|^https:\/\/hardcover\.app\/books\/new_manual$/;

  logger.debug("Testing url: ", url);
  const result = regex.test(url);
  logger.debug("Results: ", result);
  return result;
}

/**
 * Helper: Set value of input element by id and trigger input/change events.
 * @param {string} id - The id of the input element.
 * @param {string} value - The value to set.
 */
function setInputId(id, value) {
  const logger = createLogger("setInputId");
  logger.debug(`Setting input Id for field '${id}' to: `, value);

  const el = document.getElementById(id);
  if (!el || typeof value !== "string") {
    logger.debug(`Skipped '${id}' - element not found or value not a string.`);
    return;
  }

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;

  nativeInputValueSetter?.call(el, value);

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));

  logger.debug(`Set input '${id}' to:`, value);
}

/**
 * Helper: Set value of input or textarea element by label text and trigger input/change events.
 * @param {string} labelText - The exact text content of the label.
 * @param {string|number} value - The value to set.
 */
function setInputLabel(labelText, value) {
  const logger = createLogger("setInputLabel");
  logger.debug(`Setting input for '${labelText}' to:`, value);

  if (typeof value !== "string" && typeof value !== "number") {
    logger.debug(`Skipped '${labelText}' - value not a string or number`);
    return;
  }
  const stringValue = String(value);

  const labels = Array.from(document.querySelectorAll("label"));
  const label = labels.find((l) => l.textContent.trim() === labelText);

  if (!label) {
    logger.debug(`Label '${labelText}' not found`);
    return;
  }

  const container = label.closest("div.border-t");

  if (!container) {
    logger.debug(`Container for label '${labelText}' not found`);
    return;
  }

  const input = container.querySelector("input, textarea");

  if (!input) {
    logger.debug(`Input or textarea for label '${labelText}' not found`);
    return;
  }

  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    "value"
  )?.set;

  setter?.call(input, stringValue);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  logger.debug(`Set input for '${labelText}' to:`, stringValue);
}

/**
 * Imports extracted book metadata into hardcover.app's book form fields.
 * Uses element IDs and label text to locate input fields.
 * Updates input values and dispatches 'input' and 'change' events
 * to trigger framework reactivity and UI updates.
 * Logs detailed debug information for each field set operation.
 *
 * @param {object} data - Book metadata object to import.
 */
function importBookDataToHardcover(data) {
  const logger = createLogger("importBookDataToHardcover");
  logger.debug("Called with data:", data);

  if (!data) {
    logger.warn("No data provided, exiting early.");
    return;
  }

  // Populate hardcover.app form fields from extracted data
  setInputId("field-title", data.title || "");
  setInputId("field-subtitle", data.subtitle || "");
  setInputId("field-isbn-10", data.isbn10 || "");
  setInputId("field-isbn-13", data.isbn13 || "");
  setInputId("field-asin", data.asin || "");
  setInputId("field-edition-format", data.editionFormat || "");

  setInputLabel("Description", data.description || "");
  setInputLabel("Page Count", data.pageCount);

  logger.info("Finished populating form fields.");
}

// ===== SECTION: Main =====
// ===== FILE PATH: src/core/main.js ==========

(function () {
  "use strict";

  // Create logger for this module
  const logger = createLogger("floatingBubble");

  // Store last URL to detect navigation changes
  let lastUrl = location.href;

  // Store last displayed extraction time to detect data changes from other tabs
  let lastDisplayedTime = 0;

  /**
   * Checks if the current page is a Hardcover import or edit page.
   * Uses a regex to match relevant URL patterns.
   * @returns {boolean} True if current page is a hardcover.app import/edit page.
   */
  function isHardcoverImportPage() {
    const url = location.href;
    const regex =
      /^https:\/\/hardcover\.app\/books\/([^/]+\/)?(editions\/[^/]+\/)?edit$|^https:\/\/hardcover\.app\/books\/new_manual$/;
    return regex.test(url);
  }

  /**
   * Initializes the floating bubble UI.
   * Sets up buttons and event handlers based on the current site context
   * and stored book data.
   */
  async function initFloatingBubble() {
    logger.info("Initializing floating bubble");

    // Get normalized host for site module detection
    const rawHost = location.hostname.toLowerCase();
    logger.debug(`rawHost: '${rawHost}'`);

    // Remove leading www.
    const host = rawHost.replace(/^www\./, "");

    // Normalize Amazon host to a generic key
    let normalizedHost = host.includes("amazon.") ? "amazon" : host;

    // Normalize google books URLs to 'google'
    if (
      host.endsWith("google.com") ||
      host.endsWith("google.ca") ||
      host.endsWith("google.co.uk") ||
      host.includes("google.")
    ) {
      if (location.pathname.startsWith("/books")) {
        normalizedHost = "google";
      } else if (host.startsWith("books.google.")) {
        normalizedHost = "google";
      }
    }

    // Normalize StoryGraph host to 'storygraph'
    if (host.includes("thestorygraph.com")) {
      normalizedHost = "storygraph";
    }

    logger.debug(`normalizedHost: '${normalizedHost}'`);

    const module = siteModules[normalizedHost];
    const isImportPage = isHardcoverImportPage();

    let savedData = loadBookData();
    let hasSavedData = savedData && Object.keys(savedData).length > 0;
    logger.debug("Saved book data found:", hasSavedData);

    // Update last displayed time for change detection
    lastDisplayedTime = GM_getValue("lastExtractionTime", 0);

    // Load minimized state
    const initialMinimized = GM_getValue("minimized", false);
    const onToggle = (minimized) => GM_setValue("minimized", minimized);

    // Create floating bubble UI using UI module
    const { bubble, content } = UIComponents.createFloatingBubbleUI(logger, onToggle, initialMinimized);

    // Message container for displaying temporary feedback to user
    let messageEl = content.querySelector("#floatingBubbleMessage");
    if (!messageEl) {
      messageEl = UIComponents.createFloatingMessage();
      content.insertBefore(messageEl, content.firstChild);
    }

    /**
     * Displays a temporary message in the bubble for a set duration.
     * @param {string} msg - Message text to display.
     * @param {number} duration - Duration in ms before fading out.
     */
    function showTemporaryMessage(msg, duration = 3000) {
      UIComponents.showMessage(messageEl, msg, duration);
    }

    // Container for buttons in the bubble UI
    const btnContainer = document.createElement("div");
    btnContainer.style.marginBottom = "8px";

    // If site module exists and detects page type, add extract button
    if (module && module.detect()) {
      logger.debug("Extraction module detected for host:", host);

      const extractBtn = UIComponents.createButton(
        "📚 Extract Book Data",
        async () => {
          logger.info("Extract button clicked");
          const data = await module.extract();
          logger.debug("Extracted data:", data);
          saveBookData(data);
          updateContent(data);
          showTemporaryMessage("Book data extracted and saved.");
          copyJsonBtn.disabled = false; // enable copy button
        },
        { marginRight: "8px" }
      );

      btnContainer.appendChild(extractBtn);
    }

    // If on Hardcover import page, add import button
    if (isImportPage) {
      logger.debug("Hardcover import page detected");

      const importBtn = UIComponents.createButton(
        "⬇️ Import Book Data",
        () => {
          logger.info("Import button clicked");
          const data = loadBookData();
          if (!data || Object.keys(data).length === 0) {
            showTemporaryMessage(
              "No book data found. Please extract book data first."
            );
            logger.warn("Import attempted with no saved book data");
            return;
          }
          importBookDataToHardcover(data);
          showTemporaryMessage("Book data imported!");
          logger.info("Book data imported into Hardcover");
        },
        { marginRight: "8px" }
      );

      btnContainer.appendChild(importBtn);
    }

    // Button to copy JSON data to clipboard
    const copyJsonBtn = UIComponents.createButton(
      "📋 Copy JSON",
      () => {
        try {
          const jsonStr = JSON.stringify(loadBookData(), null, 2);
          navigator.clipboard.writeText(jsonStr).then(() => {
            showTemporaryMessage("Book JSON copied to clipboard.");
          });
        } catch (e) {
          showTemporaryMessage("Failed to copy JSON.");
          logger.error("Copy JSON failed:", e);
        }
      },
      {
        marginRight: "8px",
        disabled: !hasSavedData,
      }
    );

    btnContainer.appendChild(copyJsonBtn);

    // Button to refresh displayed book data in bubble
    const refreshBtn = UIComponents.createButton("🔄 Refresh", () => {
      const refreshedData = loadBookData();
      if (refreshedData && Object.keys(refreshedData).length > 0) {
        updateContent(refreshedData);
        copyJsonBtn.disabled = false;
        showTemporaryMessage("Book data refreshed.");
        logger.info("Book data refreshed via button");
      } else {
        updateContent({});
        copyJsonBtn.disabled = true;
        showTemporaryMessage("No book data found.");
        logger.info("No book data on refresh");
      }
    });

    btnContainer.appendChild(refreshBtn);

    content.appendChild(btnContainer);

    // Show saved book data in bubble on page load, if present
    if (hasSavedData) {
      updateContent(savedData);
      content.style.display = "block";
      bubble.style.height = "auto";
      logger.info("Displaying saved book data in bubble on load");
    }

    /**
     * Updates the bubble's content area with formatted book metadata preview.
     * Displays text fields and cover image with click-to-copy functionality.
     * @param {object} data - The book metadata to display.
     */
    function updateContent(data) {
      logger.debug("Updating bubble content preview");

      // Remove any existing content container to replace
      const oldFlexContainer = content.querySelector(
        ".floatingBubbleFlexContainer"
      );
      if (oldFlexContainer) oldFlexContainer.remove();

      // Use UI module to create book display container
      const display = UIComponents.createBookDisplay(
        data,
        showTemporaryMessage
      );
      display.className = "floatingBubbleFlexContainer";

      content.appendChild(display);
    }
  }

  /**
   * Checks for URL changes on single-page apps by polling.
   * If URL changes, removes existing bubble and reinitializes UI.
   */
  async function checkUrlChange() {
    // Only check for changes if the bubble is expanded
    if (GM_getValue("minimized", false) === false) {
      const currentExtractionTime = GM_getValue("lastExtractionTime", 0);

      // Check for data changes (e.g., extracted from another tab)
      if (currentExtractionTime > lastDisplayedTime) {
        lastDisplayedTime = currentExtractionTime;
        logger.info("Book data updated, reinitializing floating bubble.");
        // Remove existing bubble if present
        const existingBubble = document.getElementById("floatingBubble");
        if (existingBubble) existingBubble.remove();
        // Re-initialize bubble UI
        await initFloatingBubble();
        return; // Skip URL check since we just reinitialized
      }

      // Check for URL changes
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        logger.info("URL changed, reinitializing floating bubble.");
        // Remove existing bubble if present
        const existingBubble = document.getElementById("floatingBubble");
        if (existingBubble) existingBubble.remove();
        // Re-initialize bubble UI
        await initFloatingBubble();
      }
    }
  }

  // Run floating bubble initialization immediately on script load
  initFloatingBubble();

  // Poll for URL changes every 2000ms (adjust interval as needed)
  const bubbleRefresh = 2000;
  setInterval(checkUrlChange, bubbleRefresh);
})();

