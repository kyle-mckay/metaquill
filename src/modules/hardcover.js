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