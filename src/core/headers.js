// ==UserScript==
// @name         MetaQuill
// @namespace    https://github.com/kyle-mckay/metaquill
// @updateURL    https://raw.githubusercontent.com/kyle-mckay/metaquill/main/metaquill.user.js
// @downloadURL  https://raw.githubusercontent.com/kyle-mckay/metaquill/main/metaquill.user.js
// @author       kyle-mckay
// @version      1.6.1
// @description  Extract book metadata from supported sites like Goodreads and optionally inject into sites like Hardcovers.app for easier book creation.
// @match        https://www.goodreads.com/*
// @match        https://hardcover.app/*
// @match        https://audible.ca/*
// @match        https://app.thestorygraph.com/books/*
// @include /^https:\/\/(www\.)?amazon\.[a-z.]+\/dp\/[A-Z0-9]{10}(?:[/?].*)?$/
// @include /^https:\/\/(www\.)?amazon\.[a-z.]+\/[^\/]+\/dp\/[A-Z0-9]{10}(?:[/?].*)?$/
// @include /^https:\/\/(www\.)?google\.[a-z.]+\/books(?:[/?].*)?$/
// @include /^https:\/\/(?:www\.)?books\.google\.[a-z.]+(?:[/?].*)?$/
// @icon         https://raw.githubusercontent.com/kyle-mckay/metaquill/refs/heads/main/assets/icons/icon.svg
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @license      MIT
// ==/UserScript==

const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

let currentLogLevel = LogLevel.INFO; // Change this to control global verbosity
let bubbleRefresh = 2000; // The number of miliseconds the bubble refreshes the URL. Allows buttons to show/hide dynamically during normal navigation.

