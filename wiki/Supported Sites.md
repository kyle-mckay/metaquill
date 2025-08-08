# Supported Sites

The following is a full list of sites that this script supports.

## Bubble Visibiliy

The UI bubble will display when the following pages are loaded or refreshed as per the `@match` and `@include` lines of the userscript `headers.js` file. An entry in the headers file is required for the import/export buttons to be usable, and the UI **should** be visible.

| Match Type | URL | Has Export Button? | Has Import Button? |
| --- | --- | --- | --- |
| `@match` | `goodreads.com/*` | Yes | No |
| `@match` | `hardcover.app/*` | No | Yes |
| `@match` | `audible.ca/*` | No | No |
| `@match` | `app.thestorygraph.com/books/*` | Yes | No |
| `@include` | `amazon.*/dp/*` | Yes | No |
| `@include` | `amazon.*/*/dp/*` | Yes | No |
| `@include` | `google.*/books/*` | Yes | No |
| `@include` | `books.google.*/*` | Yes | No |
