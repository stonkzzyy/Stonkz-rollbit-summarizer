// --- Global Constants ---
const containerId = 'rollbit-totals-container';
const chartContainerId = 'rollbit-pnl-chart-container';
const chartControlsId = 'rollbit-chart-controls-container';
const textStatsContainerId = 'rollbit-text-stats-container';
const pnlChartSvgId = 'rollbit-pnl-chart-svg';

const PNL_HISTORY_KEY = 'rollbitPnlHistory';
const MAIN_DATA_UPDATE_INTERVAL_MS = 2000; // Main data fetch and UI update interval (2 seconds)

let pnlHistory = []; // Array of { timestamp: number, pnl: number }
let unsavedHistoryCount = 0; // Counter for batching saves
const SAVE_HISTORY_BATCH_SIZE = 15; // Save every 15 data points (approx 30 seconds)

// --- Chart Dimensions & State ---
const CHART_WIDTH = 450; // pixels
const CHART_HEIGHT = 80; // pixels
const CHART_PADDING = 5; // pixels

const TIMEFRAMES = {
    "3m": 3 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 1 * 60 * 60 * 1000,
    "All": Infinity
};
let currentChartTimeframeMs = TIMEFRAMES["1h"]; // Default to 1 hour

/**
 * Parses a string potentially containing currency symbols, commas, etc.,
 * and returns a floating-point number.
 */
function parseCurrency(text) {
  if (!text) {
    return 0;
  }
  try {
    const cleanedText = text.replace(/[^0-9.-]+/g, "");
    const value = parseFloat(cleanedText);
    return isNaN(value) ? 0 : value;
  } catch (error) {
    console.error("Rollbit Summarizer: Error parsing currency:", text, error);
    return 0;
  }
}

/**
 * Loads P&L history from chrome.storage.local.
 */
async function loadPnlHistory() {
    if (!chrome.runtime || !chrome.storage || !chrome.storage.local) {
        console.warn("Rollbit Summarizer: Chrome runtime or storage API not available. Cannot load P&L history.");
        return;
    }
    try {
        const result = await chrome.storage.local.get([PNL_HISTORY_KEY]);
        if (chrome.runtime.lastError) {
            console.warn("Rollbit Summarizer: Error loading P&L history (runtime.lastError):", chrome.runtime.lastError.message);
            return;
        }
        if (result[PNL_HISTORY_KEY]) {
            pnlHistory = result[PNL_HISTORY_KEY];
            prunePnlHistory();
            console.log("Rollbit Summarizer: Loaded P&L history, items:", pnlHistory.length);
            unsavedHistoryCount = 0;
        }
    } catch (error) {
        if (error.message && error.message.includes("Extension context invalidated")) {
            console.warn("Rollbit Summarizer: Context invalidated while loading P&L history.");
        } else {
            console.error("Rollbit Summarizer: Error loading P&L history (catch):", error);
        }
    }
}

/**
 * Saves P&L history to chrome.storage.local, batched.
 */
async function savePnlHistory(forceSave = false) {
    if (!chrome.runtime || !chrome.storage || !chrome.storage.local) {
        return;
    }
    if (!forceSave) {
        unsavedHistoryCount++;
        if (unsavedHistoryCount < SAVE_HISTORY_BATCH_SIZE) {
            return;
        }
    }
    try {
        await chrome.storage.local.set({ [PNL_HISTORY_KEY]: pnlHistory });
        unsavedHistoryCount = 0;
        if (chrome.runtime.lastError) {
            if (!chrome.runtime.lastError.message.includes("Extension context invalidated")) {
                 console.warn("Rollbit Summarizer: Error saving P&L history (runtime.lastError):", chrome.runtime.lastError.message);
            }
        }
    } catch (error) {
        if (!(error.message && error.message.includes("Extension context invalidated"))) {
            console.error("Rollbit Summarizer: Error saving P&L history (catch):", error);
        }
    }
}

/**
 * Prunes pnlHistory if it exceeds a maximum number of points.
 */
function prunePnlHistory() {
    const MAX_PNL_HISTORY_POINTS = 43200; // Approx 24 hours of data at 2-second intervals
    if (pnlHistory.length > MAX_PNL_HISTORY_POINTS) {
        pnlHistory = pnlHistory.slice(pnlHistory.length - MAX_PNL_HISTORY_POINTS);
    }
}

/**
 * Adds a new P&L data point to the history.
 */
function addPnlDataPoint(currentPnl) {
    const now = Date.now();
    pnlHistory.push({ timestamp: now, pnl: currentPnl });
    prunePnlHistory();
    savePnlHistory();
}

/**
 * Fetches Total Wager and Total P&L from the page.
 * @returns {object|null} An object { tableElement, actualTotalWager, actualTotalPnl } or null if not found.
 */
function fetchDataFromPage() {
    const activeTableSelector = 'table';
    const headerRowSelector = 'thead tr';
    const tableBodySelector = 'tbody';
    const tableRowSelector = 'tr';
    const wagerColumnHeaderText = 'WAGER';
    const pnlColumnHeaderText = 'P&L';
    let wagerColIndex = -1;
    let pnlColIndex = -1;
    let tableElement = null;
    let tableBody = null;

    const tables = document.querySelectorAll(activeTableSelector);
    tableElement = Array.from(tables).find((table) => {
        const headerCells = table.querySelectorAll(headerRowSelector + ' th, ' + headerRowSelector + ' td');
        if (headerCells.length === 0) return false;
        let foundWager = false;
        let foundPnl = false;
        let tempWagerIndex = -1;
        let tempPnlIndex = -1;
        headerCells.forEach((cell, index) => {
            const cellText = cell.textContent.trim().toUpperCase();
            if (cellText === wagerColumnHeaderText) { tempWagerIndex = index; foundWager = true; }
            if (cellText === pnlColumnHeaderText) { tempPnlIndex = index; foundPnl = true; }
        });
        if (foundWager && foundPnl) {
            wagerColIndex = tempWagerIndex;
            pnlColIndex = tempPnlIndex;
            tableBody = table.querySelector(tableBodySelector);
            if (!tableBody) return false;
            return true;
        }
        return false;
    });

    if (!tableElement || !tableBody || wagerColIndex === -1 || pnlColIndex === -1) {
        // console.warn("Rollbit Summarizer: Could not find target table for data fetching.");
        return null;
    }

    let actualTotalWager = 0;
    let actualTotalPnl = 0;
    const rows = tableBody.querySelectorAll(tableRowSelector);
    if (rows.length === 0) { /* console.warn("Rollbit Summarizer: No rows in table body."); */ }
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > wagerColIndex) {
            actualTotalWager += parseCurrency(cells[wagerColIndex].textContent);
        }
        if (cells.length > pnlColIndex) {
            actualTotalPnl += parseCurrency(cells[pnlColIndex].textContent);
        }
    });
    // Return number of bets as well for event detection (though trade event dots are not in this version)
    return { tableElement, actualTotalWager, actualTotalPnl, numberOfBets: rows.length };
}


/**
 * Draws the P&L line chart using SVG.
 */
function drawPnlChart() {
    let svg = document.getElementById(pnlChartSvgId);
    if (!svg) {
        const chartContainer = document.getElementById(chartContainerId);
        if (chartContainer) {
            svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("id", pnlChartSvgId);
            svg.setAttribute("width", CHART_WIDTH);
            svg.setAttribute("height", CHART_HEIGHT);
            svg.style.backgroundColor = "#333a40";
            svg.style.border = "1px solid #4a5258";
            svg.style.borderRadius = "3px";
            chartContainer.innerHTML = '';
            chartContainer.appendChild(svg);
        } else { return; }
    }
    svg.setAttribute("width", CHART_WIDTH);
    svg.innerHTML = '';

    const nowForChart = Date.now();
    let relevantHistory;
    if (currentChartTimeframeMs === Infinity) {
        relevantHistory = [...pnlHistory];
    } else {
        relevantHistory = pnlHistory.filter(dp => (nowForChart - dp.timestamp) <= currentChartTimeframeMs);
    }

    if (relevantHistory.length < 2) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", CHART_WIDTH / 2);
        text.setAttribute("y", CHART_HEIGHT / 2);
        text.setAttribute("fill", "#888");
        text.setAttribute("font-size", "10px");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.textContent = pnlHistory.length < 2 ? "Collecting P&L data..." : "Not enough data for selected timeframe...";
        svg.appendChild(text);
        return;
    }

    const pnlValues = relevantHistory.map(dp => dp.pnl);
    const minPnl = Math.min(...pnlValues);
    const maxPnl = Math.max(...pnlValues);
    const pnlRange = (maxPnl - minPnl === 0) ? 1 : (maxPnl - minPnl);
    const firstTimestamp = relevantHistory[0].timestamp;
    const lastTimestamp = relevantHistory[relevantHistory.length - 1].timestamp;
    const timeRange = (lastTimestamp - firstTimestamp === 0) ? 1 : (lastTimestamp - firstTimestamp);

    const points = relevantHistory.map(dp => {
        const x = ((dp.timestamp - firstTimestamp) / timeRange) * (CHART_WIDTH - 2 * CHART_PADDING) + CHART_PADDING;
        const y = CHART_HEIGHT - (((dp.pnl - minPnl) / pnlRange) * (CHART_HEIGHT - 2 * CHART_PADDING) + CHART_PADDING);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');

    if (points.trim() === "") return;

    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", points);
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", relevantHistory[relevantHistory.length -1].pnl >= 0 ? "#4caf50" : "#f44336");
    polyline.setAttribute("stroke-width", "1.5");
    svg.appendChild(polyline);

    if (minPnl < 0 && maxPnl > 0) {
        const zeroLineY = CHART_HEIGHT - (((0 - minPnl) / pnlRange) * (CHART_HEIGHT - 2 * CHART_PADDING) + CHART_PADDING);
        if (zeroLineY > CHART_PADDING && zeroLineY < CHART_HEIGHT - CHART_PADDING) {
            const zeroLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            zeroLine.setAttribute("x1", CHART_PADDING);
            zeroLine.setAttribute("y1", zeroLineY.toFixed(2));
            zeroLine.setAttribute("x2", CHART_WIDTH - CHART_PADDING);
            zeroLine.setAttribute("y2", zeroLineY.toFixed(2));
            zeroLine.setAttribute("stroke", "#666");
            zeroLine.setAttribute("stroke-width", "0.5");
            zeroLine.setAttribute("stroke-dasharray", "2,2");
            svg.appendChild(zeroLine);
        }
    }
}

/**
 * Calculates P&L gain over a specified time interval.
 */
function calculatePnlGainForInterval(durationMs) {
    if (pnlHistory.length < 2) return "N/A";
    if (durationMs === Infinity) {
        if (pnlHistory.length === 0) return "N/A";
        const firstPointPnl = pnlHistory[0].pnl;
        const currentPointPnl = pnlHistory[pnlHistory.length - 1].pnl;
        const allTimeChange = currentPointPnl - firstPointPnl;
        const sign = allTimeChange >= 0 ? "+" : "-";
        const color = allTimeChange >= 0 ? '#4caf50' : '#f44336';
        return `<span style="color: ${color};">${sign}$${Math.abs(allTimeChange).toFixed(2)}</span>`;
    }
    const currentDataPoint = pnlHistory[pnlHistory.length - 1];
    const targetTimestamp = currentDataPoint.timestamp - durationMs;
    let startDataPoint = null;
    for (let i = pnlHistory.length - 1; i >= 0; i--) {
        if (pnlHistory[i].timestamp <= targetTimestamp) {
            startDataPoint = pnlHistory[i]; break;
        }
    }
    if (!startDataPoint && pnlHistory.length > 0 && pnlHistory[0].timestamp > targetTimestamp) return "N/A";
    if (!startDataPoint) return "N/A";
    const pnlChange = currentDataPoint.pnl - startDataPoint.pnl;
    const sign = pnlChange >= 0 ? "+" : "-";
    const color = pnlChange >= 0 ? '#4caf50' : '#f44336';
    return `<span style="color: ${color};">${sign}$${Math.abs(pnlChange).toFixed(2)}</span>`;
}

/**
 * Handles click on the Reset Data button.
 */
async function handleResetDataClick() {
    console.log("Rollbit Summarizer: Reset Data button clicked.");
    pnlHistory = [];
    unsavedHistoryCount = 0;
    await savePnlHistory(true);
    drawPnlChart();
    // Trigger a main update to refresh text stats with empty history
    mainUpdateLoop(true); // Pass a flag to indicate it's a reset
}

/**
 * Handles click on a Timeframe button.
 */
function handleTimeframeChangeClick(durationMs) {
    console.log("Rollbit Summarizer: Timeframe button clicked. Duration (ms):", durationMs);
    currentChartTimeframeMs = durationMs;
    drawPnlChart();
    const buttons = document.querySelectorAll(`#${chartControlsId} button.timeframe-button`);
    buttons.forEach(btn => {
        if (Math.abs(parseFloat(btn.dataset.timeframeMs) - durationMs) < 1) {
            btn.style.backgroundColor = '#555'; btn.style.fontWeight = 'bold';
        } else {
            btn.style.backgroundColor = '#383838'; btn.style.fontWeight = 'normal';
        }
    });
}

/**
 * Creates or updates the main container and its structure (chart + text + controls).
 */
function addOrUpdateMainDisplayContainer(tableElement, actualTotalWager, actualTotalPnl, percentGain) {
  let mainContainerElement = document.getElementById(containerId);
  if (!mainContainerElement) {
    mainContainerElement = document.createElement('div');
    mainContainerElement.id = containerId;
    mainContainerElement.style.border = '1px solid #444';
    mainContainerElement.style.padding = '10px';
    mainContainerElement.style.margin = '15px 0';
    mainContainerElement.style.backgroundColor = '#2a2a2e';
    mainContainerElement.style.color = '#eee';
    mainContainerElement.style.borderRadius = '5px';
    mainContainerElement.style.fontFamily = 'monospace';
    mainContainerElement.style.fontSize = '12px';
    mainContainerElement.style.display = 'flex';
    mainContainerElement.style.alignItems = 'flex-start';

    const leftColumn = document.createElement('div');
    leftColumn.style.display = 'flex';
    leftColumn.style.flexDirection = 'column';
    leftColumn.style.marginRight = '15px';
    leftColumn.style.flexShrink = '0';

    const chartDiv = document.createElement('div');
    chartDiv.id = chartContainerId;
    chartDiv.style.width = `${CHART_WIDTH}px`;
    chartDiv.style.height = `${CHART_HEIGHT}px`;
    leftColumn.appendChild(chartDiv);

    const controlsDiv = document.createElement('div');
    controlsDiv.id = chartControlsId;
    controlsDiv.style.marginTop = '5px';
    controlsDiv.style.display = 'flex';
    controlsDiv.style.justifyContent = 'space-around';

    Object.entries(TIMEFRAMES).forEach(([label, durationMs]) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.dataset.timeframeMs = durationMs;
        btn.classList.add('timeframe-button');
        btn.style.padding = '2px 6px'; btn.style.fontSize = '10px'; btn.style.margin = '0 2px';
        btn.style.cursor = 'pointer'; btn.style.border = '1px solid #555'; btn.style.borderRadius = '3px';
        btn.style.color = '#ccc';
        if (Math.abs(durationMs - currentChartTimeframeMs) < 1) {
            btn.style.backgroundColor = '#555'; btn.style.fontWeight = 'bold';
        } else {
            btn.style.backgroundColor = '#383838';
        }
        btn.addEventListener('click', () => handleTimeframeChangeClick(durationMs));
        controlsDiv.appendChild(btn);
    });

    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Data';
    resetButton.style.padding = '2px 6px'; resetButton.style.fontSize = '10px'; resetButton.style.marginLeft = '10px';
    resetButton.style.cursor = 'pointer'; resetButton.style.border = '1px solid #777'; resetButton.style.borderRadius = '3px';
    resetButton.style.backgroundColor = '#c0392b'; resetButton.style.color = 'white';
    resetButton.addEventListener('click', handleResetDataClick);
    controlsDiv.appendChild(resetButton);

    leftColumn.appendChild(controlsDiv);
    mainContainerElement.appendChild(leftColumn);

    const textStatsDiv = document.createElement('div');
    textStatsDiv.id = textStatsContainerId;
    textStatsDiv.style.textAlign = 'right';
    textStatsDiv.style.lineHeight = '1.4';
    textStatsDiv.style.flexGrow = '1';
    mainContainerElement.appendChild(textStatsDiv);

    try {
        if (tableElement && tableElement.parentNode) {
             tableElement.parentNode.insertBefore(mainContainerElement, tableElement);
        } else {
             console.error("Rollbit Summarizer: Cannot insert main container, tableElement or parentNode is null."); return;
        }
    } catch (error) {
        console.error("Rollbit Summarizer: Failed to insert main display container.", error); return;
    }
  } else {
      const chartDiv = document.getElementById(chartContainerId);
      if (chartDiv && chartDiv.style.width !== `${CHART_WIDTH}px`) {
          chartDiv.style.width = `${CHART_WIDTH}px`;
      }
      const buttons = document.querySelectorAll(`#${chartControlsId} button.timeframe-button`);
      buttons.forEach(btn => {
        if (Math.abs(parseFloat(btn.dataset.timeframeMs) - currentChartTimeframeMs) < 1) {
            btn.style.backgroundColor = '#555'; btn.style.fontWeight = 'bold';
        } else {
            btn.style.backgroundColor = '#383838'; btn.style.fontWeight = 'normal';
        }
    });
  }

  const textStatsContainer = document.getElementById(textStatsContainerId);
  if (textStatsContainer) {
    const displayWager = actualTotalWager;
    const displayPnl = actualTotalPnl;
    const pnlColor = actualTotalPnl >= 0 ? '#4caf50' : '#f44336';
    const gainColor = percentGain >= 0 ? '#4caf50' : '#f44336';

    const gain1m = calculatePnlGainForInterval(1 * 60 * 1000);
    const gain5m_text = calculatePnlGainForInterval(5 * 60 * 1000);
    const gain15m_text = calculatePnlGainForInterval(15 * 60 * 1000);
    const gain1h_text = calculatePnlGainForInterval(60 * 60 * 1000);
    const gain4h = calculatePnlGainForInterval(4 * 60 * 60 * 1000);
    const gain24h = calculatePnlGainForInterval(24 * 60 * 60 * 1000);

    textStatsContainer.innerHTML = `
        <div style="font-weight: bold;">Total Wager: $${displayWager.toFixed(2)}</div>
        <div>
            <span style="font-weight: bold; color: ${gainColor}; display: inline-block; margin-right: 15px;">% Gain: ${percentGain.toFixed(2)}%</span>
            <span style="font-weight: bold; color: ${pnlColor}; display: inline-block;">Total P&L: $${displayPnl.toFixed(2)}</span>
        </div>
        <div style="margin-top: 5px; border-top: 1px solid #444; padding-top: 5px;">
            <table style="width: 100%; text-align: right; font-size: 11px;">
                <tr>
                    <td>1min: ${gain1m}</td>
                    <td>5min: ${gain5m_text}</td>
                    <td>15min: ${gain15m_text}</td>
                </tr>
                <tr>
                    <td>1hr: ${gain1h_text}</td>
                    <td>4hr: ${gain4h}</td>
                    <td>24hr: ${gain24h}</td>
                </tr>
            </table>
        </div>
    `;
  } else {
      console.error("Rollbit Summarizer: textStatsContainer not found for update.");
  }

  if (document.getElementById(chartContainerId) && !document.getElementById(pnlChartSvgId)) {
      drawPnlChart();
  } else if (document.getElementById(pnlChartSvgId)) {
      const svgElement = document.getElementById(pnlChartSvgId);
      if (svgElement.getAttribute("width") !== String(CHART_WIDTH)) {
          drawPnlChart();
      }
  }
}

/**
 * Removes the main display container if the table is no longer found.
 */
function removeTotalDisplayElements() {
    const container = document.getElementById(containerId);
    if (container) {
        container.remove();
    }
}

/**
 * Main update loop: Fetches data, updates P&L history, chart, and text summary.
 * @param {boolean} isReset - Indicates if the call is due to a data reset.
 */
function mainUpdateLoop(isReset = false) {
    const data = fetchDataFromPage();

    if (data) {
        // Destructure numberOfBets here, even if not used in this version's display
        const { tableElement, actualTotalWager, actualTotalPnl, numberOfBets } = data;

        // Add P&L to history only if it's not a reset action that just cleared it
        if (actualTotalPnl !== null && !isReset) {
            addPnlDataPoint(actualTotalPnl);
        }

        // Always try to draw the chart
        // Corrected line: Check for containerId instead of mainContainer variable
        if (document.getElementById(chartContainerId) || !document.getElementById(containerId)) {
             requestAnimationFrame(drawPnlChart);
        }


        const percentGain = (actualTotalWager > 0) ? (actualTotalPnl / actualTotalWager) * 100 : 0;
        requestAnimationFrame(() => {
            addOrUpdateMainDisplayContainer(tableElement, actualTotalWager, actualTotalPnl, percentGain);
        });
    } else {
        // If table not found, ensure UI is removed
        removeTotalDisplayElements();
    }
}

// --- Script Initialization ---
async function init() {
    console.log("Rollbit Summarizer Extension Loaded (v2.0.0)."); // Updated version for logging
    await loadPnlHistory();

    // Initial run slightly delayed
    setTimeout(() => mainUpdateLoop(true), 1500); // Pass true for isReset on initial load to avoid double-adding first point
    // Set interval for main data fetching and UI updates
    setInterval(mainUpdateLoop, MAIN_DATA_UPDATE_INTERVAL_MS);
}

init();
