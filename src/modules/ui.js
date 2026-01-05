// ===== SECTION: User Interface Components =====
// ===== FILE PATH: src/modules/ui.js ==========

/**
 * UI component function to add a floating preview panel ("bubble") to the page.
 *
 * This panel displays stored book metadata in a JSON formatted view on the left,
 * and shows the book cover image with a clickable link and download option on the right.
 *
 * Key behaviors:
 * - Loads book data from persistent storage.
 * - Skips rendering if no valid data or panel already exists.
 * - Creates a fixed-position panel anchored to bottom-left of viewport.
 * - Includes a close button to remove the panel.
 * - Uses monospace font and styled containers for readability.
 * - Excludes the cover URL from JSON preview to reduce clutter.
 * - The cover image opens in a new tab when clicked.
 * - A download link below the cover triggers a save of the image.
 * - All style and DOM creation is done programmatically.
 * - Uses logging to track loading, error, and lifecycle events.
 */
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

/**
 * Creates the floating bubble UI container with header and content.
 * Returns references for bubble, content container, and header.
 * Styling is centralized here for easier future theme toggling.
 */
function createFloatingBubbleUI(logger, onToggle, initialMinimized = false) {
  // Load saved position
  const savedX = GM_getValue("bubbleX", null);
  const savedY = GM_getValue("bubbleY", null);

  const bubble = document.createElement("div");
  bubble.id = "floatingBubble";
  Object.assign(bubble.style, {
    position: "fixed",
    bottom: savedY !== null ? "auto" : "20px",
    right: savedX !== null ? "auto" : "20px",
    left: savedX !== null ? `${savedX}px` : "auto",
    top: savedY !== null ? `${savedY}px` : "auto",
    width: "600px", // expanded width
    background: "#fff",
    border: "1px solid #888",
    borderRadius: "10px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
    zIndex: 2147483647, // Maximum z-index value
    fontFamily: "sans-serif",
    fontSize: "14px",
    color: "#222",
    userSelect: "none",
    overflow: "hidden",
    transition: "height 0.3s ease, width 0.3s ease, visibility 0.3s ease",
    height: "auto", // start expanded
    cursor: "move", // indicate draggable
  });

  const header = document.createElement("div");
  header.style.cssText = `
    background: #0055aa;
    color: #fff;
    padding: 8px;
    cursor: default;
    font-weight: bold;
    user-select: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  header.textContent = "Book Metadata";

  const toggleIcon = document.createElement("span");
  toggleIcon.textContent = "▼";
  toggleIcon.style.transition = "transform 0.3s ease";
  toggleIcon.style.cursor = "pointer";
  header.appendChild(toggleIcon);

  const content = document.createElement("div");
  content.id = "floatingBubbleContent";
  Object.assign(content.style, {
    padding: "8px",
    display: "flex",
    flexDirection: "column",
    maxHeight: "350px",
    overflowY: "auto",
    visibility: "visible", // start visible
    height: "auto",
    transition: "height 0.3s ease, visibility 0.3s ease",
    cursor: "move",
  });

  const btnContainer = document.createElement("div");
  btnContainer.style.display = "flex";
  btnContainer.style.flexWrap = "nowrap";
  btnContainer.style.gap = "8px";
  btnContainer.style.marginBottom = "8px";

  // Set initial minimized state
  if (initialMinimized) {
    content.style.height = "0";
    content.style.visibility = "hidden";
    bubble.style.width = "200px";
    toggleIcon.style.transform = "rotate(180deg)";
  }

  // Drag functionality
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let bubbleStartX = 0;
  let bubbleStartY = 0;

  const startDrag = (e) => {
    // Don't drag when clicking header, toggle icon, or directly on interactive elements
    if (e.target === header || e.target === toggleIcon) return;

    // Don't drag if clicking directly on buttons, inputs, links, or other interactive elements
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'A') {
      return;
    }

    // Don't drag if clicking within the floatingBubbleFlexContainer (book display area)
    let element = e.target;
    while (element && element !== bubble) {
      if (element.classList && element.classList.contains('floatingBubbleFlexContainer')) {
        return; // Don't start drag
      }
      element = element.parentElement;
    }

    // Allow dragging from bubble background, padding, or non-interactive content areas
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = bubble.getBoundingClientRect();
    bubbleStartX = rect.left;
    bubbleStartY = rect.top;
    bubble.style.transition = "none"; // Disable transition during drag
    bubble.style.cursor = "grabbing";
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", endDrag);
    e.preventDefault();
  };

  const drag = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    const newX = Math.max(0, Math.min(window.innerWidth - bubble.offsetWidth, bubbleStartX + deltaX));
    const newY = Math.max(0, Math.min(window.innerHeight - bubble.offsetHeight, bubbleStartY + deltaY));
    bubble.style.left = `${newX}px`;
    bubble.style.top = `${newY}px`;
    bubble.style.right = "auto";
    bubble.style.bottom = "auto";
  };

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    bubble.style.transition = "height 0.3s ease, width 0.3s ease, visibility 0.3s ease"; // Re-enable transition
    const rect = bubble.getBoundingClientRect();
    GM_setValue("bubbleX", rect.left);
    GM_setValue("bubbleY", rect.top);
    document.removeEventListener("mousemove", drag);
    document.removeEventListener("mouseup", endDrag);
  };

  bubble.addEventListener("mousedown", startDrag);

  // Function to ensure bubble stays within viewport
  const ensureInViewport = () => {
    const rect = bubble.getBoundingClientRect();
    let newX = rect.left;
    let newY = rect.top;
    let needsReposition = false;

    // Check if bubble is outside viewport bounds
    if (rect.right > window.innerWidth) {
      newX = window.innerWidth - bubble.offsetWidth;
      needsReposition = true;
    }
    if (rect.left < 0) {
      newX = 0;
      needsReposition = true;
    }
    if (rect.bottom > window.innerHeight) {
      newY = window.innerHeight - bubble.offsetHeight;
      needsReposition = true;
    }
    if (rect.top < 0) {
      newY = 0;
      needsReposition = true;
    }

    if (needsReposition) {
      bubble.style.left = `${newX}px`;
      bubble.style.top = `${newY}px`;
      bubble.style.right = "auto";
      bubble.style.bottom = "auto";
      GM_setValue("bubbleX", newX);
      GM_setValue("bubbleY", newY);
      logger.debug("Bubble repositioned to stay in viewport");
    }
  };

  // Ensure bubble is in viewport on creation
  setTimeout(ensureInViewport, 100); // Small delay to ensure DOM is ready

  // Check viewport bounds on window resize
  window.addEventListener("resize", ensureInViewport);

  header.onclick = () => {
    if (content.style.visibility === "hidden") {
      // Expand
      content.style.visibility = "visible";
      content.style.height = "auto";
      bubble.style.width = "600px"; // expanded width
      toggleIcon.style.transform = "rotate(0deg)"; // arrow up
      logger.debug("Bubble expanded");
    } else {
      // Collapse
      content.style.height = "0";
      content.style.visibility = "hidden";
      bubble.style.width = "200px"; // collapsed width
      toggleIcon.style.transform = "rotate(180deg)"; // arrow down
      logger.debug("Bubble collapsed");

      // Reset to bottom-right position when minimized
      setTimeout(() => {
        bubble.style.left = "auto";
        bubble.style.top = "auto";
        bubble.style.right = "20px";
        bubble.style.bottom = "20px";
        GM_setValue("bubbleX", null); // Clear saved position
        GM_setValue("bubbleY", null);
      }, 310); // Wait for transition to complete
    }
    const isMinimized = content.style.visibility === "hidden";
    if (onToggle) onToggle(isMinimized);
  };

  bubble.appendChild(header);
  bubble.appendChild(content);
  document.body.appendChild(bubble);

  return { bubble, content, header };
}

/**
 * Creates a message element used to display temporary messages in the UI.
 * The message element is styled for visibility and fade transitions.
 */
function createFloatingMessage() {
  const msg = document.createElement("div");
  msg.id = "floatingBubbleMessage";
  Object.assign(msg.style, {
    marginBottom: "8px",
    color: "#007700",
    fontWeight: "bold",
    minHeight: "21px",
    transition: "opacity 0.3s ease",
    opacity: "0",
    userSelect: "none",
  });
  return msg;
}

/**
 * Shows a temporary message inside the provided element for a duration.
 * Fades out message smoothly and clears text after timeout.
 * @param {HTMLElement} el Element to display message in
 * @param {string} msg Message text to show
 * @param {number} duration Duration in ms to show message
 */
function showMessage(el, msg, duration = 3000) {
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout(showMessage.timeoutId);
  showMessage.timeoutId = setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => {
      el.textContent = "";
    }, 300);
  }, duration);
}

/**
 * Creates the detailed book metadata display area inside the bubble.
 * Shows key-value pairs on left and cover image + download on right.
 * Click on a value copies it to clipboard with logging and message.
 * @param {object} data Book metadata object to display
 * @param {function} showMessageFn Function to display messages
 * @returns {HTMLElement} Container div holding the entire display
 */
function createBookDisplay(data, showMessageFn) {
  const logger = createLogger("createBookDisplay");
  const container = document.createElement("div");
  container.className = "floatingBubbleFlexContainer";
  Object.assign(container.style, {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    maxHeight: "250px",
    overflow: "hidden",
    cursor: "default",
  });

  const prettify = (str) =>
    str
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase())
      .trim();

  // Left pane with formatted text
  const left = document.createElement("div");
  Object.assign(left.style, {
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

  Object.entries(data).forEach(([key, value]) => {
    const isValidKey = Object.prototype.hasOwnProperty.call(bookSchema, key);

    if (!isValidKey) {
      logger.warn(
        `Key "${key}" not found in bookSchema. Available keys: ${Object.keys(
          bookSchema
        ).join(", ")}`
      );
    }

    // Explicitly skip null, undefined, empty string, or empty array
    if (
      value == null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return;
    }

    if (key === "audiobookDuration" && Array.isArray(value) && value.length) {
      const dur = value[0];
      const parts = [];
      if (dur.hours)
        parts.push(`${dur.hours} hour${dur.hours !== 1 ? "s" : ""}`);
      if (dur.minutes)
        parts.push(`${dur.minutes} minute${dur.minutes !== 1 ? "s" : ""}`);
      if (dur.seconds)
        parts.push(`${dur.seconds} second${dur.seconds !== 1 ? "s" : ""}`);
      value = parts.join(", ");
    } else if (Array.isArray(value)) {
      value =
        key === "contributors"
          ? value.map((c) => `${c.name} (${c.role})`).join(", ")
          : value.join(", ");
    }

    // Limit description to 100 characters
    if (
      key === "description" &&
      typeof value === "string" &&
      value.length > 100
    ) {
      value = value.substring(0, 100) + "... (full description redacted due to length)";
    }

    const div = document.createElement("div");
    div.style.marginBottom = "4px";

    const label = document.createElement("span");
    label.textContent = `${prettify(key)}: `;
    label.style.fontWeight = "bold";

    const val = document.createElement("span");
    val.textContent = value;
    val.style.cursor = "pointer";
    val.style.color = "#0055aa";
    val.style.textDecoration = "underline";
    val.title = "Click to copy";
    val.onclick = () => {
      navigator.clipboard.writeText(value).then(() => {
        logger.info(`Copied "${key}" to clipboard.`);
        showMessageFn(`Copied ${prettify(key)} to clipboard`);
      });
    };

    div.appendChild(label);
    div.appendChild(val);
    left.appendChild(div);
  });

  container.appendChild(left);

  // Right pane with cover image + download link
  if (data.cover) {
    const right = document.createElement("div");
    right.id = "imgContainer";
    Object.assign(right.style, {
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
    Object.assign(img.style, {
      width: "100%", // full width of container (150px)
      maxHeight: "200px", // limit height so it doesn't get too tall
      height: "auto", // keep aspect ratio
      borderRadius: "6px",
      cursor: "pointer",
      userSelect: "none",
      objectFit: "contain", // prevent cropping, keep image contained
    });

    link.appendChild(img);
    right.appendChild(link);

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
        alert(
          "Failed to download image. This may be due to CORS restrictions if the script is not running from the same website as the image. You may need to save the image manually by right-clicking and selecting 'Save image as...'"
        );
        logger.error("Image download failed:", err);
      }
    };

    right.appendChild(downloadLink);
    container.appendChild(right);
  }

  return container;
}

/**
 * Creates a styled button element.
 * @param {string} label Button text label
 * @param {function} onClick Click event handler
 * @param {object} styles Optional CSS styles as an object
 * @returns {HTMLButtonElement}
 */
function createButton(label, onClick, styles = {}) {
  const btn = document.createElement("button");
  btn.textContent = label;
  Object.assign(btn.style, {
    padding: "6px 10px",
    fontSize: "14px",
    borderRadius: "4px",
    border: "1px solid #0077cc",
    backgroundColor: "#0077cc",
    color: "#fff",
    cursor: "pointer",
    userSelect: "none",
    transition: "background-color 0.3s ease",
    ...styles,
  });

  btn.onmouseenter = () => {
    btn.style.backgroundColor = "#005fa3";
  };
  btn.onmouseleave = () => {
    btn.style.backgroundColor = "#0077cc";
  };
  btn.onclick = onClick;

  if (styles.disabled) {
    btn.disabled = true;
    btn.style.opacity = "0.6";
    btn.style.cursor = "not-allowed";
  }

  return btn;
}

// Export UI component functions for external usage
const UIComponents = {
  addPreviewPanel,
  createFloatingBubbleUI,
  createFloatingMessage,
  showMessage,
  createBookDisplay,
  createButton,
};

