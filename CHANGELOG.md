# Changelog

## 1.9.0 - 2026-07-09

### Enhancements
- enhance: implement UI changes from #14 (@kylemmkay)
- feat: add audible.tld support via api (@kylemmkay)

### Fixes
- Fix Hardcover edition import: audiobook duration, language, release date, and reading format fields
- fix: using codeberg author instead of github (@kylemmkay)

### Maintenance
- Prep repository for Codeberg migration and update links/branding
- chore: add source badge (@kylemmkay)
- chore: update link after codeberg migration (@kylemmkay)
- Build: Update metaquill.user.js on push to main (@kylemmkay)
- chore: prep for codeberg (@kylemmkay)
- Build: Update metaquill.user.js on push to main (@kylemmkay)

## 1.8.2 - 2026-07-09

### Fixes
- fix: hardcover reading format field (@kylemmkay)

## 1.8.1 - 2026-07-09

### Fixes
- fix: hardcover edition seconds, language and date inputs (@kylemmkay)
  
## 1.8.0 - 2026-07-09

### Enhancements
- Add Audible support for any storefront TLD via the Audible catalog API

## 1.7.0 - 2026-01-05

### Enhancements
- Add floating bubble relocation and position memory

### Maintenance
- Retain minimized state and adjust refresh/UI behavior

## 1.6.0 - 2025-08-11

### Enhancements
- Support Google Books API as the primary collection method, with fallback to legacy scraping
- Deduplicate and improve Amazon/Google Books description parsing and reading-format detection

### Fixes
- Work around Google Books CORS restrictions on download

### Maintenance
- Add icons and update documentation/workflows

## 1.5.0 - 2025-08-06

### Enhancements
- Add StoryGraph support

### Maintenance
- Rename repository and update branding/links
- Add wiki sync workflow and expand documentation

## 1.4.1 - 2025-08-04

### Enhancements
- Add Google Books support and resolve higher-resolution cover images
- Get source ID from additional sources and allow tall cover images

### Maintenance
- Allow build to work with custom log levels for testing

## 1.4.0 - 2025-08-04

### Enhancements
- Add support for the new Google Books layout

### Fixes
- Fix release action writing a blank release file when updating a draft

### Maintenance
- Change public releases to use INFO log level

## 1.3.0 - 2025-08-02

### Enhancements
- Overhaul UI and Amazon parsing logic
- Split Amazon parsing into modular functions

### Maintenance
- Revise build logic and allow release drafter to run first
- Move version tagging into the build script

## 1.2.1 - 2025-08-01

### Maintenance
- Split source script into separate files for maintainability
- Add additional comments and reorganize assets

## 1.2.0 - 2025-08-01

### Enhancements
- Add Amazon book page parsing

### Maintenance
- Update release-drafter workflow

## 1.1.0 - 2025-07-31

### Maintenance
- Initial release of MetaQuill (userscript scaffold, license, README)

