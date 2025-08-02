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
    logger.debug(`[extractAmazon] Title extracted: ${data.title}`);
  } else {
    logger.debug("[extractAmazon] Title element not found");
  }

  if (subtitleEl) {
    const subtitleText = subtitleEl.textContent.trim();
    logger.debug(`[extractAmazon] Subtitle extracted: ${subtitleText}`);

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
      logger.debug(`[extractAmazon] Reading format: ${data.readingFormat}`);
      logger.debug(`[extractAmazon] Edition info: ${data.editionInfo}`);
      logger.debug(`[extractAmazon] Release date: ${data.releaseDate}`);
    } else {
      logger.debug(
        '[extractAmazon] Subtitle does not contain expected format with "–"'
      );
    }
  } else if (bindingEl) {
    // Audiobook fallback
    const bindingText = bindingEl.textContent.trim();
    let versionText = versionEl ? versionEl.textContent.trim() : "";
    versionText = versionText.replace(/^–+\s*/, "");

    data.readingFormat = "Audiobook";
    data.editionFormat = "Audible";
    data.editionInfo = versionText || "";

    logger.debug(
      `[extractAmazon] Reading format set to: ${data.readingFormat}`
    );
    logger.debug(
      `[extractAmazon] Edition format set to: ${data.editionFormat}`
    );
    logger.debug(`[extractAmazon] Edition info set to: ${data.editionInfo}`);

    data.releaseDate = "";
  } else {
    logger.debug("[extractAmazon] Subtitle and audiobook elements not found");
  }

  // Extract description

  const descriptionContainer = document.querySelector(
    "#bookDescription_feature_div .a-expander-content"
  );
  if (descriptionContainer) {
    data.description = htmlToTextWithLineBreaks(descriptionContainer);
    logger.debug("[extractAmazon] Description extracted with line breaks.");
  } else {
    logger.debug("[extractAmazon] Description element not found.");
  }

  // Extract Cover
  const coverImgEl = document.getElementById("landingImage");
  if (coverImgEl) {
    data.cover = coverImgEl.src || "";
    logger.debug(`[extractAmazon] Cover image URL extracted: ${data.cover}`);
  } else {
    logger.debug("[extractAmazon] Cover image element not found");
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
            logger.debug(`[extractAmazon] Series name: ${data.seriesName}`);
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
            logger.debug(
              `[extractAmazon] Audiobook duration: ${JSON.stringify(
                durationObj
              )}`
            );
            break;

          case "audible.com release date":
            data.releaseDate = valueText;
            logger.debug(
              `[extractAmazon] Release date (Audible): ${data.releaseDate}`
            );
            break;

          case "publisher":
            data.publisher = valueText;
            logger.debug(`[extractAmazon] Publisher: ${data.publisher}`);
            break;

          case "program type":
            data.readingFormat = valueText;
            logger.debug(
              `[extractAmazon] Reading format (Program Type): ${data.readingFormat}`
            );
            break;

          case "version":
            data.editionInfo = valueText.replace(/^–+\s*/, "");
            logger.debug(`[extractAmazon] Edition info: ${data.editionInfo}`);
            break;

          case "language":
            data.releaseLanguage = valueText;
            logger.debug(
              `[extractAmazon] Release language: ${data.releaseLanguage}`
            );
            break;

          case "asin":
            data.asin = valueText;
            logger.debug(`[extractAmazon] ASIN: ${data.asin}`);
            break;
        }
      });
    } else {
      logger.debug("[extractAmazon] Audible product details table not found");
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

        logger.debug(
          `[extractAmazon] Detail bullet label: "${label}", value: "${value}"`
        );

        switch (label) {
          case "publisher":
            if (!data.publisher) data.publisher = value;
            logger.debug(`[extractAmazon] Publisher: ${data.publisher}`);
            break;

          case "publication date":
            data.releaseDate = value;
            logger.debug(`[extractAmazon] Release date: ${data.releaseDate}`);
            break;

          case "language":
            data.releaseLanguage = value;
            logger.debug(
              `[extractAmazon] Release language: ${data.releaseLanguage}`
            );
            break;

          case "print length":
            const pageCountMatch = value.match(/\d+/);
            if (pageCountMatch) {
              data.pageCount = parseInt(pageCountMatch[0], 10);
              logger.debug(`[extractAmazon] Page count: ${data.pageCount}`);
            }
            break;

          case "isbn-10":
            data.isbn10 = value.replace(/-/g, "");
            logger.debug(`[extractAmazon] ISBN-10: ${data.isbn10}`);
            break;

          case "isbn-13":
            data.isbn13 = value.replace(/-/g, "");
            logger.debug(`[extractAmazon] ISBN-13: ${data.isbn13}`);
            break;

          case "part of series":
            data.seriesName = value;
            logger.debug(`[extractAmazon] Series name: ${data.seriesName}`);
            break;
        }
      });
    } else {
      logger.debug("[extractAmazon] Detail bullets list not found");
    }
  }

  logger.debug("Final extracted Amazon data:", data);
  return data;
}