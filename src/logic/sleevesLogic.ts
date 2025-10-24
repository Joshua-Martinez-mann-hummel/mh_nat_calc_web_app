import type { SleevesData } from '../data/SleevesData/sleevesDataTypes';

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

  // Get Product Info
  const productInfo = productMaster.find((p) => p.productName === productName);
  debugInfo.productInfo = productInfo;

  if (!productInfo) {
    errors.push('Selected product not found.');
    return result;
  }

  const productPrefix = productInfo.prefix;
  const validOptions = productInfo.options.split(',');
  debugInfo.productPrefix = productPrefix;
  debugInfo.validOptions = validOptions;

  // Calculate Total Dimensions
  const totalWidth = widthWhole + widthFraction;
  const totalLength = lengthWhole + lengthFraction;
  debugInfo.totalWidth = totalWidth;
  debugInfo.totalLength = totalLength;

  // Step 2.2: Run Validation Logic (The "Guardrails")
  // 1. Check Option
  if (!validOptions.includes(option)) {
    errors.push('Invalid option for this product.');
  }

  // 2. Check Min/Max Rules
  const rules = validationRules.find(r => r.prefix.toString() === productPrefix.toString());
  if (rules) {
    if (totalWidth < rules.minWidth) errors.push(`Width is below minimum of ${rules.minWidth}".`);
    if (totalWidth > rules.maxWidth) errors.push(`Width is above maximum of ${rules.maxWidth}".`);
    if (totalLength < rules.minLength) errors.push(`Length is below minimum of ${rules.minLength}".`);
    if (totalLength > rules.maxLength) errors.push(`Length is above maximum of ${rules.maxLength}".`);
  }
  debugInfo.validationRules = rules;

  // 3. Stop if Invalid
  if (errors.length > 0) {
    return result;
  }

  const isFrame = productName.includes('Frame');
  debugInfo.isFrame = isFrame;

  // Step 2.3: Logic Path 1 - Part Number Generation
  const piece1_prefix = productPrefix;
  const piece2_widthInt = widthWhole.toString().padStart(2, '0');
  const widthFracRow = fractionalCodes.find((f) => f.DecimalValue === widthFraction);
  const piece3_widthFrac = widthFracRow?.LetterCode ?? '';
  const piece4_lengthInt = lengthWhole.toString().padStart(2, '0');
  const lengthFracRow = fractionalCodes.find((f) => f.DecimalValue === lengthFraction);
  const piece5_lengthFrac = lengthFracRow?.LetterCode ?? '';
  const piece6_optionSuffix = option === 'Standard' ? '' : 'AT';

  let piece7_frameSuffix = '';
  if (productPrefix === '072') {
    const maxDim = Math.max(widthWhole, lengthWhole);
    const wireRule = crossWireRules.find((r) => maxDim <= r.maxDim);
    if (wireRule) {
      const wires = wireRule.wires;
      piece7_frameSuffix = `-${wires}CW`;
    }
  }

  const partNumber = `${piece1_prefix}${piece2_widthInt}${piece3_widthFrac}${piece4_lengthInt}${piece5_lengthFrac}${piece6_optionSuffix}${piece7_frameSuffix}`;

  debugInfo.partNumberPieces = {
    piece1_prefix,
    piece2_widthInt,
    piece3_widthFrac,
    piece4_lengthInt,
    piece5_lengthFrac,
    piece6_optionSuffix,
    piece7_frameSuffix,
  };
  debugInfo.partNumber = partNumber;

  // --- 3. Price Calculation ---
  let price = 0;
  const faceValue = Math.round(totalWidth * totalLength);
  debugInfo.faceValue = faceValue;

  if (isFrame) {
    // Step 2.5: Logic Path 3 - Price Calculation (Frames)
    let widthGroup: 'group1' | 'group2' | 'group3' | '' = '';
    if (widthWhole > 4 && widthWhole <= 8.88) widthGroup = 'group1';
    else if (widthWhole > 8.88 && widthWhole <= 16.875) widthGroup = 'group2';
    else if (widthWhole > 16.875 && widthWhole <= 33.25) widthGroup = 'group3';
    debugInfo.frameWidthGroup = widthGroup;

    if (widthGroup) {
      const pricingTiers = framePricing.filter((p) => p.group === widthGroup);
      const priceTier = pricingTiers.find((t) => faceValue <= t.rangeTo);
      debugInfo.framePriceTier = priceTier;
      if (priceTier) {
        price = priceTier.price;
      } else {
        errors.push('Frame dimensions out of range for pricing.');
      }
    } else {
      errors.push('Frame width is out of range.');
    }

    // Cross-wire logic for frames
    const maxDim = Math.max(totalWidth, totalLength);
    const wireRule = crossWireRules.find((r) => maxDim <= r.maxDim);
    const wireCost = wireRule ? wireRule.wires * 0.25 : 0; // Assuming $0.25 per wire
    price += wireCost;
    debugInfo.wireRule = wireRule;
    debugInfo.wireCost = wireCost;
  } else {
    // Step 2.5: Logic Path 3 - Price Calculation (Sleeves)
    const priceColumn = option === 'Antimicrobial' ? 'atPrice' : 'standardPrice';
    debugInfo.sleevePriceColumn = priceColumn;

    const priceTier = sleevePricing.find((t) => faceValue >= t.from && faceValue <= t.to);
    debugInfo.sleevePriceTier = priceTier;

    if (priceTier) {
      price = priceTier[priceColumn];
    } else {
      errors.push('Sleeve dimensions out of range for pricing.');
    }
  }

  debugInfo.initialPrice = price;

  // Step 2.4: Logic Path 2 - Carton Qty Calculation
  let cartonQty = 0;
  if (productPrefix === '072') {
    // 1. If prefix is "072" (Frame)
    cartonQty = 1;
    debugInfo.cartonQtySource = 'Frame default';
  } else {
    // 2. If prefix is "070" (Sleeve)
    const cartonTier = sleeveCartonQty.find((t) => lengthWhole <= t.maxLength);
    debugInfo.cartonTier = cartonTier;
    if (cartonTier) {
      cartonQty = cartonTier.qty;
    } else {
      errors.push('Sleeve length is out of range for carton quantity.');
    }
  }

  // If there are errors, return the initial result object with the errors array populated.
  // Otherwise, populate the result object with the calculated values.
  if (errors.length > 0) {
    return result;
  }

  // Step 2.6: Logic Path 4 - Final Calculation
  result.partNumber = partNumber;
  result.price = price;
  result.cartonQty = cartonQty;
  result.cartonPrice = result.price * result.cartonQty;

  // Format prices to 2 decimal places
  result.price = parseFloat(result.price.toFixed(2));
  result.cartonPrice = parseFloat(result.cartonPrice.toFixed(2));

  // Step 2.7: Return Result
  return result;
};