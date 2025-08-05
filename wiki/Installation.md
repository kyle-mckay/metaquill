# Installation

## Tampermonkey

Install Tampermonkey from your browsers extension store (available for Chrome, Firefox, Edge, etc.). [Their Homepage](https://www.tampermonkey.net/index.php)

### Automatic Installation

With tampermonkey installed, you should be able to open the userscript directly with this [link to code](https://raw.githubusercontent.com/kyle-mckay/hardcover-librarian-tampermonkey/main/hardcover.user.js).

![Tampermonkey Installation Page](https://github.com/kyle-mckay/hardcover-librarian-tampermonkey/blob/main/assets/images/tampermonkey-autoinstall.jpg)

### Manual Installation

1. After installing, click the Tampermonkey icon in your browser toolbar.
2. Select **"Create a new script..."** from the menu.
3. A code editor will open with some default template code.
4. Delete all the default code and **paste the entire userscript code** [link to code](https://raw.githubusercontent.com/kyle-mckay/hardcover-librarian-tampermonkey/main/hardcover.user.js) or open the `hardcover.user.js` file.
5. Save the script (usually by clicking the disk icon or pressing `Ctrl+S` / `Cmd+S`).

### Additional Steps

#### Per Site Permissions

In some cases, you may need to enable the script on each of the supported websites before being able to run the script.

![Tampermonkey Enable Per Website](https://github.com/kyle-mckay/hardcover-librarian-tampermonkey/blob/main/assets/images/firefox-enable-script-per-website.jpg)

#### Userscript Injection Settings

In chromeium based browsers, you will need to enable userscript injection from your settings. [Official Instructions](https://www.tampermonkey.net/faq.php#Q209)

![Tampermonkey Enable Userscript Step 1](https://github.com/kyle-mckay/hardcover-librarian-tampermonkey/blob/main/assets/images/chrome-enable-userscripts_1.jpg)
![Tampermonkey Enable Userscript Step 2](https://github.com/kyle-mckay/hardcover-librarian-tampermonkey/blob/main/assets/images/chrome-enable-userscripts_2.jpg)
![Tampermonkey Enable Userscript Step 3](https://github.com/kyle-mckay/hardcover-librarian-tampermonkey/blob/main/assets/images/chrome-enable-userscripts_3.jpg)

### Fin

When installed and navigating to a supported site, tampermonkey should have a little icon beside it showing the number of active scripts. 

![Tampermonkey Browser Icon Example](https://github.com/kyle-mckay/hardcover-librarian-tampermonkey/blob/main/assets/images/tampermonkey-browser-icon.jpg)

Clicking the icon should show you the name of scripts associated with the page.
