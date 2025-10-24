import Papa from 'papaparse';

// Define the types for the parsed CSV data
export interface SleeveProduct {
  productName: string;
  prefix: string;
  options: string; // Comma-separated
}

export interface SleevePricingTier {
  from: number;
  to: number;
  standardPrice: number;
  atPrice: number;
}

export interface FramePricingTier {
  group: 'group1' | 'group2' | 'group3';
  rangeTo: number;
  price: number;
}

export interface CrossWireRule {
  maxDim: number;
  wires: number;
}

export interface SleeveCartonQty {
  maxLength: number;
  qty: number;
}

export interface SleevesData {
  productMaster: SleeveProduct[];
  sleevePricing: SleevePricingTier[];
  framePricing: FramePricingTier[];
  crossWireRules: CrossWireRule[];
  sleeveCartonQty: SleeveCartonQty[];
}

const loadAndParseCsv = async <T>(filePath: string): Promise<T[]> => {
  const response = await fetch(filePath);
  const csvText = await response.text();
  return new Promise<T[]>((resolve, reject) => {
    Papa.parse<T>(csvText, {
      header: true,
      dynamicTyping: true,
      complete: (results) => resolve(results.data),
      error: (error: any) => reject(error),
    });
  });
};

export const loadSleevesData = async (): Promise<SleevesData> => {
  const [productMaster, sleevePricing, framePricing, crossWireRules, sleeveCartonQty] = await Promise.all([
    loadAndParseCsv<SleeveProduct>('/src/data/SleevesData/csv/SleevesProductMaster.csv'),
    loadAndParseCsv<SleevePricingTier>('/src/data/SleevesData/csv/SleevesSleevePricing.csv'),
    loadAndParseCsv<FramePricingTier>('/src/data/SleevesData/csv/SleevesFramePricing.csv'),
    loadAndParseCsv<CrossWireRule>('/src/data/SleevesData/csv/SleevesCrossWireRules.csv'),
    loadAndParseCsv<SleeveCartonQty>('/src/data/SleevesData/csv/SleevesCartonQty.csv'),
  ]);

  return { productMaster, sleevePricing, framePricing, crossWireRules, sleeveCartonQty };
};