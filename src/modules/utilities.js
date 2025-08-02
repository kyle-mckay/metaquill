const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

let currentLogLevel = LogLevel.DEBUG; // Change this to control global verbosity
let bubbleRefresh = 2000; // The number of miliseconds the bubble refreshes the URL. Allows buttons to show/hide dynamically during normal navigation.

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

const bookSchema = {
  sourceId: "", // The source ID from the extracted site (Goodreads, Amazon, Gooble Books, ex)
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