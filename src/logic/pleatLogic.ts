// src/logic/pleatLogic.ts

import type { PricingData, TieredLookupRow } from '../data/dataTypes.js';

// Define a type for our form inputs for clarity
export interface PleatInputs {
  productFamily: string;
  widthWhole: number;
  widthFraction: number;
  lengthWhole: number;
  lengthFraction: number;
  depth: 1 | 2 | 4;
  isExact: boolean;
}

export interface PleatDebugInfo {
  partNumberGeneration?: any;
  priceCalculation?: any;
}

export interface PartNumberDebugInfo {
  productCode?: number | string;
  fractionalWidthCode?: string;
  fractionalLengthCode?: string;
  secondaryCode?: number;
  primaryCode?: string;
  isExactAndWhole?: boolean;
  assembledPartNumber?: string;
}

export interface PleatPricingResult {
  partNumber: string;
  price: number;
  cartonQuantity: number;
  cartonPrice: number;
  isOversize: boolean;
  notes?: string;
  debugInfo?: PleatDebugInfo;
}

export const generatePleatPartNumber = (
  inputs: PleatInputs,
  pricingData: PricingData
): { partNumber: string; debugInfo: PartNumberDebugInfo } => {
  const debugInfo: PartNumberDebugInfo = {};

  // --- Step 1: Calculate Core Properties ---
  // Combine whole and fractional parts for calculations
  const width = inputs.widthWhole + inputs.widthFraction;
  const length = inputs.lengthWhole + inputs.lengthFraction;
  const productCodeRow = pricingData.productFamilyCodes.find(
    (p) => p.Name.trim() === inputs.productFamily.trim()
  );
  const productCode = productCodeRow?.Product_Prefix;
  debugInfo.productCode = productCode || 'Not Found';
  
  if (!productCode) {
    return { partNumber: 'Invalid Product Family', debugInfo };
  }

  // --- Get Fractional Codes ---
  const fractionalWidthRow = pricingData.fractionalCodes.find(
    (row) => row.Decimal_Value === inputs.widthFraction
  );
  const fractionalWidthCode = fractionalWidthRow?.Part_Number_Code;
  debugInfo.fractionalWidthCode = fractionalWidthCode?.toString() || 'None';

  const fractionalLengthRow = pricingData.fractionalCodes.find(
    (row) => row.Decimal_Value === inputs.lengthFraction
  );
  const fractionalLengthCode = fractionalLengthRow?.Part_Number_Code;
  debugInfo.fractionalLengthCode = fractionalLengthCode?.toString() || 'None';

  // --- Step 3: Determine the Secondary Code ---
  // This logic is based on the dimension checker from cells U57 and U58.
  // It implements a 4-tier check based on standard and oversize dimension thresholds.
  let secondaryCode: number;

  const standardThreshold = pricingData.dimensionThresholds.find(
    (t) => t.Depth === inputs.depth && t.Limit_Type === 'Standard'
  );
  const oversizeThreshold = pricingData.dimensionThresholds.find(
    (t) => t.Depth === inputs.depth && t.Limit_Type === 'Oversize'
  );

  if (!standardThreshold || !oversizeThreshold) {
    return { partNumber: 'Invalid depth threshold', debugInfo };
  }

  if (inputs.depth === 1 || inputs.depth === 2) {
    if (width <= standardThreshold.Width_Limit && length <= standardThreshold.Length_Limit) {
      secondaryCode = 1;
    } else if (width <= standardThreshold.Width_Limit && length <= oversizeThreshold.Length_Limit) {
      secondaryCode = 2;
    } else if (width <= oversizeThreshold.Width_Limit && length <= standardThreshold.Length_Limit) {
      secondaryCode = 2;
    } else if (width <= standardThreshold.Width_Limit && length > oversizeThreshold.Length_Limit) {
      secondaryCode = 3;
    } else if (width > oversizeThreshold.Width_Limit && length <= standardThreshold.Length_Limit) {
      secondaryCode = 3;
    } else {
      secondaryCode = 4;
    }
  } else {
    // Logic for 4" depth, copied from 1" & 2" logic but using 4" thresholds.
    if (width <= standardThreshold.Width_Limit && length <= standardThreshold.Length_Limit) {
      secondaryCode = 1;
    } else if (width <= standardThreshold.Width_Limit && length <= oversizeThreshold.Length_Limit) {
      secondaryCode = 2;
    } else if (width <= oversizeThreshold.Width_Limit && length <= standardThreshold.Length_Limit) {
      secondaryCode = 2;
    } else if (width <= standardThreshold.Width_Limit && length > oversizeThreshold.Length_Limit) {
      secondaryCode = 3;
    } else if (width > oversizeThreshold.Width_Limit && length <= standardThreshold.Length_Limit) {
      secondaryCode = 3;
    } else {
      secondaryCode = 4;
    }
  }
  debugInfo.secondaryCode = secondaryCode;

  // --- Step 4: Determine the Primary Code ---
  // This replicates the logic from cells AA24 and AA25
  let primaryCode: string;
  const isExactAndWhole = inputs.isExact && inputs.widthFraction === 0 && inputs.lengthFraction === 0;
  debugInfo.isExactAndWhole = isExactAndWhole;

  if (isExactAndWhole) {
    primaryCode = 'CE'; // The "Exact, Whole-Number" override
  } else {
    // This is the logic from the big nested IF in AA25
    if (secondaryCode === 4) primaryCode = 'CQ';
    else if (secondaryCode === 3) primaryCode = 'CT';
    else if (secondaryCode === 2) primaryCode = 'CD';
    else primaryCode = 'C';
  }
  debugInfo.primaryCode = primaryCode;

  if (primaryCode === 'CQ') {
    return { partNumber: 'Contact Customer Service', debugInfo };
  }

  // --- Step 5: Assemble the Final Part Number ---
  const formattedWholeWidth = inputs.widthWhole.toString().padStart(2, '0');
  const formattedWholeLength = inputs.lengthWhole.toString().padStart(2, '0');

  // Only append fractional codes if they are not 0.
  const finalFractionalWidthCode = fractionalWidthCode || '';
  const finalFractionalLengthCode = fractionalLengthCode || '';

  const partNumber = `${productCode}${primaryCode}0${inputs.depth}${formattedWholeWidth}${finalFractionalWidthCode}${formattedWholeLength}${finalFractionalLengthCode}`;
  debugInfo.assembledPartNumber = partNumber;

  return { partNumber, debugInfo };
};

export const calculatePleatPrice = (
  inputs: PleatInputs,
  pricingData: PricingData
): PleatPricingResult => {
  // Combine whole and fractional parts for calculations
  const width = inputs.widthWhole + inputs.widthFraction;
  const length = inputs.lengthWhole + inputs.lengthFraction;

  const { partNumber, debugInfo: partNumberDebugInfo } = generatePleatPartNumber(inputs, pricingData);
  const debugInfo: PleatDebugInfo = {
    partNumberGeneration: partNumberDebugInfo,
    priceCalculation: {},
  };

  const isPartNumberValid = partNumber.startsWith('1') || partNumber.startsWith('2');
  debugInfo.priceCalculation.isPartNumberValid = isPartNumberValid;

  if (!isPartNumberValid) {
    return { partNumber, price: 0, cartonQuantity: 0, cartonPrice: 0, isOversize: false, notes: 'Invalid Part Number', debugInfo };
  }

  // --- Determine Secondary Codes for Part Number vs. Pricing ---
  // The part number code is based on the actual depth's dimension rules.
  // The price column code uses 1"/2" dimension rules, even for 4" filters, to determine the price multiplier.
  const calculateSecondaryCode = (depthForThresholds: 1 | 2 | 4): number => {
    const standardThreshold = pricingData.dimensionThresholds.find(
      (t) => t.Depth === depthForThresholds && t.Limit_Type === 'Standard'
    );
    const oversizeThreshold = pricingData.dimensionThresholds.find(
      (t) => t.Depth === depthForThresholds && t.Limit_Type === 'Oversize'
    );

    if (!standardThreshold || !oversizeThreshold) {
      // This should not happen with valid data, but it's a safe fallback.
      return -1; // Indicates an error
    }

    if (depthForThresholds === 1 || depthForThresholds === 2) {
      if (width <= standardThreshold.Width_Limit && length <= standardThreshold.Length_Limit) {
        return 1;
      } else if (width <= standardThreshold.Width_Limit && length <= oversizeThreshold.Length_Limit) {
        return 2;
      } else if (width <= oversizeThreshold.Width_Limit && length <= standardThreshold.Length_Limit) {
        return 2;
      } else if (width <= standardThreshold.Width_Limit && length > oversizeThreshold.Length_Limit) {
        return 3;
      } else if (width > oversizeThreshold.Width_Limit && length <= standardThreshold.Length_Limit) {
        return 3;
      } else {
        return 4;
      }
    } else { // Depth is 4
      if (width <= standardThreshold.Width_Limit && length <= standardThreshold.Length_Limit) {
        return 1;
      } else if (
        (width <= standardThreshold.Width_Limit && length <= oversizeThreshold.Length_Limit) ||
        (width <= oversizeThreshold.Width_Limit && length <= standardThreshold.Length_Limit)
      ) {
        return 2;
      } else if (width <= standardThreshold.Width_Limit && length > oversizeThreshold.Length_Limit) {
        return 3;
      } else if (width > oversizeThreshold.Width_Limit && length <= standardThreshold.Length_Limit) {
        return 3;
      } else {
        return 4;
      }
    }
  };

  const secondaryCodeForActualDepth = calculateSecondaryCode(inputs.depth);
  // For pricing, if depth is 4", we use the 2" dimension thresholds to get the code.
  const secondaryCodeFor1InchLogic = inputs.depth === 4 ? calculateSecondaryCode(2) : secondaryCodeForActualDepth;
  debugInfo.priceCalculation.secondaryCodeForActualDepth = secondaryCodeForActualDepth;
  debugInfo.priceCalculation.secondaryCodeFor1InchLogic = secondaryCodeFor1InchLogic;

  if (secondaryCodeForActualDepth === -1 || secondaryCodeFor1InchLogic === -1) {
    return { partNumber: 'Invalid depth threshold', price: 0, cartonQuantity: 0, cartonPrice: 0, isOversize: false, debugInfo };
  }

  // If secondaryCodeForActualDepth is 4, it's a manual quote, regardless of other checks.
  if (secondaryCodeForActualDepth === 4) {
    return {
      partNumber,
      price: 0,
      cartonQuantity: 0,
      cartonPrice: 0,
      isOversize: true,
      notes: 'Oversize dimensions - Manual Quote',
      debugInfo,
    };
  }

  // --- Get Product Code for Table Switch Logic ---
  const productCodeRow = pricingData.productFamilyCodes.find(
    (p) => p.Name.trim() === inputs.productFamily.trim()
  );
  const productCode = productCodeRow?.Product_Prefix;

  // --- GATE 1: Manual Override Check ---
  // This list contains product codes that MUST use the 'A' table.
  const tableAProducts = [23209, 23309, 23210, 23310, 23211, 23311, 23213];

  // The table switch is now based on whether the current product's code is in the special list.
  const useTableA = productCode ? tableAProducts.includes(productCode) : false;
  debugInfo.priceCalculation.overrideTableUsed = useTableA ? 'A' : 'B';

  const tableToSearch = useTableA
    ? pricingData.specialOverrideA
    : pricingData.specialOverrideB;

  // Construct the lookup key string-by-string to avoid floating point inaccuracies.
  // This is more robust than `${width}x${length}x${depth}`.
  const fractionalWidthRow = pricingData.fractionalCodes.find(
    (row) => row.Decimal_Value === inputs.widthFraction
  );
  const fractionalWidthCode = fractionalWidthRow?.Part_Number_Code;

  const fractionalLengthRow = pricingData.fractionalCodes.find(
    (row) => row.Decimal_Value === inputs.lengthFraction
  );
  const fractionalLengthCode = fractionalLengthRow?.Part_Number_Code;

  const widthString = fractionalWidthCode ? `${inputs.widthWhole}.${fractionalWidthCode}` : `${inputs.widthWhole}`;
  const lengthString = fractionalLengthCode ? `${inputs.lengthWhole}.${fractionalLengthCode}` : `${inputs.lengthWhole}`;
  const lookupKey = `${widthString}x${lengthString}x${inputs.depth}`;
  debugInfo.priceCalculation.overrideLookupKey = lookupKey;

  const specialPriceRow = tableToSearch.find(
    (row) => row.Lookup_Key === lookupKey
  );
  debugInfo.priceCalculation.overridePriceRowFound = specialPriceRow || 'None';

  if (specialPriceRow) {
    // A special price was found. The price itself is a string message.
    return { partNumber, price: 0, cartonQuantity: 0, cartonPrice: 0, isOversize: false, notes: specialPriceRow.Override_Price, debugInfo };
  }

  // --- GATE 3: Standard Price Calculation ---
  const faceValue = width * length;
  debugInfo.priceCalculation.faceValue = faceValue;
  const tieredRow = pricingData.tieredLookupMatrix.find(
    (row) => row.Product_Prefix === productCode && faceValue >= row.Min_Range && faceValue <= row.Max_Range
  );
  debugInfo.priceCalculation.tieredPriceRowFound = tieredRow || 'None';

  if (!tieredRow) {
    debugInfo.priceCalculation.finalPrice = 'Dimensions out of range';
    return { partNumber, price: 0, cartonQuantity: 0, cartonPrice: 0, isOversize: false, notes: 'Dimensions out of range', debugInfo };
  }

  // Build the key to find the correct price column from the tieredRow.
  let priceColumnKey: keyof TieredLookupRow;
  let suffix: 'Update' | 'Double' | 'Triple';

  const rule1Products = [11204, 12204];
  const rule2Products = [23209, 23309, 23210, 23310, 23211, 23311, 23213]; // The 23xxx codes

  // --- Apply Pricing Rules to determine the column suffix ---

  if (productCode === 11204) {
    // Apply Rule 1 for product 11204 (uses 1-inch logic)
    if (secondaryCodeFor1InchLogic === 1) {
      suffix = 'Update';
    } else { // 2, 3, or 4
      suffix = 'Double';
    }
  } else if (productCode === 12204) {
    // Apply Rule 1 for product 12204 (uses actual depth logic)
    if (secondaryCodeForActualDepth === 1) {
      suffix = 'Update';
    } else { // 2, 3, or 4
      suffix = 'Double';
    }
  }else if (productCode && rule2Products.includes(productCode)) {
    // Apply Rule 2 (if 23xxx - uses 1-inch logic)
    if (secondaryCodeFor1InchLogic === 1) {
      suffix = 'Update';
    } else if (secondaryCodeFor1InchLogic === 2) {
      suffix = 'Double';
    } else { // 3 or 4
      suffix = 'Triple';
    }
  } else {
    // Apply Rule 3 (Generic - All Others)
    const isC68ExceptionRange = tieredRow.Min_Range === 600 && tieredRow.Max_Range === 899;

    if (inputs.depth === 2 && isC68ExceptionRange && secondaryCodeForActualDepth !== 1) {
      // Special exception for 2" depth filters in the 600-899 faceValue range that are not standard size.
      suffix = 'Triple';
    } else {
      // Normal Generic Rule (uses actual depth logic)
      if (secondaryCodeForActualDepth === 1) {
        suffix = 'Update';
      } else if (secondaryCodeForActualDepth === 2) {
        suffix = 'Double';
      } else { // 3 or 4
        suffix = 'Triple';
      }
    }
  }

  priceColumnKey = `${inputs.depth}_${suffix}` as keyof TieredLookupRow;
  debugInfo.priceCalculation.priceColumnKey = priceColumnKey;

  const listPrice = tieredRow[priceColumnKey];
  debugInfo.priceCalculation.listPrice = listPrice;

  if (typeof listPrice !== 'number') {
    debugInfo.priceCalculation.finalPrice = 'Price not available for this configuration';
    return { partNumber, price: 0, cartonQuantity: 0, cartonPrice: 0, isOversize: false, notes: 'Price not available for this configuration', debugInfo };
  }

  // --- Final Assembly ---
  // Carton quantity is always 12, regardless of depth.
  const cartonQuantity = 12;
  const cartonPrice = listPrice * cartonQuantity;

  return {
    partNumber,
    price: parseFloat(listPrice.toFixed(2)),
    cartonQuantity,
    cartonPrice: parseFloat(cartonPrice.toFixed(2)),
    isOversize: false,
    debugInfo,
  };
};