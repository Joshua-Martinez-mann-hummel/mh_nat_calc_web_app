/**
 * This script acts as a bridge between Python and the compiled TypeScript logic.
 * It reads a JSON object from stdin, which contains the test case inputs.
 * It then calls the `calculatePleatPrice` function and prints the resulting
 * quote object as a JSON string to stdout.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

// Since this is a module, __dirname is not available. We can create it.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamically import the compiled logic. The path is relative to this script.
const { calculatePleatPrice } = await import('../../dist/logic/pleatLogic.js');

/**
 * Loads and parses a CSV file from a path relative to the current script.
 * @param {string} relativePath - The relative path to the CSV file.
 * @returns {Array<Object>} - The parsed CSV data.
 */
const loadCsvData = (relativePath) => {
  try {
    const csvPath = resolve(__dirname, relativePath);
    const csvFile = readFileSync(csvPath, 'utf8');
    const { data } = Papa.parse(csvFile, { header: true, dynamicTyping: true });
    return data;
  } catch (error) {
    console.error(`Error loading CSV data from ${relativePath}:`, error);
    process.exit(1);
  }
};

// Load all necessary pricing data from the CSV files, same as the web app.
const pricingData = {
  productFamilyCodes: loadCsvData('../data/Product Family Codes.csv'),
  tieredLookupMatrix: loadCsvData('../data/Tiered Lookup Matrix.csv'),
  standardPrices: loadCsvData('../data/Standard Price Table.csv'),
  dimensionThresholds: loadCsvData('../data/Dimension Thresholds.csv'),
  specialOverrideA: loadCsvData('../data/special-override-prices-A.csv'),
  specialOverrideB: loadCsvData('../data/special-override-prices-B.csv'),
  fractionalCodes: loadCsvData('../data/Fractional_Codes.csv'),
};

/**
 * Reads all data from stdin.
 * @returns {Promise<string>}
 */
const readStdin = () => {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
};

const run = async () => {
  const stdinData = await readStdin();
  if (!stdinData) {
    console.error('Error: No data received from stdin.');
    process.exit(1);
  }

  try {
    const inputs = JSON.parse(stdinData);
    const result = calculatePleatPrice(inputs, pricingData);

    // Format the output to match the CSV columns from the other tests
    const formattedResult = {
      'Part Number': result.partNumber,
      'Price': result.notes || result.price,
      'Carton Quantity': result.notes ? 0 : result.cartonQuantity,
      'Carton Price': result.notes ? 0 : result.cartonPrice,
      'Debug Info': result.debugInfo || {},
    };

    console.log(JSON.stringify(formattedResult, null, 2));
  } catch (error) {
    console.error('Error processing input or running calculation:', error);
    process.exit(1);
  }
};

run();