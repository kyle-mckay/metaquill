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

  const data = bookSchema;

  // --- Basic title, subtitle, reading format, edition info ---
  const titleEl = document.querySelector("#productTitle");
  const subtitleEl = document.querySelector("#productSubtitle");
  const bindingEl = document.querySelector("#productBinding");
  const versionEl = document.querySelector("#productVersion");

  if (titleEl) {
    data.title = titleEl.textContent.trim();
    logger.debug(`Title extracted: ${data.title}`);
  } else {
    logger.debug("Title element not found");
  }

  if (subtitleEl) {
    const subtitleText = subtitleEl.textContent.trim();
    logger.debug(`Subtitle extracted: ${subtitleText}`);

    const parts = subtitleText.split("–").map((part) => part.trim());

    if (parts.length === 2) {
      // Normalize readingFormat here
      const rawFormat = parts[0].toLowerCase();

      if (rawFormat.includes("kindle") || rawFormat.includes("ebook")) {
        data.readingFormat = "E-Book";
        data.editionInfo = parts[0]; // preserve original format info
      } else if (
        rawFormat.includes("hardcover") ||
        rawFormat.includes("paperback") ||
        rawFormat.includes("mass market") ||
        rawFormat.includes("large print")
      ) {
        data.readingFormat = "Physical Book";
        data.editionInfo = parts[0]; // move format description here
      } else if (rawFormat.includes("audiobook")) {
        data.readingFormat = "Audiobook";
        data.editionFormat = "Audible"; // default for audiobook
        data.editionInfo = ""; // no editionInfo here for now
      } else {
        // Fallback: just store original
        data.readingFormat = parts[0];
        data.editionInfo = "";
      }

      data.releaseDate = parts[1];
      logger.debug(`Reading format: ${data.readingFormat}`);
      logger.debug(`Edition info: ${data.editionInfo}`);
      logger.debug(`Release date: ${data.releaseDate}`);
    } else {
      logger.debug('Subtitle does not contain expected format with "–"');
    }
  } else if (bindingEl) {
    // Audiobook fallback
    const bindingText = bindingEl.textContent.trim();
    let versionText = versionEl ? versionEl.textContent.trim() : "";
    versionText = versionText.replace(/^–+\s*/, "");

    data.readingFormat = "Audiobook";
    data.editionFormat = "Audible";
    data.editionInfo = versionText || "";

    logger.debug(`Reading format set to: ${data.readingFormat}`);
    logger.debug(`Edition format set to: ${data.editionFormat}`);
    logger.debug(`Edition info set to: ${data.editionInfo}`);

    data.releaseDate = "";
  } else {
    logger.debug("Subtitle and audiobook elements not found");
  }

  // Extract description

  const descriptionContainer = document.querySelector(
    "#bookDescription_feature_div .a-expander-content"
  );
  if (descriptionContainer) {
    data.description = htmlToTextWithLineBreaks(descriptionContainer);
    logger.debug("Description extracted with line breaks.");
  } else {
    logger.debug("Description element not found.");
  }

  // Extract Cover
  const coverImgEl = document.getElementById("landingImage");
  if (coverImgEl) {
    data.cover = coverImgEl.src || "";
    logger.debug(`Cover image URL extracted: ${data.cover}`);
  } else {
    logger.debug("Cover image element not found");
  }

  // --- Extract authors, contributors, publisher from byline ---
  logger.debug("Extracting authors, contributors, and publisher");

  const bylineSpans = document.querySelectorAll("#bylineInfo .author");
  const authorsSet = new Set();
  const contributors = [];
  let publisherName = "";

  bylineSpans.forEach((span) => {
    const name = span.querySelector("a")?.textContent?.trim();
    const roleRaw = span
      .querySelector(".contribution .a-color-secondary")
      ?.textContent?.trim();
    if (!name || !roleRaw) return;

    // Clean and normalize roles, split by commas or spaces
    const roles = roleRaw
      .replace(/[()]/g, "")
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((r) => r.toLowerCase());

    // Add to authors if any role is 'author'
    if (roles.includes("author")) {
      authorsSet.add(name);
    }

    if (roles.includes("publisher")) {
      publisherName = name;
    } else {
      // For contributors, exclude 'author' role if already an author
      const contributorRoles = roles.filter((r) => r !== "author");

      if (contributorRoles.length > 0) {
        const roleDisplay = contributorRoles
          .map((r) => r.charAt(0).toUpperCase() + r.slice(1))
          .join(" ");
        contributors.push({
          name,
          role: roleDisplay,
        });
      }
    }
  });

  data.authors = Array.from(authorsSet);
  data.contributors = contributors;
  data.publisher = publisherName;

  logger.debug(`Authors parsed: ${JSON.stringify(data.authors)}`);
  logger.debug(`Contributors parsed: ${JSON.stringify(data.contributors)}`);
  logger.debug(`Publisher parsed: ${data.publisher}`);

  // Parse Series

  const seriesWidget = document.querySelector('#seriesBulletWidget_feature_div a');

if (seriesWidget) {
  const text = seriesWidget.textContent.trim(); // "Book 20 of 29: Backyard Starship"

  const match = text.match(/Book\s+(\d+)\s+of\s+\d+:\s+(.+)/i);
  if (match) {
    const seriesNumber = match[1]; // "20"
    const seriesName = match[2];   // "Backyard Starship"

    data.seriesNumber = seriesNumber;
    data.seriesName = seriesName;

    logger.debug(`Series number: ${seriesNumber}`);
    logger.debug(`Series name: ${seriesName}`);
  }
}

  // --- Determine where to parse product details based on readingFormat ---
  const readingFormatLower = (data.readingFormat || "").toLowerCase();

  if (
    readingFormatLower.includes("audiobook") ||
    readingFormatLower === "audiobook"
  ) {
    // Parse Audible product details table
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
          case "part of series":
            data.seriesName = valueText;
            logger.debug(`Series name: ${data.seriesName}`);
            break;

          case "listening length":
            // Parse duration into hours, minutes, seconds
            const durationParts =
              valueText
                .toLowerCase()
                .match(/\d+\s*hours?|\d+\s*minutes?|\d+\s*seconds?/g) || [];
            let durationObj = { hours: 0, minutes: 0, seconds: 0 };
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
            break;

          case "audible.com release date":
            data.releaseDate = valueText;
            logger.debug(`Release date (Audible): ${data.releaseDate}`);
            break;

          case "publisher":
            data.publisher = valueText;
            logger.debug(`Publisher: ${data.publisher}`);
            break;

          case "program type":
            data.readingFormat = valueText;
            logger.debug(
              `Reading format (Program Type): ${data.readingFormat}`
            );
            break;

          case "version":
            data.editionInfo = valueText.replace(/^–+\s*/, "");
            logger.debug(`Edition info: ${data.editionInfo}`);
            break;

          case "language":
            data.releaseLanguage = valueText;
            logger.debug(`Release language: ${data.releaseLanguage}`);
            break;

          case "asin":
            data.asin = valueText;
            logger.debug(`ASIN: ${data.asin}`);
            break;
        }
      });
    } else {
      logger.debug("Audible product details table not found");
    }
  } else {
    // Regular books - parse detail bullets
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
            if (!data.publisher) data.publisher = value;
            logger.debug(`Publisher: ${data.publisher}`);
            break;

          case "publication date":
            data.releaseDate = value;
            logger.debug(`Release date: ${data.releaseDate}`);
            break;

          case "language":
            data.releaseLanguage = value;
            logger.debug(`Release language: ${data.releaseLanguage}`);
            break;

          case "print length":
            const pageCountMatch = value.match(/\d+/);
            if (pageCountMatch) {
              data.pageCount = parseInt(pageCountMatch[0], 10);
              logger.debug(`Page count: ${data.pageCount}`);
            }
            break;

          case "isbn-10":
            data.isbn10 = value.replace(/-/g, "");
            logger.debug(`ISBN-10: ${data.isbn10}`);
            break;

          case "isbn-13":
            data.isbn13 = value.replace(/-/g, "");
            logger.debug(`ISBN-13: ${data.isbn13}`);
            break;
        }
      });
    } else {
      logger.debug("Detail bullets list not found");
    }
  }

  logger.debug("Final extracted Amazon data:", data);
  return data;
}

