import type { SleevesData } from '../data/SleevesData/sleevesDataTypes.js';

export interface SleeveInputs {
  productName: string;
  option: string;
  widthWhole: number;
  widthFraction: number;
  lengthWhole: number;
  lengthFraction: number;
}

export interface SleeveResult {
  partNumber: string;
  price: number;
  cartonQty: number;
  cartonPrice: number;
  errors: string[];
  debugInfo: object;
}

/**
 * The main calculation engine for Sleeves and Frames.
 *
 * @param {SleeveInputs} inputs - The user's selections.
 * @param {SleevesData} data - The loaded data from CSV files.
 * @returns {SleeveResult} The calculated quote.
 */
export const calculateSleeves = (inputs: SleeveInputs, data: SleevesData): SleeveResult => {
  // Step 2.1: Initialization & Input Processing
  console.log('[SleevesLogic] Starting calculation with inputs:', inputs);
  const { productName, option, widthWhole, widthFraction, lengthWhole, lengthFraction } = inputs; // Get Inputs
  const { productMaster, fractionalCodes, sleevePricing, framePricing, crossWireRules, sleeveCartonQty, validationRules } = data; // Get Data

  // Initialize
  const errors: string[] = [];
  const debugInfo: any = {};
  const result: SleeveResult = {
    partNumber: 'N/A',
    price: 0,
    cartonQty: 0,
    cartonPrice: 0,
    errors,
    debugInfo,
  };
  console.log('[SleevesLogic] Initial result object created.');

  // Get Product Info
  const productInfo = productMaster.find((p) => p.productName === productName);
  debugInfo.productInfo = productInfo;
  console.log('[SleevesLogic] Found productInfo:', productInfo);

  if (!productInfo) {
    errors.push('Selected product not found.');
    return result;
  }

  // Ensure prefix is a 3-character string with leading zeros (e.g., 72 -> "072")
  const productPrefix = productInfo.prefix.toString().padStart(3, '0');
  const validOptions = productInfo.options.split(',');
  debugInfo.productPrefix = productPrefix;
  debugInfo.validOptions = validOptions;
  console.log(`[SleevesLogic] Product Prefix: ${productPrefix}, Valid Options: ${validOptions}`);

  // Calculate Total Dimensions
  const totalWidth = widthWhole + widthFraction;
  const totalLength = lengthWhole + lengthFraction;
  debugInfo.totalWidth = totalWidth;
  debugInfo.totalLength = totalLength;
  console.log(`[SleevesLogic] Total Dimensions: ${totalWidth}W x ${totalLength}L`);

  // Step 2.3: Logic Path 1 - Part Number Generation (Moved Up)
  // Generate the part number as early as possible.
  const piece1_prefix = productPrefix;
  const piece2_widthInt = widthWhole.toString().padStart(2, '0');
  const widthFracRow = fractionalCodes.find((f) => f.DecimalValue === widthFraction);
  const piece3_widthFrac = widthFracRow?.LetterCode ?? '';
  const piece4_lengthInt = lengthWhole.toString().padStart(2, '0');
  const lengthFracRow = fractionalCodes.find((f) => f.DecimalValue === lengthFraction);
  const piece5_lengthFrac = lengthFracRow?.LetterCode ?? '';
  const piece6_optionSuffix = option === 'Standard' ? '' : 'AT';

  // This must be calculated here, before validation, to ensure it's part of the part number on error.
  let piece7_frameSuffix = '';
  if (productPrefix === '072') {
    const maxDim = Math.max(widthWhole, lengthWhole);
    const wireRule = crossWireRules.find((r) => maxDim <= r.maxDim);
    const wires = wireRule ? wireRule.wires : '';
    piece7_frameSuffix = `-${wires}CW`;
  }
  console.log(`[SleevesLogic] Part Number Pieces:`, { piece1_prefix, piece2_widthInt, piece3_widthFrac, piece4_lengthInt, piece5_lengthFrac, piece6_optionSuffix, piece7_frameSuffix });

  const partNumber = `${piece1_prefix}${piece2_widthInt}${piece3_widthFrac}${piece4_lengthInt}${piece5_lengthFrac}${piece6_optionSuffix}${piece7_frameSuffix}`;
  // Immediately update the result object with the generated part number.
  result.partNumber = partNumber;
  debugInfo.partNumber = partNumber;

  // Step 2.2: Run Validation Logic (The "Guardrails")
  // 1. Check Option
  if (!validOptions.includes(option)) {
    errors.push('Invalid option for this product.');
  }

  // 2. Check Min/Max Rules
  const rules = validationRules.find(r => r.prefix.toString().padStart(3, '0') === productPrefix);
  console.log('[SleevesLogic] Applying validation rules:', rules);
  if (rules) {
    if (totalWidth < rules.minWidth) errors.push(`Width is below minimum of ${rules.minWidth}".`);
    if (totalWidth > rules.maxWidth) errors.push(`Width is above maximum of ${rules.maxWidth}".`);
    if (totalLength < rules.minLength) errors.push(`Length is below minimum of ${rules.minLength}".`);
    if (totalLength > rules.maxLength) errors.push(`Length is above maximum of ${rules.maxLength}".`);
  }
  debugInfo.validationRules = rules;

  // 3. Stop if Invalid
  if (errors.length > 0) {
    console.error('[SleevesLogic] Validation failed. Errors:', errors);
    return result;
  }

  // --- 3. Price Calculation ---
  let price = 0;
  const faceValue = Math.round(totalWidth * totalLength);
  debugInfo.faceValue = faceValue;
  console.log(`[SleevesLogic] Calculated Face Value: ${faceValue}`);

  if (productPrefix === '072') {
    debugInfo.isFrame = true;
    // Step 2.5: Logic Path 3 - Price Calculation (Frames)
    let widthGroup: 'group1' | 'group2' | 'group3' | '' = '';
    console.log('[SleevesLogic] Entering FRAME pricing logic.');
    if (widthWhole >= 4 && widthWhole <= 8.88) widthGroup = 'group1';
    else if (widthWhole > 8.88 && widthWhole <= 16.875) widthGroup = 'group2';
    else if (widthWhole > 16.875 && widthWhole <= 33.25) widthGroup = 'group3';
    debugInfo.frameWidthGroup = widthGroup;

    if (widthGroup) {
      const pricingTiers = framePricing.filter((p) => p.group === widthGroup);
      const priceTier = pricingTiers.find((t) => faceValue <= t.rangeTo);
      console.log(`[SleevesLogic] Frame Width Group: ${widthGroup}. Found Price Tier:`, priceTier);
      if (priceTier && typeof priceTier.price === 'number') {
        price = priceTier.price;
      } else if (priceTier) {
        errors.push('Price not found for this frame tier.');
      } else {
        errors.push('Frame dimensions out of range for pricing.');
      }
    } else {
      errors.push('Frame width is out of range.');
    }
  } else if (productPrefix === '070') {
    debugInfo.isFrame = false;
    console.log('[SleevesLogic] Entering SLEEVE pricing logic.');
    // Step 2.5: Logic Path 3 - Price Calculation (Sleeves)
    const priceColumn = option === 'Antimicrobial' ? 'atPrice' : 'standardPrice';
    debugInfo.sleevePriceColumn = priceColumn;

    const priceTier = sleevePricing.find((t) => faceValue >= t.from && faceValue <= t.to);

    if (priceTier) {
      const foundPrice = priceTier[priceColumn];
      if (typeof foundPrice === 'number') {
        price = foundPrice;
      } else {
        errors.push(`Price for ${option} option not found in this tier.`);
      }
    } else {
      errors.push('Sleeve dimensions out of range for pricing.');
    }
  }

  debugInfo.initialPrice = price;
  console.log(`[SleevesLogic] Initial price before adjustments: ${price}`);

  // Step 2.4: Logic Path 2 - Carton Qty Calculation
  let cartonQty = 0;
  if (productPrefix === '072') {
    // 1. If prefix is "072" (Frame)
    cartonQty = 1;
    console.log('[SleevesLogic] Carton Qty for Frame is 1.');
    debugInfo.cartonQtySource = 'Frame default';
  } else {
    // 2. If prefix is "070" (Sleeve)
    const cartonTier = sleeveCartonQty.find((t) => lengthWhole <= t.maxLength);
    console.log('[SleevesLogic] Found Carton Qty Tier for Sleeve:', cartonTier);
    debugInfo.cartonTier = cartonTier;
    if (cartonTier) {
      cartonQty = cartonTier.qty;
    } else {
      errors.push('Sleeve length is out of range for carton quantity.');
    }
  }

  result.cartonQty = cartonQty;
  console.log(`[SleevesLogic] Final Carton Qty: ${cartonQty}`);

  // If there are errors, return now before setting final price.
  // The part number and carton quantity will be preserved in the result.
  if (errors.length > 0) {
    console.error('[SleevesLogic] Pricing/Carton failed. Errors:', errors);
    return result;
  }

  // Step 2.6: Logic Path 4 - Final Calculation
  result.price = price;

  // Format prices to 2 decimal places
  result.price = parseFloat(price.toFixed(2));
  const cartonPrice = price * cartonQty;
  result.cartonPrice = parseFloat(cartonPrice.toFixed(2));

  // Step 2.7: Return Result
  console.log('[SleevesLogic] Calculation complete. Final result:', result);
  return result;
};