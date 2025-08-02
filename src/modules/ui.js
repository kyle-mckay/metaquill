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

