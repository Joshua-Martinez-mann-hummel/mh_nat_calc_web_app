import Papa from 'papaparse';
import type {
  SleevesData,
  SleeveProduct,
  SleevePricingTier,
  FramePricingTier,
  CrossWireRule,
  SleeveCartonQty,
  SleeveFractionalCode,
  SleeveValidationRule,
} from '../data/SleevesData/sleevesDataTypes';

// Import CSV files as URL assets
import sleevesProductMasterUrl from '/src/data/SleevesData/SleevesProductMaster.csv?url';
import sleevesSleevePricingUrl from '/src/data/SleevesData/SleevesPricing.csv?url';
import sleevesFramePricingUrl from '/src/data/SleevesData/SleevesFramePricing.csv?url';
import sleevesCrossWireRulesUrl from '/src/data/SleevesData/SleevesCrossWireRules.csv?url';
import sleevesCartonQtyUrl from '/src/data/SleevesData/SleevesCartonQty.csv?url';
import sleevesFractionalCodesUrl from '/src/data/SleevesData/SleevesFractionalCodes.csv?url';
import sleevesValidationRulesUrl from '/src/data/SleevesData/SleevesValidationRules.csv?url';

const loadAndParseCsv = async <T>(filePath: string): Promise<T[]> => {
  return new Promise<T[]>((resolve, reject) => {
    Papa.parse<T>(filePath, {
      download: true, // Let PapaParse fetch the file from the URL
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => resolve(results.data),
      error: (error: any) => reject(error),
    });
  });
};

export const loadSleevesData = async (): Promise<SleevesData> => {
  const [productMaster, sleevePricing, framePricing, crossWireRules, sleeveCartonQty, fractionalCodes, validationRules] = await Promise.all([
    loadAndParseCsv<SleeveProduct>(sleevesProductMasterUrl),
    loadAndParseCsv<SleevePricingTier>(sleevesSleevePricingUrl),
    loadAndParseCsv<FramePricingTier>(sleevesFramePricingUrl),
    loadAndParseCsv<CrossWireRule>(sleevesCrossWireRulesUrl),
    loadAndParseCsv<SleeveCartonQty>(sleevesCartonQtyUrl),
    loadAndParseCsv<SleeveFractionalCode>(sleevesFractionalCodesUrl),
    loadAndParseCsv<SleeveValidationRule>(sleevesValidationRulesUrl),
  ]);

  return { productMaster, sleevePricing, framePricing, crossWireRules, sleeveCartonQty, fractionalCodes, validationRules };
};