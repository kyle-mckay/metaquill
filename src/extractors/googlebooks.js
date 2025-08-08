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
    data.releaseLanguage = volumeInfo.language;
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

