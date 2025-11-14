// Based on the template from src/services/sleeveDataService.ts
import Papa, { type ParseResult, type ParseRemoteConfig } from 'papaparse';
import type {
  PadsData,
  ProductInfo,
  PriceTier,
} from '../data/PadsData/padsDataTypes';

// Import CSV files as URL assets
import productCrossReferenceUrl from '/src/data/PadsData/PadsProductCrossReference.csv?url';
import productMasterUrl from '/src/data/PadsData/PadsProductMaster.csv?url';
import fractionalCodesUrl from '/src/data/PadsData/PadsFractionalCodes.csv?url';
import padPricingUrl from '/src/data/PadsData/PadsPricing.csv?url';
import priceExceptionsUrl from '/src/data/PadsData/PadsPriceExceptions.csv?url';
import cartonQtyUnder26Url from '/src/data/PadsData/padsCartonQty_under26.csv?url';
import cartonQtyOver26Url from '/src/data/PadsData/padsCartonQty_over26.csv?url';

/**
 * Generic utility to fetch and parse a CSV file from a URL.
 * @param filePath The URL of the CSV file.
 * @returns A promise that resolves to an array of parsed objects.
 */
const loadAndParseCsv = async <T>(filePath: string): Promise<T[]> => {
  return new Promise<T[]>((resolve, reject) => {
    const config: ParseRemoteConfig<T> = {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results: ParseResult<T>) => resolve(results.data),
      error: (error: Error) => reject(error),
    };
    Papa.parse<T>(filePath, config);
  });
};

/**
 * Loads and joins product cross-reference and master data.
 */
const loadProductInfo = async (): Promise<Map<string, ProductInfo>> => {
  const [crossRefData, masterData] = await Promise.all([
    // Use the actual headers from the CSV file
    loadAndParseCsv<{ 'Product Name': string; 'Product Prefix': number; 'Standard Carton QTY': number }>(productCrossReferenceUrl),
    loadAndParseCsv<{ Prefix: number; Min: number; Max: number }>(productMasterUrl),
  ]);

  // The master map should be keyed by the 'Prefix' column from the master file
  const masterMap = new Map(masterData.map(item => [String(item.Prefix), item]));
  const productInfoMap = new Map<string, ProductInfo>();

  for (const crossRefItem of crossRefData) {
    // Use the correct property names from the parsed CSV object
    const productName = crossRefItem['Product Name'];
    const productPrefix = crossRefItem['Product Prefix'];
    const standardCartonQty = crossRefItem['Standard Carton QTY'];

    if (!productPrefix) {
      console.warn('Skipping row in productCrossReference.csv due to missing "Product Prefix":', crossRefItem);
      continue;
    }
    if (!productName) {
      console.warn('Skipping row in productCrossReference.csv due to missing "Product Name":', crossRefItem);
      continue;
    }

    const masterItem = masterMap.get(String(productPrefix));
    if (masterItem) {
      const prefix = String(masterItem.Prefix);

      // This is the hard-coded business rule from Excel (Q17)
      const atOptionAvailable = (prefix === '130' || prefix === '140' || prefix === '143');

      productInfoMap.set(String(productName), {
        prefix: prefix,
        standardCartonQty: standardCartonQty,
        atOptionAvailable: atOptionAvailable, // Use our new hard-coded value
        min: masterItem.Min,
        max: masterItem.Max,
      });
    }
  }
  return productInfoMap;
};

/**
 * Loads fractional codes into a Map.
 */
const loadFractionalCodes = async (): Promise<Map<number, string>> => {
  const data = await loadAndParseCsv<{ Decimal: number; Fractional: string; Letter: string; Whole: number }>(fractionalCodesUrl);
  return new Map(data.map(item => [item.Decimal, item.Letter || '']));
};

/**
 * Loads and transforms tiered pricing data.
 */
const loadPadPricing = async (): Promise<{
  [prefix: string]: { // Changed to use PriceTier interface
    standard: PriceTier[];
    at: PriceTier[];
  };
}> => {
  const rawPricing = await loadAndParseCsv<{ Prefix: number; Name: string; Range: string; From: number; To: number; Price: any; 'AT Price': any }>(padPricingUrl);
  const pricingData: { [prefix: string]: { standard: PriceTier[]; at: PriceTier[]; } } = {};

  for (const row of rawPricing) {
    // Add defensive check for missing prefix
    if (!row.Prefix) { // Check for 'Prefix' (capital P)
      console.warn('Skipping row in padPricing.csv due to missing prefix:', row);
      continue;
    }
    const prefix = String(row.Prefix); // Use 'Prefix' column
    if (!pricingData[prefix]) {
      pricingData[prefix] = { standard: [], at: [] };
    }

    // Add to standard tier
    const standardPrice = parseFloat(String(row.Price).replace(/[$,]/g, '')) || 0;
    pricingData[prefix].standard.push({
      from: row.From,
      to: row.To,
      standardPrice: standardPrice,
    });

    // Add to AT tier if it exists
    const atPrice = parseFloat(String(row['AT Price']).replace(/[$,]/g, '')) || undefined;
    if (atPrice) {
      pricingData[prefix].at.push({
        from: row.From,
        to: row.To,
        standardPrice: standardPrice, // Standard price is also part of AT tier for reference
        atPrice: atPrice,
      });
    }
  }
  return pricingData;
};

/**
 * Loads price exceptions into a Map.
 */
const loadPriceExceptions = async (): Promise<Map<string, string>> => {
  const data = await loadAndParseCsv<{ 'PART NUMBER': string; 'Return Value': string }>(priceExceptionsUrl);
  return new Map(data.map(item => [String(item['PART NUMBER']), String(item['Return Value'])]));
};

/**
 * Loads and structures carton quantity rules from two separate files.
 */
const loadCartonQty = async (): Promise<PadsData['cartonQty']> => {
  // Fetch both files in parallel
  const [under26Data, over26Data] = await Promise.all([
    loadAndParseCsv<{ Prefix: number; Qty: number }>(cartonQtyUnder26Url),
    loadAndParseCsv<{ 'Max Length': string; Qty: number }>(cartonQtyOver26Url),
  ]);

  // 1. Process the "Under 26" data into a Map
  const qtyUnder26 = new Map<string, number>(
    under26Data
      .filter(item => { // Use 'Prefix' from observed data
        if (item.Prefix === undefined || item.Prefix === null) {
          console.warn('Skipping cartonQtyUnder26 item due to missing Prefix:', item);
          return false;
        }
        return true;
      })
      .map(item => [String(item.Prefix), item.Qty]) // Use 'Prefix' and 'Qty'
  );

  // 2. Process the "Over 26" data into universalLengthTiers
  const universalLengthTiers = over26Data.map(item => {
    const [from, to] = String(item['Max Length']).split('-').map(Number);
    return { from, to, qty: item.Qty };
  });

  return { qtyUnder26, universalLengthTiers };
};


/**
 * Main data loading function for the Pads calculator.
 * Fetches all CSVs, parses them, and assembles the final PadsData object.
 */
export const loadPadsData = async (): Promise<PadsData> => {
  const [productInfo, fractionalCodes, padPricing, priceExceptions, cartonQty] = await Promise.all([
    loadProductInfo(),
    loadFractionalCodes(),
    loadPadPricing(),
    loadPriceExceptions(),
    loadCartonQty(),
  ]);

  return { productInfo, fractionalCodes, padPricing, priceExceptions, cartonQty };
};
