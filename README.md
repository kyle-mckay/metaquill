# MetaQuill

> **Warning:** Very Early Development

A book metadata extractor.

<img src="https://raw.githubusercontent.com/kyle-mckay/metaquill/refs/heads/main/assets/images/icon-128.ico" height="128" alt="MetaQuill Logo" />

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

- goodreads.com
- amazon (.ca/.com/.uk/etc)
- google (.ca/.com/etc) / books
- app.thestorygraph.com

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

For full installation
- [Tampermonkey](https://github.com/kyle-mckay/metaquill/wiki/Tampermonkey-Installation)

## Development

Contributions and improvements are welcome.
