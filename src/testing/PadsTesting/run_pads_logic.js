// src/testing/PadsTesting/run_pads_logic.js
console.log = (...args) => console.error(...args);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import { calculatePads } from '../../../dist/logic/padsLogic.js';

// --- 1. GET DATA ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', '..', 'data', 'PadsData');

const loadCSV = (filename) => {
  const csvPath = path.join(dataDir, filename);
  const csvFile = fs.readFileSync(csvPath, 'utf8');
  return Papa.parse(csvFile, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
};

// Mimic the data loading and structuring from padsDataService.ts
const loadProductInfo = () => {
  const crossRefData = loadCSV('PadsProductCrossReference.csv');
  const masterData = loadCSV('PadsProductMaster.csv');
  
  const masterMap = new Map(masterData.map(item => [String(item.Prefix), item]));
  const productInfoMap = new Map();

  for (const crossRefItem of crossRefData) {
    const productPrefix = String(crossRefItem['Product Prefix']);
    const masterItem = masterMap.get(productPrefix);
    if (masterItem) {
      const prefix = String(masterItem.Prefix);
      const atOptionAvailable = (prefix === '130' || prefix === '140' || prefix === '143');
      productInfoMap.set(crossRefItem['Product Name'], {
        prefix: prefix,
        standardCartonQty: crossRefItem['Standard Carton QTY'],
        atOptionAvailable: atOptionAvailable,
        min: masterItem.Min,
        max: masterItem.Max,
      });
    }
  }
  return productInfoMap;
};

const loadPadPricing = () => {
  const rawPricing = loadCSV('PadsPricing.csv');
  const pricingData = {};
  for (const row of rawPricing) {
    const prefix = String(row.Prefix);
    if (!pricingData[prefix]) {
      pricingData[prefix] = { standard: [], at: [] };
    }
    const standardPrice = parseFloat(String(row.Price).replace(/[$,]/g, '')) || 0;
    pricingData[prefix].standard.push({ from: row.From, to: row.To, standardPrice: standardPrice });
    const atPrice = parseFloat(String(row['AT Price']).replace(/[$,]/g, '')) || undefined;
    if (atPrice) {
      pricingData[prefix].at.push({ from: row.From, to: row.To, standardPrice: standardPrice, atPrice: atPrice });
    }
  }
  return pricingData;
};

const padsData = {
  productInfo: loadProductInfo(),
  fractionalCodes: new Map(loadCSV('PadsFractionalCodes.csv').map(item => [item.Decimal, item.Letter || ''])),
  padPricing: loadPadPricing(),
  priceExceptions: new Map(loadCSV('PadsPriceExceptions.csv').map(item => [String(item['PART NUMBER']), String(item['Return Value'])])),
  cartonQty: {
    qtyUnder26: new Map(loadCSV('padsCartonQty_under26.csv').map(item => [String(item.Prefix), item.Qty])),
    universalLengthTiers: loadCSV('padsCartonQty_over26.csv').map(item => {
      const [from, to] = String(item['Max Length']).split('-').map(Number);
      return { from, to, qty: item.Qty };
    })
  }
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
    const result = calculatePads(inputs, padsData);

    // --- 4. RETURN RESULT ---
    // With the new "Excel-like" logic, we always return the full result object.
    // The Python test will now be responsible for checking both the price and the errors array.
    // We rename the `price` key to `Price` to match the capitalization the Python script expects.
    const finalOutput = { ...result, Price: result.price };
    delete finalOutput.price; // Clean up the old key

    process.stdout.write(JSON.stringify(finalOutput));
  } catch (e) {
    process.stderr.write(e.stack);
    process.exit(1);
  }
});