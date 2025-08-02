# Source Directory (`src/`)

This directory contains the modular source files for the Hardcover UserScript. Files are separated by purpose to improve maintainability, clarity, and testing.

## Structure

- **`core/`** contain logic and entry points like `main.js`, `headers.js`, and primary modules.
- **`extractors/`** contains domain-specific scrapers for supported book metadata sources such as Amazon and Goodreads. Each extractor is scoped to a single domain and implements a standard interface.
- **`modules/`** contain reserved for utility functions and common helpers used across multiple modules.

## Philosophy

Keeping source files modular and scoped to specific responsibilities allows for:

- Easier unit testing and debugging
- Cleaner diffs and version control history
- Simplified onboarding for contributors
- More reliable builds through `build_files.list`

All files in this directory are concatenated in order by `build/build.sh` using the list defined in `build/build_files.list`.
