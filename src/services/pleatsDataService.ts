// This file is responsible for fetching the raw CSV data from your project and converting it into a usable JavaScript object.

import type {
  PricingData,
  ProductFamilyCode,
  TieredLookupRow,
  StandardPriceRow,
  DimensionThresholdRow,
  SpecialOverridePriceRow,
  FractionalCodeRow,
} from '../data/PleatsData/pleatsDataTypes';
import { parseCsvFromUrl } from './csvParser';

// Import the CSV files as URL assets. Vite will generate the correct public URLs.
import productFamilyCodesUrl from '/src/data/PleatsData/Product Family Codes.csv?url';
import tieredLookupMatrixUrl from '/src/data/PleatsData/Tiered Lookup Matrix.csv?url';
import standardPricesUrl from '/src/data/PleatsData/Standard Price Table.csv?url';
import dimensionThresholdsUrl from '/src/data/PleatsData/Dimension Thresholds.csv?url';
import specialOverrideAUrl from '/src/data/PleatsData/special-override-prices-A.csv?url';
import specialOverrideBUrl from '/src/data/PleatsData/special-override-prices-B.csv?url';
import fractionalCodesUrl from '/src/data/PleatsData/Fractional_Codes.csv?url';


export const loadAndParseData = async (): Promise<PricingData> => {
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
      parseCsvFromUrl<ProductFamilyCode>(productFamilyCodesUrl),
      parseCsvFromUrl<TieredLookupRow>(tieredLookupMatrixUrl),
      parseCsvFromUrl<StandardPriceRow>(standardPricesUrl),
      parseCsvFromUrl<DimensionThresholdRow>(dimensionThresholdsUrl),
      parseCsvFromUrl<SpecialOverridePriceRow>(specialOverrideAUrl),
      parseCsvFromUrl<SpecialOverridePriceRow>(specialOverrideBUrl),
      parseCsvFromUrl<FractionalCodeRow>(fractionalCodesUrl),
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