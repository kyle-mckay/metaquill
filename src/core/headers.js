// ==UserScript==
// @name         Hardcover Librarian Tampermonkey
// @namespace    https://github.com/kyle-mckay/hardcover-librarian-tampermonkey
// @updateURL    https://raw.githubusercontent.com/kyle-mckay/hardcover-librarian-tampermonkey/main/hardcover.user.js
// @downloadURL  https://raw.githubusercontent.com/kyle-mckay/hardcover-librarian-tampermonkey/main/hardcover.user.js
// @author       kyle-mckay
// @version      v1.3.0
// @description  Extract book metadata from supported sites like Goodreads and optionally inject into sites like Hardcovers.app for easier book creation.
// @match        https://www.goodreads.com/*
// @match        https://hardcover.app/*
// @match        https://audible.ca/*
// @include /^https:\/\/(www\.)?amazon\.[a-z.]+\/dp\/[A-Z0-9]{10}(?:[/?].*)?$/
// @include /^https:\/\/(www\.)?amazon\.[a-z.]+\/[^\/]+\/dp\/[A-Z0-9]{10}(?:[/?].*)?$/
// @icon         https://assets.hardcover.app/static/favicon.ico
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @license      MIT
// ==/UserScript==

