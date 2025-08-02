// ==UserScript==
// @name         Hardcover Librarian Tampermonkey
// @namespace    https://github.com/kyle-mckay/hardcover-librarian-tampermonkey
// @updateURL    https://raw.githubusercontent.com/kyle-mckay/hardcover-librarian-tampermonkey/main/hardcover.user.js
// @downloadURL  https://raw.githubusercontent.com/kyle-mckay/hardcover-librarian-tampermonkey/main/hardcover.user.js
// @author       kyle-mckay
// @version      1.2.1
// @description  Extract book metadata from supported sites like Goodreads and optionally inject into sites like Hardcovers.app for easier book creation.
// @match        https://www.goodreads.com/*
// @match        https://hardcover.app/*
// @match        https://audible.ca/*
// @include /^https:\/\/(www\.)?amazon\.[a-z.]+\/dp\/[A-Z0-9]{10}(?:[/?].*)?$/
// @include /^https:\/\/(www\.)?amazon\.[a-z.]+\/[^\/]+\/dp\/[A-Z0-9]{10}(?:[/?].*)?$/
// @icon         https://assets.hardcover.app/static/favicon.ico
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

async function extractGoodreads() {
  const logger = createLogger("extractGoodreads");
  logger.debug("Invoked extractGoodreads()");

  const data = bookSchema;

  // Expand "...more" contributors if present
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

  // Cover image
  const coverEl =
    document.querySelector(".BookCover__image img.ResponsiveImage")?.src ||
    null;
  data.cover = coverEl;
  logger.debug("Extracted cover:", coverEl);

  // Title
  const titleEl = document.querySelector('h1[data-testid="bookTitle"]');
  data.title = titleEl?.textContent.trim() || "";
  logger.debug("Extracted title:", data.title);

  // Authors (initial set)
  data.authors = Array.from(
    document.querySelectorAll('span[itemprop="name"]')
  ).map((el) => el.textContent.trim());
  logger.debug("Initial authors extracted:", data.authors);

  // Description
  const descEl = document.querySelector(
    'div[data-testid="description"] span.Formatted'
  );
  data.description = descEl?.textContent.trim() || "";
  logger.debug("Extracted description:", data.description);

  // Series
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

  // author/contributor lists
  const authorsSet = new Set();
  const contributorsSet = new Set();
  const authors = [];
  const contributors = [];

  const container = document.querySelector(".ContributorLinksList");
  if (container) {
    // Select all spans with tabindex="-1" inside the container (at any depth)
    const allSpans = container.querySelectorAll("span[tabindex='-1']");

    allSpans.forEach((span) => {
      // For each span, get all ContributorLink anchors inside it
      span.querySelectorAll("a.ContributorLink").forEach((link) => {
        const nameEl = link.querySelector(".ContributorLink__name");
        const roleEl = link.querySelector(".ContributorLink__role");

        const name = nameEl?.textContent.trim() || "";
        const role =
          roleEl?.textContent.trim().replace(/[()\u00A0]/g, "") || "";

        // Avoid duplicates by combining name and role for contributors
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

  // Edition details
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

          // --- Normalize format ---
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

function importBookDataToHardcover(data) {
  const logger = createLogger("importBookDataToHardcover");
  logger.debug("Called with data:", data); // Value was passed in

  if (!data) {
    logger.warn("No data provided, exiting early.");
    return;
  }

  // Local helper to populate input `id` labelled fields and trigger reactive updates
  const setInputId = (id, value) => {
    logger.debug(`Setting input Id for field '${id}' to: `, value);

    const el = document.getElementById(id);
    if (!el || typeof value !== "string") {
      logger.debug(
        `Skipped '${id}' - element not found or value not a string.`
      );
      return;
    }

    // Use native setter to trigger framework reactivity
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;

    nativeInputValueSetter?.call(el, value);

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    logger.debug(`Set input '${id}' to:`, value);
  };

  // Local helper to populate input fields by visible <label> text and trigger reactive updates
  const setInputLabel = (labelText, value) => {
    logger.debug(`Setting input for '${labelText}' to:`, value);

    // Accept string or number values, convert number to string for input
    if (typeof value !== "string" && typeof value !== "number") {
      logger.debug(`Skipped '${labelText}' - value not a string or number`);
      return;
    }
    const stringValue = String(value);

    // Find label with exact trimmed text
    const labels = Array.from(document.querySelectorAll("label"));
    const label = labels.find((l) => l.textContent.trim() === labelText);

    if (!label) {
      logger.debug(`Label '${labelText}' not found`);
      return;
    }

    // Closest container with class 'border-t' that holds label and input/textarea
    const container = label.closest("div.border-t");

    if (!container) {
      logger.debug(`Container for label '${labelText}' not found`);
      return;
    }

    // Look for input or textarea inside container
    const input = container.querySelector("input, textarea");

    if (!input) {
      logger.debug(`Input or textarea for label '${labelText}' not found`);
      return;
    }

    // Set value and trigger reactive input/change events
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(input),
      "value"
    )?.set;

    setter?.call(input, stringValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    logger.debug(`Set input for '${labelText}' to:`, stringValue);
  };

  // Setting form field values using data input
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

(function () {
  "use strict";

  // Create logger for this module
  const logger = createLogger("floatingBubble");

  // Store last url
  let lastUrl = location.href;

  /**
   * Creates a floating bubble container in the bottom-right corner
   * with a clickable header to toggle content visibility.
   * Returns references to the bubble container and content area.
   */
  function createFloatingBubble() {
    logger.debug("Creating floating bubble UI");

    const bubble = document.createElement("div");
    bubble.id = "floatingBubble";
    Object.assign(bubble.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      width: "600px",
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
      transition: "height 0.3s ease",
      height: "40px", // start collapsed
    });

    // Header bar with toggle functionality and icon
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
    toggleIcon.textContent = "▼"; // down arrow for collapsed
    toggleIcon.style.transition = "transform 0.3s ease";
    header.appendChild(toggleIcon);

    bubble.appendChild(header);

    // Content container hidden by default (collapsed)
    const content = document.createElement("div");
    content.id = "floatingBubbleContent";
    Object.assign(content.style, {
      padding: "8px",
      display: "none",
      maxHeight: "350px",
      overflowY: "auto",
      display: "flex",
      gap: "12px",
      flexWrap: "nowrap",
      alignItems: "flex-start",
    });

    bubble.appendChild(content);

    header.onclick = () => {
      if (content.style.display === "none") {
        content.style.display = "flex";
        bubble.style.height = "auto";
        toggleIcon.style.transform = "rotate(180deg)"; // arrow points up
        logger.debug("Bubble expanded");
      } else {
        content.style.display = "none";
        bubble.style.height = "40px";
        toggleIcon.style.transform = "rotate(0deg)"; // arrow points down
        logger.debug("Bubble collapsed");
      }
    };

    document.body.appendChild(bubble);

    logger.info("Floating bubble added to DOM");

    return { bubble, content, header };
  }

  /**
   * Checks if the current page is a Hardcover import page.
   * Re-uses your existing isHardcoverImportPage() function or equivalent.
   */
  function isHardcoverImportPage() {
    const url = location.href;
    const regex =
      /^https:\/\/hardcover\.app\/books\/([^/]+\/)?(editions\/[^/]+\/)?edit$|^https:\/\/hardcover\.app\/books\/new_manual$/;
    return regex.test(url);
  }

  /**
   * Main initialization of floating bubble UI and button setup.
   * Decides which buttons to show based on site and saved data.
   */
  async function initFloatingBubble() {
    logger.info("Initializing floating bubble");

    const rawHost = location.hostname.toLowerCase(); // e.g., "www.website.ca"
    logger.debug(`rawHost: '${rawHost}`);
    const host = rawHost.replace(/^www\./, ""); // "website.ca"

    // Normalize Amazon host to shared key
    const normalizedHost = host.includes("amazon.") ? "amazon" : host;
    logger.debug(`normalizedHost: '${normalizedHost}`);

    const module = siteModules[normalizedHost];

    const isImportPage = isHardcoverImportPage();

    let savedData = loadBookData();
    let hasSavedData = savedData && Object.keys(savedData).length > 0;
    logger.debug("Saved book data found:", hasSavedData);

    const { bubble, content } = createFloatingBubble();

    // Message container for temporary messages
    let messageEl = content.querySelector("#floatingBubbleMessage");
    if (!messageEl) {
      messageEl = document.createElement("div");
      messageEl.id = "floatingBubbleMessage";
      Object.assign(messageEl.style, {
        marginBottom: "8px",
        color: "#007700",
        fontWeight: "bold",
        minHeight: "18px",
        transition: "opacity 0.3s ease",
        opacity: "0",
        userSelect: "none",
      });
      content.insertBefore(messageEl, content.firstChild);
    }

    function showTemporaryMessage(msg, duration = 3000) {
      messageEl.textContent = msg;
      messageEl.style.opacity = "1";

      clearTimeout(showTemporaryMessage.timeoutId);
      showTemporaryMessage.timeoutId = setTimeout(() => {
        messageEl.style.opacity = "0";
        setTimeout(() => {
          messageEl.textContent = "";
        }, 300);
      }, duration);
    }

    const btnContainer = document.createElement("div");
    btnContainer.style.marginBottom = "8px";

    if (module && module.detect()) {
      logger.debug("Extraction module detected for host:", host);

      const extractBtn = document.createElement("button");
      extractBtn.textContent = "📚 Extract Book Data";
      extractBtn.style.marginRight = "8px";

      extractBtn.onclick = async () => {
        logger.info("Extract button clicked");
        const data = await module.extract();
        logger.debug("Extracted data:", data);
        saveBookData(data);
        updateContent(data);
        showTemporaryMessage("Book data extracted and saved.");
        copyJsonBtn.disabled = false; // enable copy button
      };

      btnContainer.appendChild(extractBtn);
    }

    if (isImportPage) {
      logger.debug("Hardcover import page detected");

      const importBtn = document.createElement("button");
      importBtn.textContent = "⬇️ Import Book Data";
      importBtn.style.marginRight = "8px";

      importBtn.onclick = async () => {
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
      };

      btnContainer.appendChild(importBtn);
    }

    // Copy JSON button
    const copyJsonBtn = document.createElement("button");
    copyJsonBtn.textContent = "📋 Copy JSON";
    copyJsonBtn.disabled = !hasSavedData;
    copyJsonBtn.style.marginRight = "8px";
    copyJsonBtn.onclick = () => {
      try {
        const jsonStr = JSON.stringify(loadBookData(), null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
          showTemporaryMessage("Book JSON copied to clipboard.");
        });
      } catch (e) {
        showTemporaryMessage("Failed to copy JSON.");
        logger.error("Copy JSON failed:", e);
      }
    };
    btnContainer.appendChild(copyJsonBtn);

    // Refresh button
    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "🔄 Refresh";
    refreshBtn.onclick = () => {
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
    };
    btnContainer.appendChild(refreshBtn);

    content.appendChild(btnContainer);

    if (hasSavedData) {
      updateContent(savedData);
      content.style.display = "block";
      bubble.style.height = "auto";
      logger.info("Displaying saved book data in bubble on load");
    }

    // Detect URL changes to reload content from storage
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        const newData = loadBookData();
        if (newData && Object.keys(newData).length > 0) {
          updateContent(newData);
          copyJsonBtn.disabled = false;
          logger.info("Content preview updated on URL change");
        }
      }
    }).observe(document, { subtree: true, childList: true });

    function updateContent(data) {
      logger.debug("Updating bubble content preview");

      // Remove previous flex container with text + image if present
      const oldFlexContainer = content.querySelector(
        ".floatingBubbleFlexContainer"
      );
      if (oldFlexContainer) oldFlexContainer.remove();

      // Container to hold formatted text and image side by side
      const flexContainer = document.createElement("div");
      flexContainer.className = "floatingBubbleFlexContainer";
      Object.assign(flexContainer.style, {
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        maxHeight: "250px",
        overflow: "hidden",
      });

      // Left pane: formatted text container
      const textContainer = document.createElement("div");
      Object.assign(textContainer.style, {
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

      // Helper to capitalize field names prettily
      const prettify = (str) =>
        str
          .replace(/([A-Z])/g, " $1") // split camelCase
          .replace(/^./, (c) => c.toUpperCase()) // capitalize first letter
          .trim();

      // Iterate fields except cover
      Object.entries(data).forEach(([key, value]) => {
        if (!value) return; // skip empty or falsy

        // Custom formatting for audiobookDuration array
        if (
          key === "audiobookDuration" &&
          Array.isArray(value) &&
          value.length > 0
        ) {
          const dur = value[0]; // assuming one duration object
          const parts = [];
          if (dur.hours)
            parts.push(`${dur.hours} hour${dur.hours !== 1 ? "s" : ""}`);
          if (dur.minutes)
            parts.push(`${dur.minutes} minute${dur.minutes !== 1 ? "s" : ""}`);
          if (dur.seconds)
            parts.push(`${dur.seconds} second${dur.seconds !== 1 ? "s" : ""}`);
          value = parts.join(", ");
          if (!value) return;
        } else if (Array.isArray(value)) {
          if (key === "contributors") {
            value = value.map((c) => `${c.name} (${c.role})`).join(", ");
          } else {
            value = value.join(", ");
          }
          if (!value) return;
        }

        const fieldDiv = document.createElement("div");
        fieldDiv.style.marginBottom = "4px";

        const labelSpan = document.createElement("span");
        labelSpan.textContent = `${prettify(key)}: `;
        labelSpan.style.fontWeight = "bold";

        const valueSpan = document.createElement("span");
        valueSpan.textContent = value;
        valueSpan.style.cursor = "pointer";
        valueSpan.style.color = "#0055aa";
        valueSpan.style.textDecoration = "underline";
        valueSpan.title = "Click to copy";

        valueSpan.onclick = () => {
          navigator.clipboard.writeText(value).then(() => {
            logger.info(`Copied "${key}" to clipboard.`);
            showTemporaryMessage(`Copied ${prettify(key)} to clipboard`);
          });
        };

        fieldDiv.appendChild(labelSpan);
        fieldDiv.appendChild(valueSpan);
        textContainer.appendChild(fieldDiv);
      });

      flexContainer.appendChild(textContainer);

      // Right pane: image container, same as before
      if (data.cover) {
        const imgContainer = document.createElement("div");
        imgContainer.id = "imgContainer";
        Object.assign(imgContainer.style, {
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
        img.style.width = "100%";
        img.style.borderRadius = "6px";
        img.style.cursor = "pointer";

        link.appendChild(img);
        imgContainer.appendChild(link);

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
            alert("Failed to download image.");
            logger.error("Image download failed:", err);
          }
        };

        imgContainer.appendChild(downloadLink);

        flexContainer.appendChild(imgContainer);
      }

      content.appendChild(flexContainer);
    }
  }

  /**
   * Checks to see if the page has changed by normal navigation
   * update bubble dynamically
   */
  async function checkUrlChange() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      logger.info("URL changed, reinitializing floating bubble.");
      // Remove existing bubble if any
      const existingBubble = document.getElementById("floatingBubble");
      if (existingBubble) existingBubble.remove();
      // Re-run init
      await initFloatingBubble();
    }
  }

  // Run initialization immediately
  initFloatingBubble();

  // Poll for URL changes every 2000ms (adjust interval as needed)
  setInterval(checkUrlChange, bubbleRefresh);
})();

