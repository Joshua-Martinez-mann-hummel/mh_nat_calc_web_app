/**
 * @file The core calculation engine for the Panels-Links calculator.
 * This file contains the primary logic for determining part number, price,
 * and other quote details based on user inputs and loaded CSV data.
 * The architecture mirrors that of the other logic engines in the application.
 */

import type {
  PanelsLinksInputs,
  PanelsLinksData,
  PanelsLinksResult,
  PanelCustomPriceRow,
} from '../data/PanelsData/panelsDataTypes.ts';

/**
 * Parses the dimension rule strings from the custom pricing CSV (e.g., "<25", ">25;<48").
 * @param rule The rule string to parse.
 * @param value The dimension value to check against the rule.
 * @returns True if the value satisfies the rule, false otherwise.
 */
const checkDimensionRule = (rule: string, value: number): boolean => {
  if (rule === 'ALL') {
    // console.log(`[PanelsLogic]     [RuleCheck] Rule is 'ALL', matches value '${value}'.`);
    return true;
  }
  const rules = rule.split(';');
  return rules.every((r) => {
    const operator = r.match(/^[<>=]+/)?.[0];
    const limit = parseFloat(r.replace(/^[<>=]+/, ''));
    if (!operator || isNaN(limit)) return false;

    if (operator === '>=') return value >= limit;
    if (operator === '<=') return value <= limit;
    if (operator === '>') return value > limit;
    if (operator === '<') return value < limit;
    return false; // Should not happen with valid rule strings
  });
};

/**
 * Parses a dimension rule and returns a "relaxed" version that *only* contains
 * the upper-bound checks (rules starting with '<').
 * @param rule The rule string (e.g., ">34;<78")
 * @param value The dimension value to check.
 * @returns True if the value satisfies the *relaxed* (upper-bound only) rule.
 */
const checkRelaxedDimensionRule = (rule: string, value: number): boolean => {
  if (rule === 'ALL') return true;

  const rules = rule.split(';');

  // Find only the "less than" rules
  const lessThanRules = rules.filter(r => r.startsWith('<'));

  // If there were no "less than" rules (e.g., rule was just ">34"),
  // we can't relax it, so it fails.
  if (lessThanRules.length === 0) {
    return false;
  }

  // Use the *existing* checkDimensionRule function on this new, relaxed rule
  return checkDimensionRule(lessThanRules.join(';'), value);
};

/**
 * Helper function to find the correct custom price from the price list.
 * It filters the list based on product type, dimensions, and face value.
 */
const findCustomPrice = (
  customPriceList: PanelCustomPriceRow[],
  prefix: string,
  totalHeight: number,
  totalWidth: number,
  faceValue: number
): { priceCustomStandard: number; PriceCustomAt: string } | null => {
  console.log(`[PanelsLogic]   [findCustomPrice] Searching for match with: prefix='${prefix}', H=${totalHeight}, W=${totalWidth}, FaceValue=${faceValue}`);

  const matchingRow = customPriceList.find((row) => {
    const isTypeMatch = row.type === prefix;
    if (!isTypeMatch) return false;

    // Check FaceValue first
    const isFaceValueMatch = faceValue >= row.rangeFrom && faceValue <= row.rangeTo;

    // Stop early if Type or FaceValue don't match
    if (!isFaceValueMatch) {
      return false;
    }

    console.log(`[PanelsLogic]     [findCustomPrice] Checking row for type '${row.type}' (H rule: '${row.height}', W rule: '${row.width}', Face range: ${row.rangeFrom}-${row.rangeTo})`);

    // Get the initial match results
    let isHeightMatch = checkDimensionRule(row.height, totalHeight);
    let isWidthMatch = checkDimensionRule(row.width, totalWidth);

    // --- START GENERALIZED FIX ---

    // This condition checks for:
    // 1. FaceValue matched
    // 2. EITHER Height or Width matched
    // 3. But NOT BOTH (meaning one of them failed)
    const isPartialDimensionMatch = isFaceValueMatch && (isHeightMatch || isWidthMatch) && !(isHeightMatch && isWidthMatch);

    if (isPartialDimensionMatch) {
      if (!isHeightMatch) {
        // Height failed, Width passed. Let's try relaxing the Height rule.
        console.log(`[PanelsLogic]       [findCustomPrice] W/Face matched but H failed. Retrying H with relaxed lower bound.`);
        isHeightMatch = checkRelaxedDimensionRule(row.height, totalHeight);
      } else { // !isWidthMatch
        // Width failed, Height passed. Let's try relaxing the Width rule.
        console.log(`[PanelsLogic]       [findCustomPrice] H/Face matched but W failed. Retrying W with relaxed lower bound.`);
        isWidthMatch = checkRelaxedDimensionRule(row.width, totalWidth);
      }
    }
    // --- END GENERALIZED FIX ---

    console.log(`[PanelsLogic]         -> Height Match? ${isHeightMatch}, Width Match? ${isWidthMatch}, Face Value Match? ${isFaceValueMatch}`);

    // Final check: all three must be true to be a match
    return isHeightMatch && isWidthMatch && isFaceValueMatch;
  });

  if (matchingRow) {
    console.log(`[PanelsLogic]   [findCustomPrice] ✅ Found a matching row:`, matchingRow);
  }

  if (matchingRow) {
    return {
      priceCustomStandard: matchingRow.priceCustomStandard,
      PriceCustomAt: matchingRow.PriceCustomAt,
    };
  }

  return null;
};

/**
 * The main calculation engine for Panels and Links.
 *
 * @param {PanelsLinksInputs} inputs - The user's selections from the form.
 * @param {PanelsLinksData} data - The loaded data from all related CSV files.
 * @returns {PanelsLinksResult} The final calculated quote.
 */
export const calculatePanelsLinks = (
  inputs: PanelsLinksInputs,
  data: PanelsLinksData
): PanelsLinksResult => {
  // 1. Initialization
  console.log('[PanelsLogic] Starting calculation with inputs:', inputs);
  const debugInfo: any = {};
  const {
    productFamily,
    addOn,
    type,
    numberOfPanels,
    isExact,
    heightWhole,
    heightFraction,
    widthWhole,
    widthFraction,
  } = inputs;

  const {
    productInfo,
    standardOverrides,
    customPriceList,
    fractionalCodes,
    linkTiers,
  } = data;

  const errors: string[] = [];
  const result: PanelsLinksResult = {
    partNumber: 'N/A',
    price: 0,
    rangeOfLinkWidth: 'N/A',
    cartonQty: 0,
    cartonPrice: 0,
    errors,
    debugInfo,
  };
  console.log('[PanelsLogic] Initial result object created.');

  const totalHeight = heightWhole + heightFraction;
  const totalWidth = widthWhole + widthFraction;
  debugInfo.totalHeight = totalHeight;
  debugInfo.totalWidth = totalWidth;
  console.log(`[PanelsLogic] Total Dimensions: ${totalHeight}H x ${totalWidth}W`);
  const prefix = productInfo.get(productFamily);
  if (!prefix) {
    errors.push('Selected product family not found.');
    return result;
  }

  debugInfo.productPrefix = prefix;
  console.log(`[PanelsLogic] Found Product Prefix: ${prefix}`);

  // 2. Part Number Logic
  console.log('[PanelsLogic] Entering Part Number generation.');
  let partNumber = 'N/A';
  console.log(`[PanelsLogic] Retrieving fractional code for heightFraction: ${heightFraction}`);
  const heightFracCode = fractionalCodes.get(heightFraction) ?? '';
  console.log(`[PanelsLogic]   -> Found heightFracCode: '${heightFracCode}'`);
  console.log(`[PanelsLogic] Retrieving fractional code for widthFraction: ${widthFraction}`);
  const widthFracCode = fractionalCodes.get(widthFraction) ?? '';
  console.log(`[PanelsLogic]   -> Found widthFracCode: '${widthFracCode}'`);
  debugInfo.partNumberPieces = { heightFracCode, widthFracCode };

  if (type === 'Panel') {
    // Handle invalid combination: Tri-Dek FC Panel does not support Antimicrobial.
    if (productFamily === 'Tri-Dek FC Panel' && addOn === 'Antimicrobial') {
      partNumber = 'N/A';
      console.log('[PanelsLogic]   -> Invalid combination (FC Panel + AT). Part number is N/A.');
    } else if (addOn === 'Standard' || addOn === 'None (Standard)') {
      // Logic M26
      console.log('[PanelsLogic] Generating part number for type: Panel');
      const heightStr = heightWhole.toString().padStart(2, '0');
      console.log(`[PanelsLogic]   -> Padded height string (heightWhole: ${heightWhole}): '${heightStr}'`);
      const widthStr = widthWhole.toString().padStart(2, '0');
      console.log(`[PanelsLogic]   -> Padded width string (widthWhole: ${widthWhole}): '${widthStr}'`);
      const exactFlag = isExact ? 'E' : '';
      console.log(`[PanelsLogic]   -> Exact flag (isExact: ${isExact}): '${exactFlag}'`);
      debugInfo.partNumberPieces.heightStr = heightStr;
      debugInfo.partNumberPieces.widthStr = widthStr;
      debugInfo.partNumberPieces.exactFlag = exactFlag;

      if (totalHeight > totalWidth) {
        // Test Case #1: Keep the "cross-swap" logic
        console.log(`[PanelsLogic]   -> totalHeight (${totalHeight}) > totalWidth (${totalWidth}). Using cross-swap logic.`);
        partNumber = `${prefix}${widthStr}${heightFracCode}${exactFlag}${heightStr}${widthFracCode}${exactFlag}01`;
      } else {
        // Test Case #2: Use "normal" Height-then-Width logic
        console.log(`[PanelsLogic]   -> totalHeight (${totalHeight}) <= totalWidth (${totalWidth}). Using normal HxW logic.`);
        partNumber = `${prefix}${heightStr}${heightFracCode}${exactFlag}${widthStr}${widthFracCode}${exactFlag}01`;
      }
      console.log(`[PanelsLogic]   -> Assembled Panel part number (pre-AT): ${partNumber}`);
    } else {
      // For Antimicrobial panels, the part number is N/A.
      partNumber = 'N/A';
      console.log('[PanelsLogic]   -> AddOn is Antimicrobial, part number is N/A for Panels.');
    }
  } else if (type === 'Link') {
    // Handle invalid combination: Tri-Dek FC Panel does not support Antimicrobial.
    if (productFamily === 'Tri-Dek FC Panel' && addOn === 'Antimicrobial') {
      partNumber = 'N/A';
      console.log('[PanelsLogic]   -> Invalid combination (FC Panel + AT). Part number is N/A for Links.');
    } else {
      // Logic M27
      console.log('[PanelsLogic] Generating part number for type: Link');
      const linkSuffix = numberOfPanels.toString().padStart(2, '0');
      console.log(`[PanelsLogic]   -> Generated link suffix (numberOfPanels: ${numberOfPanels}): '${linkSuffix}'`);
      const exactFlag = isExact ? 'E' : '';
      console.log(`[PanelsLogic]   -> Exact flag (isExact: ${isExact}): '${exactFlag}'`);

      debugInfo.partNumberPieces.linkSuffix = linkSuffix;
      debugInfo.partNumberPieces.exactFlag = exactFlag;

      // Use a fixed Height-then-Width order.
      console.log('[PanelsLogic]   -> Assembling Link part number in fixed HxW order.');
      const heightStr = heightWhole.toString().padStart(2, '0');
      const widthStr = widthWhole.toString().padStart(2, '0');
      partNumber = `${prefix}${heightStr}${heightFracCode}${exactFlag}${widthStr}${widthFracCode}${exactFlag}${linkSuffix}`;
      if (addOn === 'Antimicrobial') {
        partNumber += 'AT';
        console.log(`[PanelsLogic]   -> Appending 'AT' for Antimicrobial. New part number: ${partNumber}`);
      }
    }
  }
  console.log(`[PanelsLogic] Final Part Number: ${partNumber}`);
  result.partNumber = partNumber;
  debugInfo.partNumber = partNumber;

  // 3. Price Logic (Two-Path System)
  console.log('--------------------------------');
  console.log('[PanelsLogic] Entering Price logic.');
  let price = 0;
  let pricePath: 'A' | 'B' | null = null;

  // Path A: Validation & Standard Overrides (Logic R46) - START REPLACEMENT
  const PRODUCT_MAX_TOTAL_HEIGHTS: { [key: string]: number } = {
    "Tri-Dek FC Panel": 24.875,
    "Tri-Dek 3/67 2-Ply": 51.25,
    "Tri-Dek 15/40 3-Ply": 51.25,
    "Tri-Dek 4-ply XL": 51.25,
  };

  console.log('[PanelsLogic] Checking validations.');
  // Per R46 logic, these validations ONLY apply to "Exact" parts.
  if (isExact) {
    console.log('[PanelsLogic] Part is "Exact", running validation checks.');
    const maxAllowedTotalHeight = PRODUCT_MAX_TOTAL_HEIGHTS[productFamily] ?? 77.25; // Default max total height
    debugInfo.validation = { maxAllowedTotalHeight };
    if (totalHeight > maxAllowedTotalHeight) {
      errors.push(`Over max height (${maxAllowedTotalHeight}").`);
    }
    if (totalWidth > 77.25) {
      errors.push('Over max width (77.25").');
    }
  }
  // This min check applies to all parts
  if (totalHeight < 3.25 || totalWidth < 3.25) {
    errors.push('Dimensions must be at least 3.25".');
  }

  // If validation failed, STOP before checking overrides.
  if (errors.length > 0) {
    pricePath = 'A'; // Set Path A so carton qty is 0
    debugInfo.pricePath = 'A';
    console.log(`[PanelsLogic] Validation failed. Errors: ${errors.join(', ')}`);
  }
  // --- END REPLACEMENT ---
  
  if (!isExact) {
    console.log('--------------------------------');
    console.log('[PanelsLogic] Path A: Checking for standard override (isExact is false).');
    const dimensionKey = `${heightWhole}X${widthWhole}`;
    const overrideValue = standardOverrides.get(dimensionKey);
    debugInfo.standardCheck = { dimensionKey, overrideValue: overrideValue ?? 'N/A' };
    console.log(`[PanelsLogic] Path A: DimensionKey='${dimensionKey}', OverrideValue='${overrideValue ?? 'N/A'}'`);

    if (overrideValue) {
      pricePath = 'A';
      debugInfo.pricePath = 'A';
      console.log('[PanelsLogic] Path A: Found override. Setting price path to A.');
      const parsedPrice = parseFloat(overrideValue);
      if (isNaN(parsedPrice)) {
        // Value is a string like "Standard Part #..."
        errors.push(overrideValue);
        console.error(`[PanelsLogic] Path A: Override value is not a number. Pushing error: ${overrideValue}`);
      } else {
        price = parsedPrice;
        console.log(`[PanelsLogic] Path A: Price set from override: ${price}`);
      }
    }
  }

  // Path B: Custom/Exact Fallback (Logic R27)
  if (pricePath === null) {
    console.log('--------------------------------');
    console.log('[PanelsLogic] Path A did not apply. Entering Path B for custom pricing.');
    pricePath = 'B';
    debugInfo.pricePath = 'B';
    const faceValue = Math.ceil(totalHeight * totalWidth);
    debugInfo.faceValue = faceValue;
    console.log(`[PanelsLogic] Path B: Calculated Face Value: ${faceValue}`);
    const customPrices = findCustomPrice(customPriceList, prefix, totalHeight, totalWidth, faceValue);

    if (customPrices) {
      debugInfo.customPriceLookup = customPrices;
      console.log('[PanelsLogic] Path B: Using matched custom price row to determine price.');
      if (addOn === 'Antimicrobial') {
        console.log('[PanelsLogic] Path B: Applying Antimicrobial pricing.');
        console.log(`[PanelsLogic] Path B:   -> Raw 'PriceCustomAt' value from sheet: '${customPrices.PriceCustomAt}'`);
        if (customPrices.PriceCustomAt === '$-') {
          errors.push('Antimicrobial not available for this custom size.');
          console.error('[PanelsLogic] Path B: Antimicrobial price is "$-". Pushing error.');
        } else {
          // Price might be a string like "$123.45" or just a number
          price = parseFloat(String(customPrices.PriceCustomAt).replace(/[^0-9.-]+/g, ''));
          console.log(`[PanelsLogic] Path B:   -> Parsed Antimicrobial price: ${price}`);
        }
      } else { // Standard
        console.log('[PanelsLogic] Path B: Applying Standard pricing.');
        console.log(`[PanelsLogic] Path B:   -> Raw 'priceCustomStandard' value from sheet: '${customPrices.priceCustomStandard}'`);
        // Explicitly parse to a float to guard against the value being a string.
        price = parseFloat(String(customPrices.priceCustomStandard));
        console.log(`[PanelsLogic] Path B:   -> Parsed Standard price: ${price}`);
      }
    } else {
      errors.push('Custom price not found for these dimensions.');
      console.error('[PanelsLogic] Path B: No matching custom price row found.');
    }

    // Link Multiplier
    if (type === 'Link') {
      console.log(`[PanelsLogic] Path B: Applying Link multiplier. Price before: ${price}, Panels: ${numberOfPanels}`);
      price *= numberOfPanels;
      console.log(`[PanelsLogic] Path B: Price after multiplier: ${price}`);
    }
  }

  // If errors occurred during pricing, set price to 0 but keep errors.
  if (errors.length > 0) {
    console.error(`[PanelsLogic] Errors found (${errors.join('; ')}). Setting final price to 0.`);
    price = 0;
  }

  debugInfo.finalPrice = price;
  result.price = parseFloat(price.toFixed(2));

  // 4. Range of Link Width
  if (type === 'Link') {
    console.log('[PanelsLogic] Calculating Range of Link Width.');
    const totalNominalWidth = widthWhole * numberOfPanels;
    debugInfo.totalNominalWidth = totalNominalWidth;

    // We must manually replicate the buggy Excel IF-chain instead of .find()
    // This data MUST be sorted by lengthMax ASC
    let btnPanels = 0;

    // --- START BUG FIX ---
    // Changed all logical checks from '<=' to '<' to match Excel's formula

    if (linkTiers.length > 0 && totalNominalWidth < linkTiers[0].lengthMax) { // Tier 1
      btnPanels = linkTiers[0].btnPanels;
    } else if (linkTiers.length > 1 && totalNominalWidth < linkTiers[1].lengthMax) { // Tier 2
      btnPanels = linkTiers[1].btnPanels;
    } else if (linkTiers.length > 2 && totalNominalWidth < linkTiers[2].lengthMax) { // Tier 3
      btnPanels = linkTiers[2].btnPanels;
    } else if (linkTiers.length > 3 && totalNominalWidth < linkTiers[3].lengthMax) { // Tier 4
      btnPanels = linkTiers[3].btnPanels;

    // --- BUG REPLICATION ---
    // This line replicates the Excel typo: M36-M47 instead of M36<M47
    // This logic stays the same.
    } else if (linkTiers.length > 4 && (totalNominalWidth - linkTiers[4].lengthMax) !== 0) { // Tier 5
      console.log('[PanelsLogic] Applying Excel typo logic for link tier 5.');
      btnPanels = linkTiers[4].btnPanels;
    // --- END BUG REPLICATION ---

    } else if (linkTiers.length > 5 && totalNominalWidth < linkTiers[5].lengthMax) { // Tier 6
      btnPanels = linkTiers[5].btnPanels;
    } else if (linkTiers.length > 6 && totalNominalWidth < linkTiers[6].lengthMax) { // Tier 7
      btnPanels = linkTiers[6].btnPanels;

    // Fallback for any tiers added past 7 (assumes no more bugs)
    } else if (linkTiers.length > 7) {
      const remainingTier = linkTiers.slice(7).find(t => totalNominalWidth < t.lengthMax); // Also changed to <
      if (remainingTier) {
        btnPanels = remainingTier.btnPanels;
      } else if (totalNominalWidth >= linkTiers[linkTiers.length - 1].lengthMax) { // Changed to >=
         // This is the "Exceeds max" case. The bug hides it, but we'll use the last tier's panel.
         console.log('[PanelsLogic] Width exceeds max; applying Excel bug fallback (using last tier).');
         btnPanels = linkTiers[linkTiers.length - 1].btnPanels;
      }
    }
    // --- END BUG FIX ---

    if (btnPanels > 0) {
      debugInfo.linkBtnPanels = btnPanels;
      result.rangeOfLinkWidth = `${totalNominalWidth - btnPanels}-${totalNominalWidth + btnPanels}"`;
    } else {
      console.log('[PanelsLogic] No matching link tier found (or linkTiers empty).');
      result.rangeOfLinkWidth = 'N/A';
    }
  }

  // 5. Carton Qty & Carton Price
  console.log('--------------------------------');
  console.log(`[PanelsLogic] Calculating Carton Qty/Price for price path: ${pricePath}`);

  // If the final price is zero or invalid (which results in price=0), carton qty/price should also be zero.
  if (price <= 0) {
    console.log('[PanelsLogic] Price is 0 or invalid, setting Carton Qty and Carton Price to 0.');
    result.cartonQty = 0;
    result.cartonPrice = 0;
  } else if (pricePath === 'B') { // Custom/Exact Part with a valid price
    result.cartonQty = (type === 'Panel') ? 12 : Math.floor(12 / numberOfPanels);
    result.cartonPrice = parseFloat((result.price * result.cartonQty).toFixed(2));
  }
  // If pricePath is 'A' but has a valid price (from a standard override), carton qty is still 0.
  debugInfo.cartonQty = result.cartonQty;
  debugInfo.cartonPrice = result.cartonPrice;

  // 6. Finalization
  console.log('--------------------------------');
  console.log('[PanelsLogic] Calculation complete. Final result:', result);
  return result;
};