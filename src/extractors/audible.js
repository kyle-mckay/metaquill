// ===== SECTION: Audible Extractor =====
// ===== FILE PATH: src/extractors/audible.js ==========

/**
 * Derives the Audible catalog API base URL for the current storefront domain.
 * The API host mirrors the storefront host with the "www" subdomain swapped for "api"
 * (e.g. www.audible.de -> api.audible.de), so this works for any Audible TLD.
 *
 * @returns {string} - The API base URL (e.g. "https://api.audible.com").
 */
function getAudibleApiBase() {
  const host = location.hostname.replace(/^www\./, "");
  return `https://api.${host}`;
}

/**
 * Extracts the ASIN from an Audible URL's last path segment.
 * Audible puts the ASIN there regardless of page type, e.g.:
 *   /pd/Chrysalis-4-Audiobook/B0CRSC3RQF
 *   /series/Book-of-the-Dead-Audiobooks/B0CPHQTMHN?eac_link=...
 *
 * @param {string} pathname - A URL pathname to extract the ASIN from.
 * @returns {string|null} - The 10-character ASIN, or null if not found.
 */
function asinFromPathname(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  return last && /^[A-Z0-9]{10}$/i.test(last) ? last.toUpperCase() : null;
}

/**
 * Extracts the ASIN for the current Audible page.
 * Checks the URL path first, falling back to the canonical link tag.
 *
 * @returns {string|null} - The 10-character ASIN, or null if not found.
 */
function getAudibleAsin() {
  const pathAsin = asinFromPathname(location.pathname);
  if (pathAsin) return pathAsin;

  const canonicalHref = document.querySelector('link[rel="canonical"]')?.href || "";
  try {
    return asinFromPathname(new URL(canonicalHref, location.origin).pathname);
  } catch {
    return null;
  }
}

/**
 * Fetches book data from the Audible catalog API for the given ASIN,
 * using the API host derived from the current storefront domain.
 *
 * @param {string} asin - The Audible ASIN.
 * @returns {Promise<object>} - The API response data.
 * @throws {Error} - If the API request fails.
 */
async function fetchAudibleApiData(asin) {
  const logger = createLogger("fetchAudibleApiData");
  const responseGroups =
    "contributors,media,product_desc,product_attrs,product_extended_attrs,product_details,series";
  const apiUrl = `${getAudibleApiBase()}/1.0/catalog/products/${asin}?response_groups=${responseGroups}`;

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
 * Maps Audible catalog API product data to our book schema.
 *
 * @param {object} data - The book schema object to populate.
 * @param {object} product - The "product" section from the API response.
 */
function mapAudibleApiDataToSchema(data, product) {
  const logger = createLogger("mapAudibleApiDataToSchema");

  if (product.title) {
    data.title = product.title;
    logger.debug(`API title: ${data.title}`);
  }

  if (product.subtitle) {
    data.subtitle = product.subtitle;
    logger.debug(`API subtitle: ${data.subtitle}`);
  }

  const summary = product.publisher_summary || product.extended_product_description || product.merchandising_summary;
  if (summary) {
    data.description = summary.replace(/<[^>]*>/g, "");
    logger.debug(`API description: ${data.description.slice(0, 100)}...`);
  }

  if (product.authors?.length) {
    data.authors = product.authors.map((author) => author.name).filter(Boolean);
    logger.debug(`API authors: ${data.authors.join(", ")}`);
  }

  if (product.narrators?.length) {
    data.contributors = [
      ...data.contributors,
      ...product.narrators
        .map((narrator) => narrator.name)
        .filter(Boolean)
        .map((name) => ({ name, role: "Narrator" })),
    ];
    logger.debug(`API narrators: ${JSON.stringify(data.contributors)}`);
  }

  if (product.series?.length) {
    data.seriesName = product.series[0].title || "";
    data.seriesNumber = product.series[0].sequence ? String(product.series[0].sequence) : "";
    logger.debug(`API series: ${data.seriesName} #${data.seriesNumber}`);
  }

  if (product.publisher_name) {
    data.publisher = product.publisher_name;
    logger.debug(`API publisher: ${data.publisher}`);
  }

  const releaseDate = product.release_date || product.issue_date;
  if (releaseDate) {
    data.releaseDate = releaseDate;
    logger.debug(`API release date: ${data.releaseDate}`);
  }

  if (product.language) {
    data.releaseLanguage = product.language.charAt(0).toUpperCase() + product.language.slice(1);
    logger.debug(`API language: ${data.releaseLanguage}`);
  }

  if (typeof product.runtime_length_min === "number") {
    data.audiobookDuration = [
      {
        hours: Math.floor(product.runtime_length_min / 60),
        minutes: product.runtime_length_min % 60,
        seconds: 0,
      },
    ];
    logger.debug(`API runtime: ${JSON.stringify(data.audiobookDuration)}`);
  }

  if (product.isbn) {
    if (product.isbn.length === 10) {
      data.isbn10 = product.isbn;
    } else {
      data.isbn13 = product.isbn;
    }
    logger.debug(`API ISBN: ${product.isbn}`);
  }

  if (product.product_images) {
    const sizes = Object.keys(product.product_images)
      .map(Number)
      .sort((a, b) => b - a);
    if (sizes.length) {
      data.cover = product.product_images[String(sizes[0])];
      logger.debug(`API cover: ${data.cover}`);
    }
  }

  data.readingFormat = "Audiobook";
  data.editionFormat = "Audible";
  data.editionInfo = /abridged/i.test(product.format_type || "")
    ? product.format_type.charAt(0).toUpperCase() + product.format_type.slice(1)
    : "";
}

/**
 * Extracts book data from an Audible product detail page by calling the
 * Audible catalog API for the domain the user is currently browsing.
 *
 * @returns {Promise<object>} - The extracted book data.
 */
async function extractAudible() {
  const logger = createLogger("extractAudible");
  const data = { ...bookSchema, authors: [], contributors: [] };

  const asin = getAudibleAsin();
  if (!asin) {
    logger.warn("No ASIN found on this Audible page");
    return data;
  }

  data.asin = asin;
  data.sourceId = asin;

  try {
    const apiData = await fetchAudibleApiData(asin);
    mapAudibleApiDataToSchema(data, apiData.product || {});

    if (data.cover) {
      data.cover = await getHighResImageUrl(data.cover);
      logger.debug(`Resolved high-res cover: ${data.cover}`);
    }
  } catch (error) {
    logger.error("Failed to extract Audible data:", error);
  }

  logger.debug("Returning book data:", data);
  return data;
}

