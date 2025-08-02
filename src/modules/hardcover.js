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
 * Imports extracted book metadata into hardcover.app's book form fields.
 * Uses element IDs and label text to locate input fields.
 * Updates input values and dispatches 'input' and 'change' events
 * to trigger framework reactivity and UI updates.
 * Logs detailed debug information for each field set operation.
 *
 * @param {object} data - Book metadata object to import.
 */
function importBookDataToHardcover(data) {
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
  setInputLabel("Page Count", data.pageCount);

  logger.info("Finished populating form fields.");
}

