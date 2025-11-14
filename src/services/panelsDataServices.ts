/**
 * @file Service for fetching and parsing all CSV data for the Panels-Links calculator.
 * This service follows the same architecture as the other calculator data services.
 */

import Papa, { ParseResult } from 'papaparse';
import type {
  PanelsLinksData,
  PanelCustomPriceRow,
} from '../data/PanelsData/panelsDataTypes';

// Import CSV files as URL assets, which Vite will handle.
import standardOverridesUrl from '/src/data/PanelsData/PanelsPriceExceptions.csv?url';
import fractionalCodesUrl from '/src/data/PanelsData/PanelsFractionalCodes.csv?url';
import linkTiersUrl from '/src/data/PanelsData/PanelsLinkTiers.csv?url';
import productInfoUrl from '/src/data/PanelsData/PanelsProductMaster.csv?url';
import customPriceListUrl from '/src/data/PanelsData/PanelsPricing.csv?url';

/**
 * A generic utility to fetch and parse a CSV file from a given URL.
 * It uses papaparse for robust CSV handling.
 * @param filePath The URL of the CSV file.
 * @returns A promise that resolves to an array of parsed objects.
 */
const fetchAndParseCSV = <T>(filePath: string, configOverrides: Papa.ParseConfig = {}): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const config: Papa.ParseConfig = {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: (header: string) => header.trim(),
      ...configOverrides,
      complete: (results: ParseResult<T>) => {
        if (results.errors.length) {
          reject(
            new Error(`Error parsing ${filePath}: ${results.errors[0].message}`)
          );
        } else {
          resolve(results.data);
        }
      },
      error: (error: any) => reject(new Error(`Failed to fetch ${filePath}: ${error.message}`)),
    };
    Papa.parse<T>(filePath, config);
  });
};

/**
 * Main data loading function for the Panels-Links calculator.
 * It fetches all 5 required CSVs in parallel, parses them, and structures
 * the data into the `PanelsLinksData` object.
 * @returns A promise that resolves to the fully populated `PanelsLinksData` object.
 */
export const loadPanelsData = async (): Promise<PanelsLinksData> => {
  try {
    const [
      productInfoData,
      standardOverridesData,
      fractionalCodesData,
      linkTiersData,
      customPriceListData,
    ] = await Promise.all([
      // Fetch product info, disabling dynamic typing on 'prefix' to keep leading zeros.
      fetchAndParseCSV<{ productName: string; prefix: string }>(productInfoUrl, {
        dynamicTyping: { prefix: false },
      }),
      fetchAndParseCSV<{ dimensionKey: string; price: string }>(standardOverridesUrl),
      fetchAndParseCSV<{ fraction: number; code: string }>(fractionalCodesUrl),
      fetchAndParseCSV<{ lengthMax: number; btnPanels: number }>(linkTiersUrl),
      // Disable dynamic typing for the 'type' column to preserve leading zeros (e.g., "031").
      // This ensures the prefix remains a string and matches the hard-coded productInfo map.
      fetchAndParseCSV<PanelCustomPriceRow>(customPriceListUrl, {
        dynamicTyping: { type: false },
      }),
    ]);

    // 1. Product Info: Map<productName, prefix> from CSV
    const productInfo = new Map<string, string>(
      productInfoData.map((item) => [item.productName, item.prefix])
    );

    // 2. Standard Overrides: Map<dimensionKey, price>
    const standardOverrides = new Map<string, string>(
      standardOverridesData.map((item) => [item.dimensionKey, item.price])
    );

    // 3. Fractional Codes: Map<fraction, code>
    const fractionalCodes = new Map<number, string>(
      fractionalCodesData.map((item) => [item.fraction, item.code])
    );

    // 4. Link Tiers: Array of { lengthMax, btnPanels }
    const linkTiers = linkTiersData.map((item) => ({
      lengthMax: item.lengthMax,
      btnPanels: item.btnPanels,
    }));

    // 5. Custom Price List: Array of PanelCustomPriceRow
    // PapaParse with dynamicTyping handles most conversions.
    const customPriceList = customPriceListData;

    return {
      productInfo,
      standardOverrides,
      fractionalCodes,
      linkTiers,
      customPriceList,
    };
  } catch (error) {
    console.error('Failed to load Panels-Links calculator data:', error);
    // In a real-world app, you might want to throw a more specific error
    // or have a fallback mechanism.
    throw new Error('Could not load essential data for the Panels-Links calculator.');
  }
};