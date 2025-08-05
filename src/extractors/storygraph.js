// ===== SECTION: StoryGraph Extraction =====
// ===== FILE PATH: src/extractors/storygraph.js ==========

/**
 * Extracts book metadata from a StoryGraph book page.
 * 
 * This async function scrapes various details including:
 * - Cover image URL
 * - Title and series information
 * - Authors and contributors with roles
 * - Edition details like format, publication date, publisher, ISBN, and language
 * - Description text (expands "read more" if present)
 * - Page count and audiobook duration
 * 
 * Uses DOM queries targeting StoryGraph's page structure, with logic to normalize and parse key fields.
 * Waits briefly to load expanded description if necessary.
 * Logs detailed debug messages to trace extraction steps.
 * Returns a populated bookSchema object with extracted metadata.
 */
async function extractStoryGraph() {
    const logger = createLogger("extractStoryGraph");
    logger.debug("Invoked extractStoryGraph()");
  
    const data = { ...bookSchema };
  
    data.sourceId = getStoryGraphBookId(window.location.href);
    logger.debug(`Source ID: ${data.sourceId}`);
  
    // Extract cover image URL
    const coverEl = document.querySelector('.book-cover img');
    if (coverEl?.src) {
      data.cover = await getHighResImageUrl(coverEl.src);
      logger.debug("Extracted cover:", data.cover);
    }
  
    // Extract book title
    const titleEl = document.querySelector('.book-title-author-and-series h3');
    const rawTitle = titleEl?.childNodes[0]?.textContent.trim();
    data.title = rawTitle || "";
    logger.debug("Extracted title:", data.title);
  
    // Extract series information
    extractSeriesInfo(data, logger);
  
    // Extract contributors (authors, narrators, etc.)
    extractStoryGraphContributors(data, logger);
  
    // Extract edition information
    extractStoryGraphEditionInfo(data, logger);
  
    // Extract description (may need to expand)
    await extractStoryGraphDescription(data, logger);
  
    logger.debug("Returning data object:", data);
    return data;
  }
  
  /**
   * Extracts series name and number from StoryGraph page
   */
  function extractSeriesInfo(data, logger) {
    const seriesElements = document.querySelectorAll('.book-title-author-and-series h3 a');
    
    if (seriesElements.length >= 2) {
      const seriesTitle = seriesElements[0]?.textContent.trim();
      const seriesPlaceMatch = seriesElements[1]?.textContent.match(/#(\d+)/);
  
      if (seriesTitle) {
        data.seriesName = seriesTitle;
        logger.debug("Extracted series name:", data.seriesName);
      }
  
      if (seriesPlaceMatch) {
        data.seriesNumber = seriesPlaceMatch[1];
        logger.debug("Extracted series number:", data.seriesNumber);
      }
    }
  }
  
  /**
   * Extracts contributors (authors, narrators, etc.) from StoryGraph page
   */
  function extractStoryGraphContributors(data, logger) {
    const contributors = [];
    const authors = [];
  
    const h3 = document.querySelector('.book-title-author-and-series h3');
    if (!h3) {
      logger.warn("No h3 element found for contributors");
      return;
    }
  
    const contributorParagraph = h3.querySelector('p:nth-of-type(2)');
    if (contributorParagraph) {
      contributorParagraph.querySelectorAll('a').forEach(a => {
        const name = a.textContent.trim();
        if (!name) return;
  
        // Check the next sibling for role (e.g. (Narrator))
        const nextText = a.nextSibling?.textContent?.trim();
        const roleMatch = nextText?.match(/\(([^)]+)\)/);
        const role = roleMatch ? roleMatch[1] : "Author";
  
        if (role === "Author") {
          if (!authors.includes(name)) {
            authors.push(name);
          }
        } else {
          // Check if contributor with this name already exists
          let existingContributor = contributors.find(c => c.name === name);
          if (existingContributor) {
            // Add role if not already present
            if (!existingContributor.role.includes(role)) {
              existingContributor.role = `${existingContributor.role}, ${role}`;
            }
          } else {
            contributors.push({ name, role });
          }
        }
      });
    }
  
    data.authors = dedupeObject(authors);
    data.contributors = dedupeObject(contributors);
    
    logger.debug("Extracted authors:", data.authors);
    logger.debug("Extracted contributors:", data.contributors);
  }
  
  /**
   * Extracts edition information from StoryGraph page
   */
  function extractStoryGraphEditionInfo(data, logger) {
    // Show the edition info section (it might be hidden)
    const editionInfo = document.querySelector('.edition-info');
    if (editionInfo) {
      editionInfo.style.display = 'block';
    }
  
    const editionEl = document.querySelector('.edition-info');
    if (!editionEl) {
      logger.warn("No edition info element found");
      return;
    }
  
    editionEl.querySelectorAll('p').forEach(p => {
      const label = p.querySelector('span.font-semibold')?.innerText.trim().replace(':', '');
      const value = p.childNodes[1]?.textContent.trim();
  
      if (!label || !value) return;
  
      switch (label) {
        case 'ISBN/UID':
          // Try to determine if it's ISBN-10 or ISBN-13 based on length
          const cleanedIsbn = value.replace(/[-\s]/g, '');
          if (cleanedIsbn.length === 13) {
            data.isbn13 = cleanedIsbn;
          } else if (cleanedIsbn.length === 10) {
            data.isbn10 = cleanedIsbn;
          }
          logger.debug("Extracted ISBN:", { isbn10: data.isbn10, isbn13: data.isbn13 });
          break;
  
        case 'Format':
          if (value.toLowerCase() === 'audio') {
            data.readingFormat = 'Audiobook';
          } else if (value.toLowerCase() === 'digital') {
            data.readingFormat = 'E-Book';
          } else {
            data.readingFormat = 'Physical Book';
            data.editionFormat = value;
          }
          logger.debug("Extracted format:", {
            readingFormat: data.readingFormat,
            editionFormat: data.editionFormat
          });
          break;
  
        case 'Language':
          data.releaseLanguage = value;
          logger.debug("Extracted language:", data.releaseLanguage);
          break;
  
        case 'Publisher':
          data.publisher = value;
          logger.debug("Extracted publisher:", data.publisher);
          break;
  
        case 'Edition Pub Date':
          data.releaseDate = value;
          logger.debug("Extracted publication date:", data.releaseDate);
          break;
      }
    });
  
    // Extract page count and audiobook duration
    const durationEl = document.querySelector('p.text-sm.font-light');
    if (durationEl) {
      const value = durationEl.innerText.trim();
      
      // Extract audiobook duration
      const timeMatch = value.match(/(\d+)\s*hours?\s*(?:,|and)?\s*(\d+)?\s*minutes?/i);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10) || 0;
        const minutes = parseInt(timeMatch[2], 10) || 0;
        
        data.audiobookDuration = [{
          hours: hours,
          minutes: minutes,
          seconds: 0
        }];
        logger.debug("Extracted audiobook duration:", data.audiobookDuration);
      }
  
      // Extract page count
      const pagesMatch = value.match(/(\d+)\s*pages?/i);
      if (pagesMatch) {
        data.pageCount = parseInt(pagesMatch[1], 10);
        logger.debug("Extracted page count:", data.pageCount);
      }
    }
  }
  
  /**
   * Extracts description from StoryGraph page, expanding "read more" if present
   */
  async function extractStoryGraphDescription(data, logger) {
    // Click "read more" button if present to expand full description
    const readMoreBtn = document.querySelector('.read-more-btn');
    if (readMoreBtn) {
      readMoreBtn.click();
      logger.debug('Clicked "read more" button');
      
      // Wait for description to expand
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  
    const descriptionEl = document.querySelector('.blurb-pane .trix-content');
    if (descriptionEl) {
      data.description = htmlToTextWithLineBreaks(descriptionEl);
      logger.debug("Extracted description length:", data.description.length);
    } else {
      logger.warn("No description element found");
    }
  }
  
  /**
   * Extracts the StoryGraph book ID from a StoryGraph book URL.
   *
   * @param {string} url - The StoryGraph book URL.
   * @returns {string|null} - The extracted book ID, or null if not found.
   */
  function getStoryGraphBookId(url) {
    const regex = /thestorygraph\.com\/books\/([^/?]+)/i;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

