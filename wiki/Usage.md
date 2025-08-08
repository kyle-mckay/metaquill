# Usage

## How To

In order to interact with the UI bubble created by this script you need:
- To have the script installed [via Tampermonkey](./Installation#tampermonkey)
- Be on a [Supported Site](./Supported-Sites#bubble-visibiliy) with bubble visability

### Extract Book Data

In order to extract book metadata, you first need to be on a [Supported Site](./Supported-Sites#bubble-visibiliy) in which the `Has Export Button?` column says `Yes`.

When on a page that supports extraction, a button labeled `📚 Extract Book Data` will be visible on the top left of the bubble. Clicking this button will have the userscript attempt to extract the metadata relating to the book.

### Copy Specific Fields

If you have extracted book information recently, the bubble will retain this in storage for a short period of time and will display each field in the left-most half. If you want to copy specfic fields you can click on the underlined text. Doing so will display a message confirming that the content has been copied to your clipboard.

### Download the Cover Image

The cover image, if extracted dan be interacted with on the right-most half of the bubble. Right clicking on it will allow you to `Save As` or `Open in new tab`, however you can directly download the image with the `⬇️ Download Cover` button.

#### Exceptions

CORS: Some sites, such as google, may encounter a CORS (Cross-Origin Resource Sharing) violation error when attempting to download the image directly. This can occur if you are on the new domain (`google.*/books`), but the image is hosted on the old domain (`books.google.*/books`). Becasue the download is being initated from outside the domain that is hosting the file, the action is blocked. There is currently no workaround for this within the userscript. You will need to right click on the image from within the bubble and either `Save As` or `Open in new tab` manually.

### Use the `Copy JSON` Button

If you want to copy **all** the extracted data, you can use the button labeled `📋 Copy JSON` and it will provide you with the **full* copy of all populated and empty fields.

### Minimize the Bubble

If the bubble is in the way, you can click on the header (or the up/down arrow on the top right of the bubble) and it will minimize/expand to give you back some screen space. 

### Import Book Data

In order to extract book metadata, you first need to be on a [Supported Site](./Supported-Sites#bubble-visibiliy) in which `Has Import Button?` column says `Yes`.

### Gather DEBUG Information

To gather debug information on the script's performance, you need to first change is log settings

**Enable DEBUG in Tampermonkey:**

1. From your browsers extension menu, click on the Tampermonkey icon and select the `Dashboard` option
2. You will see a list of installed extensions. Locater `MetaQuill` and under the `Actions` column, select the edit icon
3. From within the editor, find the line that says `let currentLogLevel = LogLevel.INFO;` and change `INFO` to `DEBUG` then save.
  - When you are finished debugging, return to this editor and on the top left, hover over the `File` option and select `Discard changes`. This will allow it to update automatically once again.

**DEBUG Cont.**

1. With debug logs enabled, press `F12` on your keyboard and select the `Console` tab.
2. (Optional) In the filter field, type `MetaQuill` to only show logs by the userscript
3. Refresh the page and try to run the process you were trying to do. If there were errors or bad logic present, the logs should help identify where it went wrong.
4. When you have finished attempting your action, right click on the messages and copy all to your clipboard. This can be pasted in a Issue report for assistance.
