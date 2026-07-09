// ===== SECTION: Hardcover Functionality =====
// ===== FILE PATH: src/modules/hardcover.js ==========

/**
 * Checks if the current page is a hardcover.app import/edit page
 * by matching the URL against known patterns for manual/new edit pages.
 * Logs the URL and the result of the test.
 * @returns {boolean} True if on hardcover.app book import or edit page.
 */
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

/**
 * Helper: Set value of input element by id and trigger input/change events.
 * @param {string} id - The id of the input element.
 * @param {string} value - The value to set.
 */
function setInputId(id, value) {
  const logger = createLogger("setInputId");
  logger.debug(`Setting input Id for field '${id}' to: `, value);

  const el = document.getElementById(id);
  if (!el || typeof value !== "string") {
    logger.debug(`Skipped '${id}' - element not found or value not a string.`);
    return;
  }

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;

  nativeInputValueSetter?.call(el, value);

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));

  logger.debug(`Set input '${id}' to:`, value);
}

/**
 * Helper: Set value of input or textarea element by label text and trigger input/change events.
 * @param {string} labelText - The exact text content of the label.
 * @param {string|number} value - The value to set.
 */
function setInputLabel(labelText, value) {
  const logger = createLogger("setInputLabel");
  logger.debug(`Setting input for '${labelText}' to:`, value);

  if (typeof value !== "string" && typeof value !== "number") {
    logger.debug(`Skipped '${labelText}' - value not a string or number`);
    return;
  }
  const stringValue = String(value);

  const labels = Array.from(document.querySelectorAll("label"));
  const label = labels.find((l) => l.textContent.trim() === labelText);

  if (!label) {
    logger.debug(`Label '${labelText}' not found`);
    return;
  }

  const container = label.closest("div.border-t");

  if (!container) {
    logger.debug(`Container for label '${labelText}' not found`);
    return;
  }

  const input = container.querySelector("input, textarea");

  if (!input) {
    logger.debug(`Input or textarea for label '${labelText}' not found`);
    return;
  }

  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    "value"
  )?.set;

  setter?.call(input, stringValue);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  logger.debug(`Set input for '${labelText}' to:`, stringValue);
}

/**
 * Converts a loosely-formatted date string (e.g. "May 4, 2021" or an ISO
 * timestamp) "YYYY-MM-DD" format. Already-ISO strings are sliced directly.
 *
 * @param {string} value - The date string to normalize.
 * @returns {string} - The normalized "YYYY-MM-DD" date, or "" if unparseable.
 */
function toIsoDateString(value) {
  if (!value) return "";

  const isoMatch = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Helper: Select an option in a Headless UI combobox/listbox by label text.
 * Opens the combobox's button, waits for its options to render, then clicks
 * the option whose text best matches the given value.
 *
 * @param {string} labelText - The exact text content of the label.
 * @param {string} valueText - The option text to select.
 */
async function setComboboxByLabel(labelText, valueText) {
  const logger = createLogger("setComboboxByLabel");

  if (!valueText) {
    logger.debug(`Skipped '${labelText}' - no value provided`);
    return;
  }

  const labels = Array.from(document.querySelectorAll("label"));
  const label = labels.find((l) => l.textContent.trim() === labelText);

  if (!label) {
    logger.debug(`Label '${labelText}' not found`);
    return;
  }

  const container = label.closest("div.border-t");
  const button = container?.querySelector('button[aria-haspopup="listbox"]');

  if (!button) {
    logger.debug(`Combobox button for '${labelText}' not found`);
    return;
  }

  ["pointerdown", "mousedown", "mouseup", "click"].forEach((type) => {
    button.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
  });
  await new Promise((resolve) => setTimeout(resolve, 100));

  const panelId = button.getAttribute("aria-controls");
  const panel = panelId ? document.getElementById(panelId) : null;

  if (!panel) {
    logger.warn(`Combobox panel for '${labelText}' did not open`);
    return;
  }

  // Type into the panel's search input (if present) to filter the options,
  // the same way a real user would narrow the list before picking a result.
  const searchInput = panel.querySelector('input[type="text"]');
  if (searchInput) {
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(searchInput),
      "value"
    )?.set;
    setter?.call(searchInput, valueText);
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const options = Array.from(panel.querySelectorAll('[role="option"]'));
  const target = valueText.trim().toLowerCase();
  const match =
    options.find((o) => o.textContent.trim().toLowerCase() === target) ||
    options.find((o) => o.textContent.trim().toLowerCase().includes(target));

  if (match) {
    ["pointerdown", "mousedown", "mouseup", "click"].forEach((type) => {
      match.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
    });
    logger.debug(`Set '${labelText}' to option: ${match.textContent.trim()}`);
  } else {
    logger.warn(`No matching option found for '${labelText}' = "${valueText}"`);
    button.click(); // close the dropdown again since nothing was selected
  }
}

/**
 * Imports extracted book metadata into hardcover.app's book form fields.
 * Uses element IDs and label text to locate input fields.
 * Updates input values and dispatches 'input' and 'change' events
 * to trigger framework reactivity and UI updates.
 * Logs detailed debug information for each field set operation.
 *
 * @param {object} data - Book metadata object to import.
 */
async function importBookDataToHardcover(data) {
  const logger = createLogger("importBookDataToHardcover");
  logger.debug("Called with data:", data);

  if (!data) {
    logger.warn("No data provided, exiting early.");
    return;
  }

  // Populate hardcover.app form fields from extracted data
  setInputId("field-title", data.title || "");
  setInputId("field-subtitle", data.subtitle || "");
  setInputId("field-isbn-10", data.isbn10 || "");
  setInputId("field-isbn-13", data.isbn13 || "");
  setInputId("field-asin", data.asin || "");
  setInputId("field-edition-format", data.editionFormat || "");

  setInputLabel("Description", data.description || "");
  setInputLabel("Release Date", toIsoDateString(data.releaseDate));

  await setComboboxByLabel("Primary Language", data.releaseLanguage);

  // Reading Format must be set before Page Count/Duration - Hardcover resets
  // those fields when the format changes.
  await setComboboxByLabel("Reading Format", data.readingFormat);

  setInputLabel("Page Count", data.pageCount);

  const duration = data.audiobookDuration?.[0];
  if (duration) {
    const totalSeconds =
      (duration.hours || 0) * 3600 + (duration.minutes || 0) * 60 + (duration.seconds || 0);
    setInputId("field-audio-length-total-seconds", String(totalSeconds));
  }

  logger.info("Finished populating form fields.");
}

