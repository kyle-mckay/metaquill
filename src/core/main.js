// ===== SECTION: Main =====
// ===== FILE PATH: src/core/main.js ==========

(function () {
  "use strict";

  // Create logger for this module
  const logger = createLogger("floatingBubble");

  // Store last URL to detect navigation changes
  let lastUrl = location.href;

  /**
   * Creates a floating bubble container in the bottom-right corner
   * with a clickable header that toggles content visibility.
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

    // Create header bar with toggle functionality and icon
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
    toggleIcon.textContent = "▼"; // down arrow for collapsed state
    toggleIcon.style.transition = "transform 0.3s ease";
    header.appendChild(toggleIcon);

    bubble.appendChild(header);

    // Create content container, hidden by default (collapsed)
    const content = document.createElement("div");
    content.id = "floatingBubbleContent";
    Object.assign(content.style, {
      padding: "8px",
      display: "none", // collapsed initially
      maxHeight: "350px",
      overflowY: "auto",
      display: "flex",
      gap: "12px",
      flexWrap: "nowrap",
      alignItems: "flex-start",
    });

    bubble.appendChild(content);

    // Toggle content visibility on header click with logging
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

    const { bubble, content } = createFloatingBubble();

    // Message container for displaying temporary feedback to user
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

    /**
     * Displays a temporary message in the bubble for a set duration.
     * @param {string} msg - Message text to display.
     * @param {number} duration - Duration in ms before fading out.
     */
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

    // Container for buttons in the bubble UI
    const btnContainer = document.createElement("div");
    btnContainer.style.marginBottom = "8px";

    // If site module exists and detects page type, add extract button
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

    // If on Hardcover import page, add import button
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

    // Button to copy JSON data to clipboard
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

    // Button to refresh displayed book data in bubble
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

      // Create flex container to hold text and image side by side
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

      // Helper to prettify camelCase field names for display
      const prettify = (str) =>
        str
          .replace(/([A-Z])/g, " $1") // split camelCase
          .replace(/^./, (c) => c.toUpperCase()) // capitalize first letter
          .trim();

      // Populate text container with key-value pairs from data
      Object.entries(data).forEach(([key, value]) => {
        if (!value) return; // skip empty or falsy values

        // Special formatting for audiobookDuration array
        if (
          key === "audiobookDuration" &&
          Array.isArray(value) &&
          value.length > 0
        ) {
          const dur = value[0]; // assume first duration object
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
          // Format arrays to comma-separated strings
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

        // Copy field value to clipboard on click with logging
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

      // Right pane: cover image and download link if cover URL exists
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

        // Download cover image on click with error handling and logging
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

