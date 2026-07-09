// ==UserScript==
// @name         MetaQuill
// @namespace    https://codeberg.org/kylemmkay/metaquill
// @updateURL    https://codeberg.org/kylemmkay/metaquill/raw/main/metaquill.user.js
// @downloadURL  https://codeberg.org/kylemmkay/metaquill/raw/main/metaquill.user.js
// @author       kylemmkay
// @version      1.8.2
// @description  Extract book metadata from supported sites like Goodreads and optionally inject into sites like Hardcovers.app for easier book creation.
// @match        https://www.goodreads.com/*
// @match        https://hardcover.app/*
// @match        https://app.thestorygraph.com/books/*
// @include /^https:\/\/(www\.)?audible\.[a-z.]+\/.*$/
// @include /^https:\/\/(www\.)?amazon\.[a-z.]+\/dp\/[A-Z0-9]{10}(?:[/?].*)?$/
// @include /^https:\/\/(www\.)?amazon\.[a-z.]+\/[^\/]+\/dp\/[A-Z0-9]{10}(?:[/?].*)?$/
// @include /^https:\/\/(www\.)?google\.[a-z.]+\/books(?:[/?].*)?$/
// @include /^https:\/\/(?:www\.)?books\.google\.[a-z.]+(?:[/?].*)?$/
// @icon         https://codeberg.org/kylemmkay/metaquill/raw/branch/main/assets/icons/icon-128.png
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @license      MIT
// ==/UserScript==
// WARNING: When building from source, do not make changes directly to `metaquill.users.js`
// Instead, modify the files inside the `src` directory then from root, run `build/build.sh`

const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

let currentLogLevel = LogLevel.INFO; // Change this to control global verbosity
let bubbleRefresh = 2000; // The number of miliseconds the bubble refreshes the URL. Allows buttons to show/hide dynamically during normal navigation.

