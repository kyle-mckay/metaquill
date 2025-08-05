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

      const parts = subtitleText.split("–").map((part) => part.trim());

      if (parts.length === 2) {
        const rawFormat = parts[0].toLowerCase();

        // Determine reading format and extract edition info
        if (rawFormat.includes("kindle") || rawFormat.includes("ebook")) {
          readingFormat = "E-Book";
          editionInfo = parts[0];
        } else if (
          rawFormat.includes("hardcover") ||
          rawFormat.includes("paperback") ||
          rawFormat.includes("mass market") ||
          rawFormat.includes("large print")
        ) {
          readingFormat = "Physical Book";
          editionInfo = parts[0];
        } else if (rawFormat.includes("audiobook")) {
          readingFormat = "Audiobook";
          editionFormat = "Audible";
          editionInfo = "";
        } else {
          readingFormat = parts[0]; // fallback
          editionInfo = "";
        }

        releaseDate = parts[1];

        logger.debug(`Reading format: ${readingFormat}`);
        logger.debug(`Edition info: ${editionInfo}`);
        logger.debug(`Release date: ${releaseDate}`);
      } else {
        logger.debug('Subtitle does not contain expected format with "–"');
      }
    } else if (bindingEl) {
      // Fallback for audiobook layout
      const bindingText = bindingEl.textContent.trim();
      let versionText = versionEl ? versionEl.textContent.trim() : "";
      versionText = versionText.replace(/^–+\s*/, "");

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

    // --- Audible product page (Audiobook format) ---
    if (
      readingFormatLower.includes("audiobook") ||
      readingFormatLower === "audiobook"
    ) {
      const audibleDetailsTable = document.querySelector(
        "#audibleProductDetails table.a-keyvalue"
      );

      if (audibleDetailsTable) {
        const rows = audibleDetailsTable.querySelectorAll("tr");
        rows.forEach((row) => {
          const header =
            row.querySelector("th")?.textContent?.trim().toLowerCase() || "";
          const valueEl = row.querySelector("td");
          const valueText = valueEl?.textContent?.trim() || "";

          switch (header) {
            case "best sellers rank":
              // Skip unneeded rank data
              logger.debug("Skipping Best Sellers Rank");
              break;

            case "author":
              const authors = parseContributorField(header, valueText);
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
              const narrator = parseContributorField(header, valueText);
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
                data.seriesName = valueText;
                logger.debug(`Series name: ${data.seriesName}`);
              } else {
                logger.debug(
                  `Skipped seriesName: already set: ${data.seriesName}`
                );
              }
              break;

            case "listening length":
              if (!data.audiobookDuration?.length) {
                // Extract "X hours Y minutes" style duration
                const durationParts =
                  valueText
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
                logger.debug(
                  `Audiobook duration: ${JSON.stringify(durationObj)}`
                );
              }
              break;

            case "publisher":
              if (!data.publisher) {
                data.publisher = valueText;
                logger.debug(`Publisher: ${data.publisher}`);
              } else {
                logger.debug(
                  `Skipped publisher: already set: ${data.publisher}`
                );
              }
              break;

            case "program type":
              if (!data.readingFormat) {
                data.readingFormat = valueText;
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
                data.editionInfo = valueText.replace(/^–+\s*/, "");
                logger.debug(`Edition info: ${data.editionInfo}`);
              } else {
                logger.debug(
                  `Skipped editionInfo: already set: ${data.editionInfo}`
                );
              }
              break;

            case "language":
              if (!data.releaseLanguage) {
                data.releaseLanguage = valueText;
                logger.debug(`Release language: ${data.releaseLanguage}`);
              } else {
                logger.debug(
                  `Skipped releaseLanguage: already set: ${data.releaseLanguage}`
                );
              }
              break;

            case "asin":
              
              if (!data.asin) {
                data.asin = valueText;
                logger.debug(`ASIN: ${data.asin}`);
              } else {
                logger.debug(`Skipped asin: already set: ${data.asin}`);
                break;
              }
              if (!data.sourceId) {
                data.sourceId = valueText
                logger.debug(`Source ID: ${data.sourceId}`);
              } else {
                logger.debug(`Skipped source id: already set: ${data.sourceId}`);
                break;
              }
              break;

            default:
              // Handle "Audible release date" keys
              if (/^audible\.\w+\s+release date$/i.test(header)) {
                if (!data.releaseDate) {
                  data.releaseDate = valueText;
                  logger.debug(`Release date (Audible): ${data.releaseDate}`);
                } else {
                  logger.debug(
                    `Skipped releaseDate: already set: ${data.releaseDate}`
                  );
                }
              } else {
                logger.warn(`Unrecognized label: "${header}": "${valueText}"`);
              }
              break;
          }
        });
      } else {
        logger.debug("Audible product details table not found");
      }
    }

    // --- Physical/Ebook product page ---
    else {
      const detailBulletsList = document.querySelector(
        "#detailBullets_feature_div ul.detail-bullet-list"
      );

      if (detailBulletsList) {
        const items = detailBulletsList.querySelectorAll("li");

        items.forEach((li) => {
          const labelEl = li.querySelector("span.a-text-bold");
          const valueEl = labelEl ? labelEl.nextElementSibling : null;
          if (!labelEl || !valueEl) return;

          let label = labelEl.textContent || "";
          label = label
            .replace(/[‏:\u200E\u200F]/g, "")
            .trim()
            .toLowerCase();
          const value = valueEl.textContent.trim();

          logger.debug(`Detail bullet label: "${label}", value: "${value}"`);

          switch (label) {
            case "publisher":
              if (!data.publisher) {
                data.publisher = value;
                logger.debug(`Publisher: ${data.publisher}`);
              } else {
                logger.debug(
                  `Skipped publisher: already set: ${data.publisher}`
                );
              }
              break;

            case "publication date":
              if (!data.releaseDate) {
                data.releaseDate = value;
                logger.debug(`Release date: ${data.releaseDate}`);
              } else {
                logger.debug(
                  `Skipped releaseDate: already set: ${data.releaseDate}`
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
                logger.debug(
                  `Skipped pageCount: already set: ${data.pageCount}`
                );
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

            default:
              logger.warn(`Unrecognized label: "${label}": "${value}"`);
              break;
          }
        });
      } else {
        logger.debug("Detail bullets list not found");
      }
    }
  } catch (error) {
    logger.error(`Error extracting from product details: ${error}`);
  }

  return data;
}

// #endregion

