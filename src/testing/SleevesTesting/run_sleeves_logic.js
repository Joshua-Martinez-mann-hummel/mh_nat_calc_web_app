// src/testing/SleevesTesting/run_sleeves_logic.js
console.log = (...args) => console.error(...args);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import { calculateSleeves } from '../../../dist/logic/sleevesLogic.js';

// --- 1. GET DATA ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', '..', 'data', 'SleevesData');

const loadCSV = (filename) => {
  const csvPath = path.join(dataDir, filename);
  const csvFile = fs.readFileSync(csvPath, 'utf8');
  return Papa.parse(csvFile, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
};

const sleevesData = {
  productMaster: loadCSV('SleevesProductMaster.csv'),
  fractionalCodes: loadCSV('SleevesFractionalCodes.csv'),
  sleevePricing: loadCSV('SleevesPricing.csv'),
  framePricing: loadCSV('SleevesFramePricing.csv'),
  crossWireRules: loadCSV('SleevesCrossWireRules.csv'),
  sleeveCartonQty: loadCSV('SleevesCartonQty.csv'),
  validationRules: loadCSV('SleevesValidationRules.csv'),
};

// --- 2. GET INPUT ---
let inputBuffer = '';
process.stdin.on('data', (chunk) => {
  inputBuffer += chunk;
});

process.stdin.on('end', () => {
  try {
    const inputs = JSON.parse(inputBuffer);

    // --- 3. RUN LOGIC ---
    const result = calculateSleeves(inputs, sleevesData);

    // --- 4. RETURN RESULT ---
    // We are modifying the result slightly for easier comparison in the Python script.
    // The UI handles the error display, but for testing, we want the errors in a dedicated column.
    const finalOutput = { ...result, Price: result.errors.length > 0 ? result.errors.join('; ') : result.price };
    process.stdout.write(JSON.stringify(finalOutput, null, 2));
  } catch (e) {
    process.stderr.write(e.stack);
    process.exit(1);
  }
});