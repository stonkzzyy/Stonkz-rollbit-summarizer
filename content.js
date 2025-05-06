// --- Global Constants ---
const containerId = 'rollbit-totals-container'; // Define ID here for global access
// IDs for individual lines are no longer needed

/**
 * Parses a string potentially containing currency symbols, commas, etc.,
 * and returns a floating-point number.
 * @param {string} text - The text content to parse.
 * @returns {number} - The parsed number, or 0 if parsing fails.
 */
function parseCurrency(text) {
  if (!text) {
    return 0;
  }
  try {
    // Remove '$', ',', spaces and potentially other non-numeric chars except '.' and '-'
    const cleanedText = text.replace(/[^0-9.-]+/g, "");
    const value = parseFloat(cleanedText);
    return isNaN(value) ? 0 : value;
  } catch (error) {
    console.error("Rollbit Summarizer: Error parsing currency:", text, error);
    return 0;
  }
}

/**
 * Finds the active bets table, calculates Wager and P&L totals, % gain,
 * and displays them on the page.
 */
function calculateAndDisplayTotals() {
  // --- 1. Find the Table and Columns ---
  // IMPORTANT: Replace these selectors with the actual ones from Rollbit's HTML structure.
  const activeTableSelector = 'table'; // Example: Find *any* table first
  const headerRowSelector = 'thead tr'; // Example: Selector for the header row
  const tableBodySelector = 'tbody'; // Example: Selector for the table body
  const tableRowSelector = 'tr'; // Example: Selector for rows within the tbody
  const wagerColumnHeaderText = 'WAGER'; // Text in the Wager column header
  const pnlColumnHeaderText = 'P&L'; // Text in the P&L column header

  let wagerColIndex = -1;
  let pnlColIndex = -1;
  let tableElement = null;
  let tableBody = null;

  // Try to find the table based on headers
  const tables = document.querySelectorAll(activeTableSelector);
   tableElement = Array.from(tables).find(table => {
        const headerCells = table.querySelectorAll(headerRowSelector + ' th, ' + headerRowSelector + ' td');
        let foundWager = false;
        let foundPnl = false;
        let tempWagerIndex = -1;
        let tempPnlIndex = -1;

        headerCells.forEach((cell, index) => {
            const headerText = cell.textContent.trim().toUpperCase();
            if (headerText === wagerColumnHeaderText) { tempWagerIndex = index; foundWager = true; }
            if (headerText === pnlColumnHeaderText) { tempPnlIndex = index; foundPnl = true; }
        });

        if (foundWager && foundPnl) {
            wagerColIndex = tempWagerIndex;
            pnlColIndex = tempPnlIndex;
            tableBody = table.querySelector(tableBodySelector);
            return true; // Table found
        }
        return false; // Continue searching
    });


  if (!tableElement || !tableBody || wagerColIndex === -1 || pnlColIndex === -1) {
    console.log("Rollbit Summarizer: Could not find the active bets table or required columns (WAGER, P&L). Selectors might need updating.");
    removeTotalDisplayElements(); // Call remove function if table not found
    return;
  }

  // --- 2. Iterate Rows and Calculate Sums ---
  let totalWager = 0;
  let totalPnl = 0;
  const rows = tableBody.querySelectorAll(tableRowSelector);

  rows.forEach(row => {
    const cells = row.querySelectorAll('td');

    if (cells.length > wagerColIndex) {
      const wagerCell = cells[wagerColIndex];
      totalWager += parseCurrency(wagerCell.textContent);
    }

    if (cells.length > pnlColIndex) {
      const pnlCell = cells[pnlColIndex];
      totalPnl += parseCurrency(pnlCell.textContent);
    }
  });

  // --- 3. Calculate % Gain ---
  // Avoid division by zero if totalWager is 0 or negative
  const percentGain = (totalWager > 0) ? (totalPnl / totalWager) * 100 : 0;

  // --- 4. Display Totals ---
  // Use requestAnimationFrame to schedule the DOM update
  requestAnimationFrame(() => {
      // Introduce a minimal delay to potentially yield to other scripts
      setTimeout(() => {
          addOrUpdateTotalDisplayElements(tableElement, totalWager, totalPnl, percentGain);
      }, 0); // Delay of 0ms pushes execution to end of event queue
  });


  // console.log("Rollbit Summarizer: Totals updated:", `Wager: ${totalWager.toFixed(2)}`, `P&L: ${totalPnl.toFixed(2)}`, `% Gain: ${percentGain.toFixed(2)}%`);
}

/**
 * Creates or updates the container DIV and sets its innerHTML directly.
 * Places % Gain and P&L on the same line.
 * This function should now be called within requestAnimationFrame -> setTimeout.
 * @param {HTMLElement} tableElement - The table element to insert totals near.
 * @param {number} totalWager - The calculated total wager.
 * @param {number} totalPnl - The calculated total P&L.
 * @param {number} percentGain - The calculated percentage gain.
 */
function addOrUpdateTotalDisplayElements(tableElement, totalWager, totalPnl, percentGain) {
  // console.log("Rollbit Summarizer: Entering addOrUpdateTotalDisplayElements (innerHTML version)");

  // --- 1. Ensure Container Exists ---
  let container = document.getElementById(containerId);
  if (!container) {
    // console.log("Rollbit Summarizer: Container not found, creating...");
    container = document.createElement('div');
    container.id = containerId; // Use global constant
    // Basic Styling
    container.style.border = '1px solid #444';
    container.style.padding = '10px';
    container.style.margin = '15px 0';
    container.style.backgroundColor = '#2a2a2e';
    container.style.color = '#eee';
    container.style.borderRadius = '5px';
    container.style.textAlign = 'right'; // Keep overall alignment right
    container.style.lineHeight = '1.6';
    container.style.fontFamily = 'monospace';
    container.style.fontSize = '13px';

    // Insert the container before the table
    try {
        if (tableElement && tableElement.parentNode) {
             tableElement.parentNode.insertBefore(container, tableElement);
             // console.log("Rollbit Summarizer: Container inserted successfully.");
        } else {
             console.error("Rollbit Summarizer: Cannot insert container, tableElement or its parentNode is null.");
             return; // Stop if insertion point is invalid
        }
    } catch (error) {
        console.error("Rollbit Summarizer: Failed to insert display container.", error);
        return; // Stop if insertion fails
    }
  }

  // --- 2. Construct HTML Content String ---
  const pnlColor = totalPnl >= 0 ? '#4caf50' : '#f44336'; // Green/Red
  const gainColor = percentGain >= 0 ? '#4caf50' : '#f44336'; // Green/Red

  // Use inline-block spans for the second line layout
  // Added margin-right to the % Gain span for spacing
  const contentHTML = `
      <div style="font-weight: bold;">Total Wager: $${totalWager.toFixed(2)}</div>
      <div>
          <span style="font-weight: bold; color: ${gainColor}; display: inline-block; margin-right: 15px;">% Gain: ${percentGain.toFixed(2)}%</span>
          <span style="font-weight: bold; color: ${pnlColor}; display: inline-block;">Total P&L: $${totalPnl.toFixed(2)}</span>
      </div>
  `;

  // --- 3. Update Container's innerHTML ---
  try {
      if (container) { // Double check container exists before setting innerHTML
         container.innerHTML = contentHTML;
      } else {
          console.error("Rollbit Summarizer: Container is null just before setting innerHTML!");
      }
  } catch (error) {
       console.error("Rollbit Summarizer: Error setting innerHTML:", error);
  }

  // console.log("Rollbit Summarizer: Exiting addOrUpdateTotalDisplayElements (innerHTML version)");
}

/**
 * Removes the display elements if the table is no longer found.
 */
function removeTotalDisplayElements() {
    // containerId is now accessible from global scope
    const container = document.getElementById(containerId);
    if (container) {
        // console.log("Rollbit Summarizer: Removing display container."); // Log removal
        container.remove();
    }
}

// --- Run Periodically ---
// Initial run after a short delay
const initialDelay = 2500; // Slightly increased delay
setTimeout(calculateAndDisplayTotals, initialDelay);

// Set interval to run every 60 seconds
const updateInterval = 2000;
setInterval(calculateAndDisplayTotals, updateInterval);

console.log("Rollbit Summarizer Extension Loaded (v1.8 - P&L and % Gain on Same Line).");
