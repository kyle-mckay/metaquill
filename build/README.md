# Build Directory

This directory contains scripts and configuration files for managing the build and verification process of the Hardcover UserScript.

## Files

### `build.sh`

- Concatenates source files listed in `build_files.list` into `metaquill.user.js` at the repository root.
- Intended to be run manually or automatically via CI (e.g., GitHub Actions).

### `verify.sh`

- Checks that all files listed in `build_files.list` exist.
- Ensures each file ends with exactly two newline characters.
- Compares against the actual files in the `src/` directory to detect any unlisted modules.
  - Any unlisted modules in `build_files.list` are appended above `main.js`
- Outputs `true` if all expected files are present and accounted for, otherwise `false`.

### `build_files.list`

- A plain text file listing all source modules (one per line) to be included in the final build.
- File paths must be relative to the repository root, typically under `src/`, e.g.:

```
src/core/headers.js
src/modules/utilities.js
src/modules/ui.js
src/extractors/amazon.js
src/extractors/goodreads.js
src/modules/hardcover.js
src/core/main.js
```

- The order of entries matters; they are concatenated in **sequence**.
- If you add a new file to `src/`, update this list to include it in the build.

## Usage

From the root of the repository:

```bash
bash ./build/verify.sh     # Check if build_files.list is accurate
bash ./build/build.sh      # Build metaquill.user.js from listed modules
````

## CI Integration

These scripts are used by GitHub Actions on every push to the `main` branch.
If `verify.sh` fails (i.e., missing or unlisted files), an automated PR will be created to update `build_files.list` if possible.
