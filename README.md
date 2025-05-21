# Rollbit Summarizer Chrome Extension (v2.0.0)

A Chrome extension that enhances your Rollbit trading experience by displaying a summary of your active bets and a chart of your recent P&L history.

## Features

* **Real-time Summary:** Calculates and displays Total Wager, Total P&L, and % Gain for currently active bets.
* **P&L Chart:** Shows a line graph of your Total P&L over a selected time period (Default: 1 hour).
* **Chart Timeframes:** Buttons to switch the chart view between 3 minutes, 15 minutes, 1 hour, or All available data.
* **Data Reset:** A button to clear the stored P&L history for the chart.
* **P&L Gain Intervals:** Displays P&L change over the last 1min, 5min, 15min, 1hr, 4hr, and 24hr periods.
* **Fast Updates:** Fetches data and updates the display (text and chart) every 2 seconds.
* **Persistent History:** P&L chart data is saved locally in your browser and persists between browser sessions (stores approximately the last 24 hours of P&L data points).

## How to Install (from source/GitHub)

1.  **Download:**
    * Click the green "Code" button on this GitHub repository page.
    * Select "Download ZIP".
    * Unzip the downloaded file to a folder on your computer.
    *(Alternatively, if you have Git installed, you can clone the repository: `git clone hhttps://github.com/stonkzzyy/Stonkz-rollbit-summarizer` 

2.  **Open Chrome Extensions:**
    * Open Google Chrome.
    * Type `chrome://extensions` in the address bar and press Enter.

3.  **Enable Developer Mode:**
    * In the top-right corner of the Extensions page, find the "Developer mode" toggle and switch it **ON**.

4.  **Load Unpacked Extension:**
    * Click the "Load unpacked" button that appears.
    * Navigate to the folder where you unzipped or cloned the extension files.
    * Select the folder that directly contains the `manifest.json` file.
    * Click "Select Folder".

The "Rollbit Summarizer" extension should now appear in your list of extensions and be active.

## How to Use

1.  Navigate to a Rollbit trading page where your "Active Bets" table is visible (e.g., a page under `https://rollbit.com/trading/...`).
2.  After a few seconds (the initial delay is around 1.5 seconds), a summary box will appear directly above your active bets table.
3.  **Layout:**
    * **Left Side:** Displays the P&L line chart. Below the chart are buttons (3m, 15m, 1h, All) to change the chart's displayed time window, and a "Reset Data" button to clear all stored P&L history for the chart.
    * **Right Side:** Shows the calculated "Total Wager," "Total P&L," "% Gain," and a table detailing P&L changes over various intervals (1min, 5min, 15min, 1hr, 4hr, 24hr).
4.  All displayed information updates every 2 seconds based on the data read from the active bets table.

## Screenshots


**Example Placeholder:**
```markdown
![Rollbit Summarizer UI](screenshots/summarizer_example.png)
(To use this, replace summarizer_example.png with your actual image filename and make sure the path is correct. Then remove the placeholder text and uncomment the line if you've added an image.)TroubleshootingSummary box not appearing?Ensure you are on a Rollbit trading page that has an active bets table with "WAGER" and "P&L" columns in its header. The extension specifically looks for these headers to identify the correct table.Double-check that the extension is enabled in chrome://extensions. Look for any error indicators next to the extension's entry.Try reloading the Rollbit page (Ctrl+R or Cmd+R).Open the Developer Console (F12 -> Console tab) on the Rollbit page and look for any error messages or messages starting with "Rollbit Summarizer:". The CSS selectors in content.js (e.g., activeTableSelector = 'table', headerRowSelector = 'thead tr') might need updating if Rollbit significantly changes its website's HTML structure.Files in this Repositorymanifest.json: The extension manifest file, defining its properties, version, and permissions.content.js: The core JavaScript file that contains all the logic for finding data, performing calculations, and updating the display on Rollbit pages.README.md: This file, providing information about the extension.(Optional) icons/: If you decide to add custom icons for the extension, they would typically go in this folder, and you would update manifest.json to point to them.License*(Optional: If you chose a license when creating the repository, state it here. For example: "This project is licensed under the MIT License