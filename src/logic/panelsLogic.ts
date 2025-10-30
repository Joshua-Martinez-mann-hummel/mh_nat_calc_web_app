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
} from '../data/PanelsData/panelsDataTypes';

/**
 * Parses the dimension rule strings from the custom pricing CSV (e.g., "<25", ">25;<48").
 * @param rule The rule string to parse.
 * @param value The dimension value to check against the rule.
 * @returns True if the value satisfies the rule, false otherwise.
 */
const checkDimensionRule = (rule: string, value: number): boolean => {
  if (rule === 'ALL') return true;
  const rules = rule.split(';');
  return rules.every((r) => {
    if (r.startsWith('>=')) return value >= parseFloat(r.substring(2));
    if (r.startsWith('<=')) return value <= parseFloat(r.substring(2));
    if (r.startsWith('>')) return value > parseFloat(r.substring(1));
    if (r.startsWith('<')) return value < parseFloat(r.substring(1));
    return false;
  });
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
  const matchingRow = customPriceList.find((row) => {
    const isTypeMatch = row.type === prefix;
    if (!isTypeMatch) return false;

    const isHeightMatch = checkDimensionRule(row.height, totalHeight);
    const isWidthMatch = checkDimensionRule(row.width, totalWidth);
    const isFaceValueMatch = faceValue >= row.rangeFrom && faceValue <= row.rangeTo;

    return isHeightMatch && isWidthMatch && isFaceValueMatch;
  });

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
  };

  const totalHeight = heightWhole + heightFraction;
  const totalWidth = widthWhole + widthFraction;

  const prefix = productInfo.get(productFamily);
  if (!prefix) {
    errors.push('Selected product family not found.');
    return result;
  }

  // 2. Part Number Logic
  let partNumber = 'N/A';
  const heightFracCode = fractionalCodes.get(heightFraction) ?? '';
  const widthFracCode = fractionalCodes.get(widthFraction) ?? '';

  if (type === 'Panel') {
    // Logic M26
    const heightStr = heightWhole.toString().padStart(2, '0');
    const widthStr = widthWhole.toString().padStart(2, '0');
    const exactFlag = isExact ? 'E' : '';
    partNumber = `${prefix}${heightStr}${heightFracCode}${exactFlag}${widthStr}${widthFracCode}${exactFlag}01`;
    if (addOn === 'Antimicrobial') {
      partNumber += 'AT';
    }
  } else if (type === 'Link') {
    // Logic M27 - Replicates bug/feature where AT Links have no part number
    if (addOn === 'Standard') {
      const linkSuffix = numberOfPanels.toString().padStart(2, '0');
      const exactFlag = isExact ? 'E' : '';

      // Sort dimensions, smaller first
      if (totalWidth <= totalHeight) {
        const smallerDimInt = widthWhole.toString().padStart(2, '0');
        const smallerDimFrac = widthFracCode;
        const largerDimInt = heightWhole.toString().padStart(2, '0');
        const largerDimFrac = heightFracCode;
        partNumber = `${prefix}${smallerDimInt}${smallerDimFrac}${exactFlag}${largerDimInt}${largerDimFrac}${exactFlag}${linkSuffix}`;
      } else {
        const smallerDimInt = heightWhole.toString().padStart(2, '0');
        const smallerDimFrac = heightFracCode;
        const largerDimInt = widthWhole.toString().padStart(2, '0');
        const largerDimFrac = widthFracCode;
        partNumber = `${prefix}${smallerDimInt}${smallerDimFrac}${exactFlag}${largerDimInt}${largerDimFrac}${exactFlag}${linkSuffix}`;
      }
    }
  }
  result.partNumber = partNumber;

  // 3. Price Logic (Two-Path System)
  let price = 0;
  let pricePath: 'A' | 'B' | null = null;

  // Path A: Validation & Standard Overrides (Logic R46)
  if (totalHeight < 3.25 || totalWidth < 3.25) errors.push('Dimensions must be at least 3.25".');
  if (totalHeight > 77.25 || totalWidth > 51.25) errors.push('Dimensions exceed maximum limits (H: 77.25", W: 51.25").');

  if (!isExact) {
    const dimensionKey = `${heightWhole}X${widthWhole}`;
    const overrideValue = standardOverrides.get(dimensionKey);

    if (overrideValue) {
      pricePath = 'A';
      const parsedPrice = parseFloat(overrideValue);
      if (isNaN(parsedPrice)) {
        // Value is a string like "Standard Part #..."
        errors.push(overrideValue);
      } else {
        price = parsedPrice;
      }
    }
  }

  // Path B: Custom/Exact Fallback (Logic R27)
  if (pricePath === null) {
    pricePath = 'B';
    const faceValue = Math.ceil(totalHeight * totalWidth);
    const customPrices = findCustomPrice(customPriceList, prefix, totalHeight, totalWidth, faceValue);

    if (customPrices) {
      if (addOn === 'Antimicrobial') {
        if (customPrices.PriceCustomAt === '$-') {
          errors.push('Antimicrobial not available for this custom size.');
        } else {
          // Price might be a string like "$123.45" or just a number
          price = parseFloat(String(customPrices.PriceCustomAt).replace(/[^0-9.-]+/g, ''));
        }
      } else { // Standard
        price = customPrices.priceCustomStandard;
      }
    } else {
      errors.push('Custom price not found for these dimensions.');
    }

    // Link Multiplier
    if (type === 'Link') {
      price *= numberOfPanels;
    }
  }

  // If errors occurred during pricing, set price to 0 but keep errors.
  if (errors.length > 0) {
    price = 0;
  }

  result.price = parseFloat(price.toFixed(2));

  // 4. Range of Link Width
  if (type === 'Link') {
    const totalNominalWidth = widthWhole * numberOfPanels;
    // Find the first tier where the total width is less than or equal to the max length
    const tier = linkTiers.find(t => totalNominalWidth <= t.lengthMax);
    if (tier) {
      const btnPanels = tier.btnPanels;
      result.rangeOfLinkWidth = `${totalNominalWidth - btnPanels}-${totalNominalWidth + btnPanels}"`;
    } else {
      result.rangeOfLinkWidth = 'N/A - Exceeds max link width';
    }
  }

  // 5. Carton Qty & Carton Price
  if (pricePath === 'A') { // Standard Part
    result.cartonQty = 0;
    result.cartonPrice = 0;
  } else if (pricePath === 'B') { // Custom/Exact Part
    result.cartonQty = (type === 'Panel') ? 12 : Math.floor(12 / numberOfPanels);
    result.cartonPrice = parseFloat((result.price * result.cartonQty).toFixed(2));
  }

  // 6. Finalization
  return result;
};