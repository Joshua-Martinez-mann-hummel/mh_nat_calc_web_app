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
import { parseCsvFromUrl } from './csvParser';

// Import CSV files as URL assets
import sleevesProductMasterUrl from '/src/data/SleevesData/SleevesProductMaster.csv?url';
import sleevesSleevePricingUrl from '/src/data/SleevesData/SleevesPricing.csv?url';
import sleevesFramePricingUrl from '/src/data/SleevesData/SleevesFramePricing.csv?url';
import sleevesCrossWireRulesUrl from '/src/data/SleevesData/SleevesCrossWireRules.csv?url';
import sleevesCartonQtyUrl from '/src/data/SleevesData/SleevesCartonQty.csv?url';
import sleevesFractionalCodesUrl from '/src/data/SleevesData/SleevesFractionalCodes.csv?url';
import sleevesValidationRulesUrl from '/src/data/SleevesData/SleevesValidationRules.csv?url';
import priceExceptionsUrl from '/src/data/PadsData/PadsPriceExceptions.csv?url';

const loadPriceExceptions = async (): Promise<Map<string, string>> => {
  const data = await parseCsvFromUrl<{ 'PART NUMBER': string; 'Return Value': string }>(priceExceptionsUrl);
  return new Map(data.map(item => [String(item['PART NUMBER']), String(item['Return Value'])]));
};

export const loadSleevesData = async (): Promise<SleevesData> => {
  const [productMaster, sleevePricing, framePricing, crossWireRules, sleeveCartonQty, fractionalCodes, validationRules, priceExceptions] = await Promise.all([
    parseCsvFromUrl<SleeveProduct>(sleevesProductMasterUrl),
    parseCsvFromUrl<SleevePricingTier>(sleevesSleevePricingUrl),
    parseCsvFromUrl<FramePricingTier>(sleevesFramePricingUrl),
    parseCsvFromUrl<CrossWireRule>(sleevesCrossWireRulesUrl),
    parseCsvFromUrl<SleeveCartonQty>(sleevesCartonQtyUrl),
    parseCsvFromUrl<SleeveFractionalCode>(sleevesFractionalCodesUrl),
    parseCsvFromUrl<SleeveValidationRule>(sleevesValidationRulesUrl),
    loadPriceExceptions(),
  ]);

  return { productMaster, sleevePricing, framePricing, crossWireRules, sleeveCartonQty, fractionalCodes, validationRules, priceExceptions };
};