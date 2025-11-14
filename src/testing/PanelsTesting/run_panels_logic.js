/**
 * @file Node.js script to execute the compiled panelsLogic for a single test case.
 * This script is designed to be called by an external test runner (e.g., a Python script).
 * It loads all necessary CSV data, reads a single JSON input object from stdin,
 * runs the calculatePanelsLinks function, and prints the JSON result to stdout.
 *
 * This mirrors the architecture of `run_sleeves_logic.js`.
 */

// Redirect console.log to stderr to keep stdout clean for JSON output.
console.log = (...args) => console.error(...args);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import { calculatePanelsLinks } from '../../../dist/logic/panelsLogic.js';

// --- 1. LOAD ALL CSV DATA ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The data directory for the Panels-Links calculator
const dataDir = path.join(__dirname, '..', '..', 'data', 'PanelsData');

/**
 * Reads and parses a CSV file from the PanelsData directory.
 * @param {string} filename The name of the CSV file.
 * @returns {Array<Object>} The parsed data.
 */
const loadCSV = (filename, configOverrides = {}) => {
  const csvPath = path.join(dataDir, filename);
  const csvFile = fs.readFileSync(csvPath, 'utf8');
  const config = {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    ...configOverrides,
  };
  return Papa.parse(csvFile, config).data;
};

// Structure the data exactly as the `loadPanelsData` service does.
const panelsData = {
  // 1. Product Info: Load from CSV, disabling dynamic typing for 'prefix' to keep leading zeros.
  productInfo: new Map(
    loadCSV('PanelsProductMaster.csv', { dynamicTyping: { prefix: false } })
      .map((item) => [item.productName, item.prefix])
  ),
  standardOverrides: new Map(
    loadCSV('PanelsPriceExceptions.csv').map((item) => [item.dimensionKey, item.price])
  ),
  fractionalCodes: new Map(
    loadCSV('PanelsFractionalCodes.csv').map((item) => [item.fraction, item.code])
  ),
  linkTiers: loadCSV('PanelsLinkTiers.csv'),
  // 5. Custom Price List: Disable dynamic typing for the 'type' column to preserve leading zeros.
  customPriceList: loadCSV('PanelsPricing.csv', { dynamicTyping: { type: false } }),
};

// --- 2. GET INPUT FROM STDIN ---
let inputBuffer = '';
process.stdin.on('data', (chunk) => {
  inputBuffer += chunk;
});

process.stdin.on('end', () => {
  try {
    // The input is a single JSON object representing PanelsLinksInputs
    const inputs = JSON.parse(inputBuffer);

    // --- 3. RUN THE LOGIC ---
    const result = calculatePanelsLinks(inputs, panelsData);

    // --- 4. RETURN RESULT TO STDOUT ---
    // The result is written as a single JSON string to stdout.
    // We need to handle the debugInfo object which can contain non-serializable Maps.
    const replacer = (key, value) => {
      if(value instanceof Map) return Array.from(value.entries());
      return value;
    }
    process.stdout.write(JSON.stringify(result, replacer, 2));
  } catch (e) {
    console.error(e.stack);
    process.exit(1);
  }
});