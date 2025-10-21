// This file is responsible for fetching the raw CSV data from your project and converting it into a usable JavaScript object.

import Papa from 'papaparse';
import type { PricingData } from '../data/dataTypes';

// Import the CSV files as URL assets. Vite will generate the correct public URLs.
import productFamilyCodesUrl from '../data/Product Family Codes.csv?url';
import tieredLookupMatrixUrl from '../data/Tiered Lookup Matrix.csv?url';
import standardPricesUrl from '../data/Standard Price Table.csv?url';
import dimensionThresholdsUrl from '../data/Dimension Thresholds.csv?url';
import specialOverrideAUrl from '../data/special-override-prices-A.csv?url';
import specialOverrideBUrl from '../data/special-override-prices-B.csv?url';

export const loadAndParseData = async (): Promise<PricingData> => {
  const fetchAndParse = (filePath: string): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse<any>(filePath, {
        download: true,
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true, // Automatically converts numbers
        complete: (results: Papa.ParseResult<any>) => resolve(results.data),
        error: (error) => reject(error),
      });
    });
  };

  try {
    // Fetch all four files in parallel
    const [
      productFamilyCodes,
      tieredLookupMatrix,
      standardPrices,
      dimensionThresholds,
      specialOverrideA,
      specialOverrideB,
    ] = await Promise.all([
      fetchAndParse(productFamilyCodesUrl),
      fetchAndParse(tieredLookupMatrixUrl),
      fetchAndParse(standardPricesUrl),
      fetchAndParse(dimensionThresholdsUrl),
      fetchAndParse(specialOverrideAUrl),
      fetchAndParse(specialOverrideBUrl),
    ]);

    return {
      productFamilyCodes,
      tieredLookupMatrix,
      standardPrices,
      dimensionThresholds,
      specialOverrideA,
      specialOverrideB,
    };
  } catch (error) {
    console.error("Error loading pricing data:", error);
    throw new Error("Could not load pricing data.");
  }
};