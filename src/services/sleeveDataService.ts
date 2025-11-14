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

export const loadSleevesData = async (): Promise<SleevesData> => {
  const [productMaster, sleevePricing, framePricing, crossWireRules, sleeveCartonQty, fractionalCodes, validationRules] = await Promise.all([
    parseCsvFromUrl<SleeveProduct>(sleevesProductMasterUrl),
    parseCsvFromUrl<SleevePricingTier>(sleevesSleevePricingUrl),
    parseCsvFromUrl<FramePricingTier>(sleevesFramePricingUrl),
    parseCsvFromUrl<CrossWireRule>(sleevesCrossWireRulesUrl),
    parseCsvFromUrl<SleeveCartonQty>(sleevesCartonQtyUrl),
    parseCsvFromUrl<SleeveFractionalCode>(sleevesFractionalCodesUrl),
    parseCsvFromUrl<SleeveValidationRule>(sleevesValidationRulesUrl),
  ]);

  return { productMaster, sleevePricing, framePricing, crossWireRules, sleeveCartonQty, fractionalCodes, validationRules };
};