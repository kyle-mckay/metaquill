# Hardcover Librarian Tampermonkey

>WARNING: Very Early Development

## Overview

This userscript is designed to extract detailed book metadata from supported websites like Goodreads. It collects information such as the book title, authors, contributors, ISBN, cover image, publisher, series information, and more. 

## Features

- Extracts book title, subtitle, and cover image  
- Gathers authors and contributors with their roles (e.g. Illustrator)  
- Parses ISBN10, ISBN13, and ASIN identifiers  
- Extracts publisher, edition format, release date, language, and page count  
- Parses series name and number, including decimal or fractional series numbers  
- Automatically clicks to expand hidden contributor lists if needed  
- Logs detailed debug information to help with troubleshooting 
- Retains a single extraction history within the same browser session, allowing you to work from different tabs
- Export the extracted details in JSON or click on extracted text to copy the specific field

### Known Behaviour Oddities

1. You may need to refresh the page once you are on a page that triggers the bubble for it to appear. It currently only shows up on a fresh load of the page and will not appear if you navigate to a supported page. That said, if you navigate _out_ of a supported page it will stay alive until you refresh.
2. After the first extraction, you may need to refresh the page for the bubble to render properly

### Currently Supported Extraction Sources

>Each source to have its own module

- goodreads
- amazon (.ca/.com/.uk/etc)
- google (.ca/.com/etc) / books

## Usage

Install this userscript with a userscript manager like Tampermonkey or Greasemonkey (Untested). Visit supported book pages on Goodreads, and the script will give you a button to gather the metadata.

## Screenshots

### Extracted Metadata

![Goodreads with no prior extraction data](/assets/images/goodreads-nodata.jpg)

![Goodreads with after extraction](/assets/images/goodreads-extracted.jpg)

### Hardcover

#### New Book (Autofill)

Text can be copied from the bubble to paste in the ISBN

![Hardcover new book autofill page](/assets/images/hardcover-preview.jpg)

### New Book (Manual)

![Hardcover new manual importable](/assets/images/hardcover-new-importable.jpg)

![Hardcover new manual imported](/assets/images/hardcover-new-imported.jpg)

### Debug Log Output

With `let currentLogLevel = LogLevel.DEBUG;`

![Console logs](/assets/images/console-log.jpg)

## Installation

### Tampermonkey

1. Open your browser and install the Tampermonkey extension (available for Chrome, Firefox, Edge, etc.).
2. After installing, click the Tampermonkey icon in your browser toolbar.
3. Select **"Create a new script..."** from the menu.
4. A code editor will open with some default template code.
5. Delete all the default code and **paste the entire userscript code** [link to code](https://raw.githubusercontent.com/kyle-mckay/hardcover-librarian-tampermonkey/main/hardcover.user.js) or open the `hardcover.user.js` file.
6. Save the script (usually by clicking the disk icon or pressing `Ctrl+S` / `Cmd+S`).
7. Visit a supported book page (e.g., Goodreads book page) or hardcover edit page and the script should trigger.
    - You may need to toggle the script on from a supported page first before it executes. Refresh the page to trigger the re-load.

No additional setup is required beyond this. Tampermonkey manages the script execution automatically based on the `@match` or `@include` rules in your script header.

## Development

Contributions and improvements are welcome.
