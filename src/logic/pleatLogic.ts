// src/logic/pleatLogic.ts

import type { PricingData, TieredLookupRow } from '../data/dataTypes';

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

export interface PleatPricingResult {
  partNumber: string;
  price: number;
  cartonQuantity: number;
  cartonPrice: number;
  isOversize: boolean;
  notes?: string;
}

export const generatePleatPartNumber = (
  inputs: PleatInputs,
  pricingData: PricingData
): string => {
  console.log('--- Starting Part Number Generation ---');
  console.log('Received Inputs:', inputs);
  // --- Step 1: Calculate Core Properties ---
  // Combine whole and fractional parts for calculations
  const width = inputs.widthWhole + inputs.widthFraction;
  const length = inputs.lengthWhole + inputs.lengthFraction;

  const faceValue = width * length;

  console.log(`Calculated Dimensions: Width=${width}, Length=${length}, FaceValue=${faceValue}`);
  const productCodeRow = pricingData.productFamilyCodes.find(
    (p) => p.Name.trim() === inputs.productFamily.trim()
  );
  const productCode = productCodeRow?.Product_Prefix;
  
  if (!productCode) {
    return 'Invalid Product Family';
  }
  console.log('Found Product Code:', productCode);

  // --- Get Fractional Codes ---
  const fractionalWidthRow = pricingData.fractionalCodes.find(
    (row) => row.Decimal_Value === inputs.widthFraction
  );
  const fractionalWidthCode = fractionalWidthRow?.Part_Number_Code;

  const fractionalLengthRow = pricingData.fractionalCodes.find(
    (row) => row.Decimal_Value === inputs.lengthFraction
  );
  const fractionalLengthCode = fractionalLengthRow?.Part_Number_Code;

  console.log(`Found Fractional Codes: WidthCode=${fractionalWidthCode}, LengthCode=${fractionalLengthCode}`);

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
    return 'Invalid depth threshold';
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
    // The same logic applies for 4" depth, just with its own set of thresholds.
    if (width <= standardThreshold.Width_Limit && length <= standardThreshold.Length_Limit) {
      secondaryCode = 1;
    } else if (width <= standardThreshold.Width_Limit && length <= oversizeThreshold.Length_Limit) {
      secondaryCode = 2;
    } else {
      secondaryCode = 3;
    }
  }
  console.log(`Determined Secondary Code: ${secondaryCode}`);

  // --- Step 4: Determine the Primary Code ---
  // This replicates the logic from cells AA24 and AA25
  let primaryCode: string;
  const isExactAndWhole = inputs.isExact && inputs.widthFraction === 0 && inputs.lengthFraction === 0;
  console.log(`Determining Primary Code. isExactAndWhole=${isExactAndWhole}`);

  if (isExactAndWhole) {
    primaryCode = 'CE'; // The "Exact, Whole-Number" override
  } else {
    // This is the logic from the big nested IF in AA25
    if (secondaryCode === 4) primaryCode = 'CQ';
    else if (secondaryCode === 3) primaryCode = 'CT';
    else if (secondaryCode === 2) primaryCode = 'CD';
    else primaryCode = 'C';
  }
  console.log(`Determined Primary Code: ${primaryCode}`);

  if (primaryCode === 'CQ') {
    return 'Contact Customer Service';
  }

  // --- Step 5: Assemble the Final Part Number ---
  const formattedWholeWidth = inputs.widthWhole.toString().padStart(2, '0');
  const formattedWholeLength = inputs.lengthWhole.toString().padStart(2, '0');

  // Only append fractional codes if they are not 0.
  const finalFractionalWidthCode = fractionalWidthCode || '';
  const finalFractionalLengthCode = fractionalLengthCode || '';

  console.log('Assembling final part number from pieces:', { productCode, primaryCode, depth: inputs.depth, formattedWholeWidth, fractionalWidthCode, formattedWholeLength, fractionalLengthCode });
  const partNumber = `${productCode}${primaryCode}0${inputs.depth}${formattedWholeWidth}${finalFractionalWidthCode}${formattedWholeLength}${finalFractionalLengthCode}`;

  console.log('--- Finished Part Number Generation ---');

  return partNumber;
};

export const calculatePleatPrice = (
  inputs: PleatInputs,
  pricingData: PricingData
): PleatPricingResult => {
  // Combine whole and fractional parts for calculations
  const width = inputs.widthWhole + inputs.widthFraction;
  const length = inputs.lengthWhole + inputs.lengthFraction;

  const partNumber = generatePleatPartNumber(inputs, pricingData);
  const isPartNumberValid = partNumber.startsWith('1') || partNumber.startsWith('2');

  if (!isPartNumberValid) {
    return { partNumber, price: 0, cartonQuantity: 0, cartonPrice: 0, isOversize: false, notes: 'Invalid Part Number' };
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
      } else if (width <= standardThreshold.Width_Limit && length <= oversizeThreshold.Length_Limit) {
        return 2;
      } else {
        return 3;
      }
    }
  };

  const partNumberCode = calculateSecondaryCode(inputs.depth);
  // For pricing, if depth is 4", we use the 2" dimension thresholds to get the code.
  const priceColumnCode = inputs.depth === 4 ? calculateSecondaryCode(2) : partNumberCode;

  if (partNumberCode === -1 || priceColumnCode === -1) {
    return { partNumber: 'Invalid depth threshold', price: 0, cartonQuantity: 0, cartonPrice: 0, isOversize: false };
  }

  // If secondaryCode is 4, it's a manual quote, regardless of other checks.
  if (partNumberCode === 4) {
    return {
      partNumber,
      price: 0,
      cartonQuantity: 0,
      cartonPrice: 0,
      isOversize: true,
      notes: 'Oversize dimensions - Manual Quote',
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

  const specialPriceRow = tableToSearch.find(
    (row) => row.Lookup_Key === lookupKey
  );

  if (specialPriceRow) {
    // A special price was found. The price itself is a string message.
    return { partNumber, price: 0, cartonQuantity: 0, cartonPrice: 0, isOversize: false, notes: specialPriceRow.Override_Price };
  }

  // --- GATE 3: Standard Price Calculation ---
  const faceValue = width * length;
  const tieredRow = pricingData.tieredLookupMatrix.find(
    (row) => row.Product_Prefix === productCode && faceValue >= row.Min_Range && faceValue <= row.Max_Range
  );

  if (!tieredRow) {
    return { partNumber, price: 0, cartonQuantity: 0, cartonPrice: 0, isOversize: false, notes: 'Dimensions out of range' };
  }

  // Build the key to find the correct price column from the tieredRow.
  let priceColumnKey: keyof TieredLookupRow;
  let suffix: 'Update' | 'Double' | 'Triple';

  if (priceColumnCode === 1) {
    suffix = 'Update';
  } else if (priceColumnCode === 2) {
    suffix = 'Double';
  } else { // secondaryCode is 3
    suffix = 'Triple';
  }

  priceColumnKey = `${inputs.depth}_${suffix}` as keyof TieredLookupRow;

  const listPrice = tieredRow[priceColumnKey];

  if (typeof listPrice !== 'number') {
    return { partNumber, price: 0, cartonQuantity: 0, cartonPrice: 0, isOversize: false, notes: 'Price not available for this configuration' };
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
  };
};