// ===== SECTION: Main =====
// ===== FILE PATH: src/core/main.js ==========

(function () {
  "use strict";

  // Create logger for this module
  const logger = createLogger("floatingBubble");

  // Store last URL to detect navigation changes
  let lastUrl = location.href;

  /**
   * Checks if the current page is a Hardcover import or edit page.
   * Uses a regex to match relevant URL patterns.
   * @returns {boolean} True if current page is a hardcover.app import/edit page.
   */
  function isHardcoverImportPage() {
    const url = location.href;
    const regex =
      /^https:\/\/hardcover\.app\/books\/([^/]+\/)?(editions\/[^/]+\/)?edit$|^https:\/\/hardcover\.app\/books\/new_manual$/;
    return regex.test(url);
  }

  /**
   * Initializes the floating bubble UI.
   * Sets up buttons and event handlers based on the current site context
   * and stored book data.
   */
  async function initFloatingBubble() {
    logger.info("Initializing floating bubble");

    // Get normalized host for site module detection
    const rawHost = location.hostname.toLowerCase();
    logger.debug(`rawHost: '${rawHost}'`);
    const host = rawHost.replace(/^www\./, "");

    // Normalize Amazon host to a generic key
    const normalizedHost = host.includes("amazon.") ? "amazon" : host;
    logger.debug(`normalizedHost: '${normalizedHost}'`);

    const module = siteModules[normalizedHost];
    const isImportPage = isHardcoverImportPage();

    let savedData = loadBookData();
    let hasSavedData = savedData && Object.keys(savedData).length > 0;
    logger.debug("Saved book data found:", hasSavedData);

    // Create floating bubble UI using UI module
    const { bubble, content } = UIComponents.createFloatingBubbleUI(logger);

    // Message container for displaying temporary feedback to user
    let messageEl = content.querySelector("#floatingBubbleMessage");
    if (!messageEl) {
      messageEl = UIComponents.createFloatingMessage();
      content.insertBefore(messageEl, content.firstChild);
    }

    /**
     * Displays a temporary message in the bubble for a set duration.
     * @param {string} msg - Message text to display.
     * @param {number} duration - Duration in ms before fading out.
     */
    function showTemporaryMessage(msg, duration = 3000) {
      UIComponents.showMessage(messageEl, msg, duration);
    }

    // Container for buttons in the bubble UI
    const btnContainer = document.createElement("div");
    btnContainer.style.marginBottom = "8px";

    // If site module exists and detects page type, add extract button
    if (module && module.detect()) {
      logger.debug("Extraction module detected for host:", host);

      const extractBtn = UIComponents.createButton(
        "📚 Extract Book Data",
        async () => {
          logger.info("Extract button clicked");
          const data = await module.extract();
          logger.debug("Extracted data:", data);
          saveBookData(data);
          updateContent(data);
          showTemporaryMessage("Book data extracted and saved.");
          copyJsonBtn.disabled = false; // enable copy button
        },
        { marginRight: "8px" }
      );

      btnContainer.appendChild(extractBtn);
    }

    // If on Hardcover import page, add import button
    if (isImportPage) {
      logger.debug("Hardcover import page detected");

      const importBtn = UIComponents.createButton(
        "⬇️ Import Book Data",
        () => {
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
        },
        { marginRight: "8px" }
      );

      btnContainer.appendChild(importBtn);
    }

    // Button to copy JSON data to clipboard
    const copyJsonBtn = UIComponents.createButton(
      "📋 Copy JSON",
      () => {
        try {
          const jsonStr = JSON.stringify(loadBookData(), null, 2);
          navigator.clipboard.writeText(jsonStr).then(() => {
            showTemporaryMessage("Book JSON copied to clipboard.");
          });
        } catch (e) {
          showTemporaryMessage("Failed to copy JSON.");
          logger.error("Copy JSON failed:", e);
        }
      },
      {
        marginRight: "8px",
        disabled: !hasSavedData,
      }
    );

    btnContainer.appendChild(copyJsonBtn);

    // Button to refresh displayed book data in bubble
    const refreshBtn = UIComponents.createButton("🔄 Refresh", () => {
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
    });

    btnContainer.appendChild(refreshBtn);

    content.appendChild(btnContainer);

    // Show saved book data in bubble on page load, if present
    if (hasSavedData) {
      updateContent(savedData);
      content.style.display = "block";
      bubble.style.height = "auto";
      logger.info("Displaying saved book data in bubble on load");
    }

    // Observe DOM mutations to detect URL changes for SPA navigation
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

    /**
     * Updates the bubble's content area with formatted book metadata preview.
     * Displays text fields and cover image with click-to-copy functionality.
     * @param {object} data - The book metadata to display.
     */
    function updateContent(data) {
      logger.debug("Updating bubble content preview");

      // Remove any existing content container to replace
      const oldFlexContainer = content.querySelector(
        ".floatingBubbleFlexContainer"
      );
      if (oldFlexContainer) oldFlexContainer.remove();

      // Use UI module to create book display container
      const display = UIComponents.createBookDisplay(
        data,
        logger,
        showTemporaryMessage
      );
      display.className = "floatingBubbleFlexContainer";

      content.appendChild(display);
    }
  }

  /**
   * Checks for URL changes on single-page apps by polling.
   * If URL changes, removes existing bubble and reinitializes UI.
   */
  async function checkUrlChange() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      logger.info("URL changed, reinitializing floating bubble.");
      // Remove existing bubble if present
      const existingBubble = document.getElementById("floatingBubble");
      if (existingBubble) existingBubble.remove();
      // Re-initialize bubble UI
      await initFloatingBubble();
    }
  }

  // Run floating bubble initialization immediately on script load
  initFloatingBubble();

  // Poll for URL changes every 2000ms (adjust interval as needed)
  const bubbleRefresh = 2000;
  setInterval(checkUrlChange, bubbleRefresh);
})();

