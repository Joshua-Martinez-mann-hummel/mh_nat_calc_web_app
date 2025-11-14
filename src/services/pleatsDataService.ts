// This file is responsible for fetching the raw CSV data from your project and converting it into a usable JavaScript object.

import Papa, { type ParseResult, type ParseRemoteConfig } from 'papaparse';
import type { PricingData } from '../data/PleatsData/pleatsDataTypes';

// Import the CSV files as URL assets. Vite will generate the correct public URLs.
import productFamilyCodesUrl from '/src/data/PleatsData/Product Family Codes.csv?url';
import tieredLookupMatrixUrl from '/src/data/PleatsData/Tiered Lookup Matrix.csv?url';
import standardPricesUrl from '/src/data/PleatsData/Standard Price Table.csv?url';
import dimensionThresholdsUrl from '/src/data/PleatsData/Dimension Thresholds.csv?url';
import specialOverrideAUrl from '/src/data/PleatsData/special-override-prices-A.csv?url';
import specialOverrideBUrl from '/src/data/PleatsData/special-override-prices-B.csv?url';
import fractionalCodesUrl from '/src/data/PleatsData/Fractional_Codes.csv?url';


export const loadAndParseData = async (): Promise<PricingData> => {
  const fetchAndParse = (filePath: string): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const config: ParseRemoteConfig<any> = {
        download: true,
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true, // Automatically converts numbers
        complete: (results: ParseResult<any>) => resolve(results.data),
        error: (error: Error) => reject(error),
      };
      Papa.parse<any>(filePath, config);
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
      fractionalCodes,
    ] = await Promise.all([
      fetchAndParse(productFamilyCodesUrl),
      fetchAndParse(tieredLookupMatrixUrl),
      fetchAndParse(standardPricesUrl),
      fetchAndParse(dimensionThresholdsUrl),
      fetchAndParse(specialOverrideAUrl),
      fetchAndParse(specialOverrideBUrl),
      fetchAndParse(fractionalCodesUrl),
    ]);

    return {
      productFamilyCodes,
      tieredLookupMatrix,
      standardPrices,
      dimensionThresholds,
      specialOverrideA,
      specialOverrideB,
      fractionalCodes,
    };
  } catch (error) {
    console.error("Error loading pricing data:", error);
    throw new Error("Could not load pricing data.");
  }
};