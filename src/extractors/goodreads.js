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

