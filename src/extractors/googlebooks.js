// ===== SECTION: Google Books Extraction =====
// ===== FILE PATH: src/extractors/google.js ==========

/**
 * Main extractor function for Google Books pages.
 *
 * Aggregates book metadata by querying the DOM and calling helper functions.
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
  logger.debug(`Source ID: ${data.sourceID}`);

  data.title = getGoogleBookTitle();
  logger.debug(`Title extracted: ${data.title}`);

  const root = document.querySelector(".r0Sd2e");

  const { isbn10, isbn13 } = extractIsbns(root);
  data.isbn10 = isbn10;
  logger.debug(`ISBN-10 extracted: ${data.isbn10}`);
  data.isbn13 = isbn13;
  logger.debug(`ISBN-13 extracted: ${data.isbn13}`);

  data.releaseDate = getGoogleBookReleaseDate();
  logger.debug(`Published date extracted: ${data.releaseDate}`);

  data.publisher = getGoogleBookPublisher();
  logger.debug(`Publisher extracted: ${data.publisher}`);

  data.releaseLanguage = getGoogleBookLanguage();
  logger.debug(`Release language extracted: ${data.releaseLanguage}`);

  data.pageCount = getGoogleBookPageCount();
  logger.debug(`Page count extracted: ${data.pageCount}`);

  data.description = getGoogleBookDescription();
  logger.debug(`Description extracted: ${data.description}`);

  const { readingFormat, editionInfo } = getGoogleBookReadingFormat();
  data.editionInfo = editionInfo;
  logger.debug(`Edition info extracted: ${data.editionInfo}`);
  data.readingFormat = readingFormat;;
  logger.debug(`Reading format extracted: ${data.readingFormat}`);

  const authors = getGoogleBookAuthors();
  data.authors = dedupeObject([...(data.authors || []), ...authors]);
  logger.debug(`Authors extracted: ${data.authors}`);

  data.cover = getGoogleBooksCoverUrl(data.sourceId);
  logger.debug(`URL Extracted: ${data.cover}`);

  // TODO Audiobooks?

  // TODO Other contributors?

  logger.debug(`Returning book data:`, data);
  return data;
}

// #region Google Book Helperrs

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
 * Retrieves text from a container’s value span.
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

