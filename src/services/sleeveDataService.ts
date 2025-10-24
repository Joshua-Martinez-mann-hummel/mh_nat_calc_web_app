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

const loadAndParseCsv = async <T>(filePath: string): Promise<T[]> => {
  const response = await fetch(filePath);
  const csvText = await response.text();
  return new Promise<T[]>((resolve, reject) => {
    Papa.parse<T>(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      // Filter out any empty rows that PapaParse might return
      complete: (results) => resolve(results.data.filter(row => (row as any).productName || (row as any).DecimalValue !== undefined || (row as any).maxLength !== undefined)),
      error: (error: any) => reject(error),
    });
  });
};

export const loadSleevesData = async (): Promise<SleevesData> => {
  const [productMaster, sleevePricing, framePricing, crossWireRules, sleeveCartonQty, fractionalCodes, validationRules] = await Promise.all([
    loadAndParseCsv<SleeveProduct>('/src/data/SleevesData/csv/SleevesProductMaster.csv'),
    loadAndParseCsv<SleevePricingTier>('/src/data/SleevesData/csv/SleevesSleevePricing.csv'),
    loadAndParseCsv<FramePricingTier>('/src/data/SleevesData/csv/SleevesFramePricing.csv'),
    loadAndParseCsv<CrossWireRule>('/src/data/SleevesData/csv/SleevesCrossWireRules.csv'),
    loadAndParseCsv<SleeveCartonQty>('/src/data/SleevesData/csv/SleevesCartonQty.csv'),
    loadAndParseCsv<SleeveFractionalCode>('/src/data/SleevesData/csv/SleevesFractionalCodes.csv'),
    loadAndParseCsv<SleeveValidationRule>('/src/data/SleevesData/csv/SleevesValidationRules.csv'),
  ]);

  return { productMaster, sleevePricing, framePricing, crossWireRules, sleeveCartonQty, fractionalCodes, validationRules };
};