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
 * This logic is more complex as it must replicate Excel's "first-match"
 * for dimension, and its "lookup-last" behavior for FaceValue.
 */
const findCustomPrice = (
  customPriceList: PanelCustomPriceRow[],
  prefix: string,
  totalHeight: number,
  totalWidth: number,
  faceValue: number
): { priceCustomStandard: number; PriceCustomAt: string } | null => {
  console.log(`[PanelsLogic]   [findCustomPrice] Searching for match with: prefix='${prefix}', H=${totalHeight}, W=${totalWidth}, FaceValue=${faceValue}`);

  let matchingRow: PanelCustomPriceRow | null = null;

  for (let i = 0; i < customPriceList.length; i++) {
    const row = customPriceList[i];

    // 1. Check Type
    const isTypeMatch = String(row.type) === prefix;
    if (!isTypeMatch) continue; // Not our product, skip

    console.log(`[PanelsLogic]     [findCustomPrice] Checking row for type '${row.type}' (H rule: '${row.height}', W rule: '${row.width}', Face range: ${row.rangeFrom}-${row.rangeTo})`);

    // 2. Check Dimensions (with Relaxed Fix)
    let isHeightMatch = checkDimensionRule(row.height, totalHeight);
    let isWidthMatch = checkDimensionRule(row.width, totalWidth);

    // --- START FIX ---
    // If H or W (or both) failed, try relaxing them
    if (!isHeightMatch || !isWidthMatch) {
        console.log(`[PanelsLogic]         -> Strict H/W match failed. Attempting relaxed check...`);
        if (!isHeightMatch) {
            isHeightMatch = checkRelaxedDimensionRule(row.height, totalHeight);
            console.log(`[PanelsLogic]           -> Relaxed H result: ${isHeightMatch}`);
        }
        if (!isWidthMatch) {
            isWidthMatch = checkRelaxedDimensionRule(row.width, totalWidth);
            console.log(`[PanelsLogic]           -> Relaxed W result: ${isWidthMatch}`);
        }
    }
    // --- END FIX ---

    // After EITHER strict OR relaxed checks, if dimensions don't match, this isn't our bucket.
    if (!isHeightMatch || !isWidthMatch) {
      console.log(`[PanelsLogic]         -> H/W Dim Match? false.`);
      continue;
    }

    // --- COMMITMENT POINT ---
    // If we are here, H and W MATCH. 
    // This is our dimension bucket. We now ONLY check FaceValue.
    console.log(`[PanelsLogic]         -> H/W Dim Match? true. Committing to this dimension bucket.`);

    // 3. Check Face Value
    const isFaceValueMatch = faceValue >= row.rangeFrom && faceValue <= row.rangeTo;

    if (isFaceValueMatch) {
      // This is a perfect match
      console.log(`[PanelsLogic]         -> Face Value Match? true.`);
      matchingRow = row;
      break; // Found it - THIS IS THE FIX
    }

    // 4. Replicate Excel's LOOKUP bug (if FaceValue is too high)
    if (faceValue > row.rangeTo) {
      console.log(`[PanelsLogic]         -> Face Value ${faceValue} > ${row.rangeTo}. Peeking at next row...`);
      const nextRow = (i + 1 < customPriceList.length) ? customPriceList[i + 1] : null;

      // Check if the next row is a *different* dimension bucket
      if (
        !nextRow ||
        nextRow.type !== row.type ||
        nextRow.height !== row.height ||
        nextRow.width !== row.width
      ) {
        // This is the LAST face-value-tier for this dimension-bucket.
        // And our FaceValue is too high. This is the Excel LOOKUP behavior.
        console.log(`[PanelsLogic]         -> Next row is a new bucket. Applying Excel LOOKUP behavior on current row.`);
        matchingRow = row;
        break; // Found it
      }
    }

    // If we get here, our FaceValue was too low for this tier (e.g., 613 vs 700-800).
    // The loop will continue to the next row (which must be the next FaceValue tier
    // in the *same* dimension bucket).
    console.log(`[PanelsLogic]         -> Face Value Match? false. Continuing search in bucket.`);
  }

  // --- End of Loop ---

  if (matchingRow) {
    console.log(`[PanelsLogic]   [findCustomPrice] ✅ Found a matching row:`, matchingRow);
    return {
      priceCustomStandard: matchingRow.priceCustomStandard,
      PriceCustomAt: matchingRow.PriceCustomAt,
    };
  }

  console.log(`[PanelsLogic]   [findCustomPrice] ❌ No matching row found after all checks.`);
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
  if (!isExact && errors.length === 0) { // Only check for overrides if no validation errors occurred
    console.log('--------------------------------');
    console.log('[PanelsLogic] Path A: Checking for standard override (isExact is false).');
    const dimensionKey = `${heightWhole}X${widthWhole}`;
    const overrideValue = standardOverrides.get(dimensionKey);
    debugInfo.standardCheck = { dimensionKey, overrideValue: overrideValue ?? 'N/A' };
    console.log(`[PanelsLogic] Path A: DimensionKey='${dimensionKey}', OverrideValue='${overrideValue ?? 'N/A'}'`);
    
    if (overrideValue) {
      // An override was found. This ALWAYS stops Path B.
      pricePath = 'A';
      debugInfo.pricePath = 'A';
      console.log('[PanelsLogic] Path A: Found override. Setting price path to A.');
      
      const parsedPrice = parseFloat(overrideValue);

      if (isNaN(parsedPrice)) {
        // Value is text ("Standard Part #..."). This IS the result.
        // It's an error message for the user.
        console.log(`[PanelsLogic] Path A: Override value is text. Pushing as error.`);
        errors.push(overrideValue);
        // Price will remain 0, which is correct.
      } else {
        // This is a REAL price override.
        price = parsedPrice;
        console.log(`[PanelsLogic] Path A: Found standard override price: ${price}.`);
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