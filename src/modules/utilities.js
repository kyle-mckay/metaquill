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
        console.error("[ERROR]", ...args);
        break;
      case LogLevel.WARN:
        console.warn("[WARN]", ...args);
        break;
      case LogLevel.INFO:
        console.info("[ℹINFO]", ...args);
        break;
      case LogLevel.DEBUG:
        console.debug("[DEBUG]", ...args);
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
  sourceId: "", // The source ID from the extracted site (Goodreads, Amazon, Google Books, etc.)
  title: "",
  subtitle: "",
  urlSlug: "",
  headline: "", // Description headline field
  literaryType: "", // Fiction, Non-Fiction or 'Unknown or Not Applicable'
  bookCategory: "", // Book, Novella, Short Story, Graphic Novel, Fan Fiction, Research Paper, Poetry, Collection, Web Novel, Light Novel
  compilation: false, // If it is a compilation of other books
  seriesName: "",
  seriesNumber: "",
  isbn10: "",
  isbn13: "",
  asin: "",
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
  description: "", // Multi text book description
};

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
    logger.debug('Input is not an array');
    return [];
  }

  if (arr.length === 0) {
    logger.debug('Empty array, nothing to dedupe');
    return [];
  }

  // Deduplicating authors (strings)
  if (typeof arr[0] === 'string') {
    logger.debug(`Deduplicating ${arr.length} author(s)`);
    const deduped = [...new Set(arr.map(name => name.trim()))];
    logger.debug(`Resulting author count: ${deduped.length}`);
    return deduped;
  }

  // Deduplicating contributors (objects)
  logger.debug(`Deduplicating ${arr.length} contributor(s)`);
  const seen = new Set();
  const deduped = [];

  for (const obj of arr) {
    const key = `${obj.name.trim().toLowerCase()}|${obj.role.trim().toLowerCase()}`;
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
  // add other site modules here
};

