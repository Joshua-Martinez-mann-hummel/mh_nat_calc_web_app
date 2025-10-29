// Based on the template from src/logic/sleevesLogic.ts
import type {
  PadsInputs,
  PadsData,
  PadsResult,
} from '../data/PadsData/padsDataTypes.ts';

// The inputs now include the 'option' which is managed separately in the component state
export interface PadsInputsWithOption {
  productName: string;
  option: 'Standard' | 'Antimicrobial' | string;
  widthWhole: number;
  widthFraction: number;
  lengthWhole: number;
  lengthFraction: number;
}

/**
 * The main calculation engine for Pads.
 */
export const calculatePads = (inputs: PadsInputsWithOption, data: PadsData): PadsResult => {
  // --- Initialization & Input Processing ---
  const { productName, option, widthWhole, widthFraction, lengthWhole, lengthFraction } = inputs;
  const { productInfo, fractionalCodes, padPricing, priceExceptions, cartonQty: cartonQtyData } = data;

  const errors: string[] = [];
  const debugInfo: any = {};
  const result: PadsResult = {
    partNumber: 'N/A',
    price: 0,
    cartonQty: 0,
    cartonPrice: 0,
    errors,
    debugInfo,
  };

  // --- Part 1: Get Product Info & Validation ---
  const currentProductInfo = productInfo.get(productName);
  debugInfo.priceCalculation = [
    { Step: 'Get Product Info', Value: `Found: ${currentProductInfo ? 'Yes' : 'No'}`, Details: currentProductInfo },
  ];

  if (!currentProductInfo) {
    errors.push('Selected product not found.');
    console.log('[PadsLogic Debug Info]', debugInfo);
    return result;
  }

  // Validate Option
  if (option === 'Antimicrobial' && !currentProductInfo.atOptionAvailable) {
    const errorMsg = `Antimicrobial option is not available for ${inputs.productName}.`;
    errors.push(errorMsg);
    debugInfo.priceCalculation.push({ Step: 'Validation', Value: 'Failed', Details: errorMsg });
  }
  const { prefix, atOptionAvailable, min, max } = currentProductInfo;
  
  const totalWidth = widthWhole + widthFraction;
  const totalLength = lengthWhole + lengthFraction;
  debugInfo.priceCalculation.push(
    { Step: 'Calculate Dimensions', Value: `Width: ${totalWidth}, Length: ${totalLength}`, Details: `Using ${widthWhole} + ${widthFraction} and ${lengthWhole} + ${lengthFraction}` }
  );

  const specialWidthRules = new Map([
    ['130', 70], // #3 Pad
    ['132', 84], // #5 Pad
    ['134', 96], // #7 Pad
    ['170', 78], // #8 Pad
  ]);
  const baseMaxWidth = specialWidthRules.get(prefix) ?? max;
  const baseMin = min;
  const baseMaxLength = max;
  debugInfo.priceCalculation.push({ Step: 'Get Validation Rules', Value: `Base Max W: ${baseMaxWidth}, Base Min: ${baseMin}, Base Max L: ${baseMaxLength}`, Details: `Special width rule applied: ${specialWidthRules.has(prefix)}` });

  // --- Validation Logic ---
  // First, check against the strict base limits.
  if (totalWidth > baseMaxWidth || totalWidth < baseMin) {
    // If the strict check fails, perform a second check with tolerance.
    if (totalWidth > (baseMaxWidth + 0.25) || totalWidth < (baseMin - 0.25)) {
      errors.push(`Width is out of range (${baseMin}" to ${baseMaxWidth}").`);
    } else {
      debugInfo.priceCalculation.push({ Step: 'Tolerance Check', Value: 'Passed', Details: `Width ${totalWidth}" is within tolerance of ${baseMin}"-${baseMaxWidth}"` });
    }
  }
  if (totalLength > baseMaxLength || totalLength < baseMin) {
    // If the strict check fails, perform a second check with tolerance.
    if (totalLength > (baseMaxLength + 0.25) || totalLength < (baseMin - 0.25)) {
      errors.push(`Length is out of range (${baseMin}" to ${baseMaxLength}").`);
    } else {
      debugInfo.priceCalculation.push({ Step: 'Tolerance Check', Value: 'Passed', Details: `Length ${totalLength}" is within tolerance of ${baseMin}"-${baseMaxLength}"` });
    }
  }

  // --- Part 2: Part Number Generation (runs even if validation fails) ---
  const piece1_prefix = prefix;
  const piece2_widthInt = widthWhole.toString().padStart(2, '0');
  const piece3_widthFrac = fractionalCodes.get(widthFraction) ?? '';
  const piece4_lengthInt = lengthWhole.toString().padStart(2, '0');
  const piece5_lengthFrac = fractionalCodes.get(lengthFraction) ?? '';
  const piece6_optionSuffix = option === 'Antimicrobial' ? 'AT' : '';
  debugInfo.partNumberGeneration = [
    { Piece: '1: Prefix', Value: piece1_prefix },
    { Piece: '2: Width (Int)', Value: piece2_widthInt },
    { Piece: '3: Width (Frac)', Value: piece3_widthFrac },
    { Piece: '4: Length (Int)', Value: piece4_lengthInt },
    { Piece: '5: Length (Frac)', Value: piece5_lengthFrac },
    { Piece: '6: Option Suffix', Value: piece6_optionSuffix },
  ];

  const partNumber = `${piece1_prefix}${piece2_widthInt}${piece3_widthFrac}${piece4_lengthInt}${piece5_lengthFrac}${piece6_optionSuffix}`;
  result.partNumber = partNumber;

  // --- Part 3: Price & Carton Qty Logic (The Override Path) ---
  let price = 0;
  let cartonQty = 0;

  const isStandardPart = widthFraction === 0 && lengthFraction === 0 && option === 'Standard';
  debugInfo.isStandardPartCheck = isStandardPart;

  if (isStandardPart) {
    // The key in the CSV is just the numeric part number
    const partNumberKey = `${prefix}${widthWhole.toString().padStart(2, '0')}${lengthWhole.toString().padStart(2, '0')}`;
    debugInfo.priceCalculation.push({ Step: 'Override Check', Value: 'Is Standard Part', Details: `Checking key: ${partNumberKey}` });

    const exceptionValue = priceExceptions.get(partNumberKey);

    if (exceptionValue) {
      debugInfo.priceCalculation.push({ Step: 'Override Found', Value: exceptionValue, Details: 'Calculation will stop here.' });
      errors.push(exceptionValue); // Add the message to errors/notes
      result.price = 0;
      cartonQty = currentProductInfo.standardCartonQty;
      result.cartonQty = cartonQty;
      console.log('[PadsLogic Debug Info]', debugInfo);
      return result; // Return immediately as this is an override
    }
  }

  // If validation failed earlier, return now before doing custom calcs
  // We ONLY stop for "hard" errors (like option validation), not "soft" dimension warnings.
  const hardErrors = errors.filter(e => e.includes('Antimicrobial')); // Add any other "hard" errors here
  if (hardErrors.length > 0) {
    debugInfo.priceCalculation.push({ Step: 'Validation Failed', Value: 'Stopping calculation', Details: hardErrors.join(', ') });
    console.log('[PadsLogic Debug Info]', debugInfo);
    return result;
  }

  // --- Part 4: Price & Carton Qty Logic (The "Custom" Fallback) ---
  const { qtyUnder26, universalLengthTiers } = cartonQtyData;
  if (qtyUnder26.has(prefix)) {
    if (totalLength < 26) {
      cartonQty = qtyUnder26.get(prefix) ?? 0;
      debugInfo.priceCalculation.push({ Step: 'Carton Qty', Value: cartonQty, Details: 'Used "Under 26" rule' });
    } else {
      const tier = universalLengthTiers.find(t => lengthWhole <= t.to);
      if (tier) {
        cartonQty = tier.qty;
        debugInfo.priceCalculation.push({ Step: 'Carton Qty', Value: cartonQty, Details: `Used "Over 26" rule with lengthWhole=${lengthWhole}, tier ${tier.from}-${tier.to}` });
      } else {
        errors.push('Length is out of range for carton quantity.');
      }
    }
  } else {
    errors.push('Carton quantity rules not found for this product.');
  }
  result.cartonQty = cartonQty;

  const faceValue = totalWidth * totalLength;
  debugInfo.priceCalculation.push({ Step: 'Calculate Face Value', Value: faceValue, Details: `${totalWidth} * ${totalLength}` });

  const priceList = padPricing[prefix];
  const priceColumn = option === 'Antimicrobial' ? 'at' : 'standard';
  const relevantPriceList = priceList?.[priceColumn];
  const priceTier = relevantPriceList?.find(tier => faceValue >= tier.from && faceValue <= tier.to);
  debugInfo.priceCalculation.push({ Step: 'Find Price Tier', Value: `Using '${priceColumn}' list`, Details: priceTier });

  if (priceTier) {
    price = option === 'Antimicrobial' ? (priceTier.atPrice ?? 0) : priceTier.standardPrice;
    if (price === 0) errors.push('Price not available for this option.');
  } else {
    errors.push('Price not found for these dimensions.');
  }

  // --- Part 5: Finalization ---
  // Assign prices first, so the result object has them *even if* there are soft warnings.
  result.price = parseFloat(price.toFixed(2));
  debugInfo.priceCalculation.push({ Step: 'Final Price', Value: result.price, Details: `Raw price: ${price}` });
  result.cartonPrice = parseFloat((result.price * result.cartonQty).toFixed(2));
  debugInfo.priceCalculation.push({ Step: 'Final Carton Price', Value: result.cartonPrice, Details: `${result.price} (price) * ${result.cartonQty} (cartonQty)` });

  // Now, if there were *any* errors (including soft warnings), log and return.
  // The result object now correctly contains BOTH the price AND the error.
  if (errors.length > 0) {
    console.log('[PadsLogic Debug Info]', debugInfo);
    return result;
  }

  console.log('[PadsLogic Debug Info]', debugInfo);
  return result;
};