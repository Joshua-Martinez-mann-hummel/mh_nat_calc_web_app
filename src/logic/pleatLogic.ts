// src/logic/pleatLogic.ts

import type { PricingData, TieredLookupRow } from '../data/dataTypes';

// Define a type for our form inputs for clarity
export interface PleatInputs {
  productFamily: string;
  width: number;
  length: number;
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
  // --- Step 1: Calculate Core Properties ---
  const faceValue = inputs.width * inputs.length;

  const productCodeRow = pricingData.productFamilyCodes.find(
    (p) => p.Name.trim() === inputs.productFamily.trim()
  );
  const productCode = productCodeRow?.Product_Prefix;
  
  if (!productCode) {
    return 'Invalid Product Family';
  }

  // --- Step 2: Find the Correct Row from the Tiered Matrix ---
  const relevantRow: TieredLookupRow | undefined = pricingData.tieredLookupMatrix.find(
    (row) =>
      row.Product_Prefix === productCode &&
      faceValue >= row.Min_Range &&
      faceValue <= row.Max_Range
  );

  if (!relevantRow) {
    return 'Dimensions out of range';
  }

  // --- Step 3: Determine the Secondary Code ---
  // This replicates the logic from the T, U, and V columns
  let secondaryCode: number;
  if (inputs.depth === 1) {
    secondaryCode = relevantRow['1" Update']; // Or Double/Triple based on other inputs if needed
  } else if (inputs.depth === 2) {
    secondaryCode = relevantRow['2" Update'];
  } else {
    secondaryCode = relevantRow['4" Update'];
  }

  // --- Step 4: Determine the Primary Code ---
  // This replicates the logic from cells AA24 and AA25
  let primaryCode: string;
  const isWholeNumber = (num: number) => num % 1 === 0;
  const isExactAndWhole = inputs.isExact && isWholeNumber(inputs.width) && isWholeNumber(inputs.length);

  if (isExactAndWhole) {
    primaryCode = 'CE'; // The "Exact, Whole-Number" override
  } else {
    // This is the logic from the big nested IF in AA25
    if (secondaryCode === 4) primaryCode = 'CQ';
    else if (secondaryCode === 3) primaryCode = 'CT';
    else if (secondaryCode === 2) primaryCode = 'CD';
    else primaryCode = 'C';
  }

  if (primaryCode === 'CQ') {
    return 'Contact Customer Service';
  }

  // --- Step 5: Assemble the Final Part Number ---
  const formatDimension = (dimension: number): string => {
    const isWhole = dimension % 1 === 0;
    if (isWhole) {
      // It's a whole number, format as a two-digit string (e.g., 9 -> "09", 12 -> "12")
      const formatted = dimension.toString().padStart(2, '0');
      return formatted;
    } else {
      // It has a decimal, remove the "." to create a three-digit code (e.g., 12.5 -> "125")
      const formatted = dimension.toString().replace('.', '');
      return formatted;
    }
  };
  const formattedWidth = formatDimension(inputs.width);
  const formattedLength = formatDimension(inputs.length);

  const partNumber = `${productCode}${primaryCode}0${inputs.depth}${formattedWidth}${formattedLength}`;

  return partNumber;
};

export const calculatePleatPrice = (
  inputs: PleatInputs,
  pricingData: PricingData
): PleatPricingResult => {
  const partNumber = generatePleatPartNumber(inputs, pricingData);
  const isPartNumberValid = partNumber.startsWith('1') || partNumber.startsWith('2');

  if (!isPartNumberValid) {
    return { partNumber, price: 0, cartonQuantity: 0, cartonPrice: 0, isOversize: false, notes: 'Invalid Part Number' };
  }

  // --- GATE 1: Manual Override Check ---
  // The condition from Z37 in the Excel map is whether the filter is "Made Exact"
  const useTableA = inputs.isExact;

  const tableToSearch = useTableA
    ? pricingData.specialOverrideA
    : pricingData.specialOverrideB;

  const lookupKey = `${inputs.width}x${inputs.length}x${inputs.depth}`;

  const specialPriceRow = tableToSearch.find(
    (row) => row.Lookup_Key === lookupKey
  );

  if (specialPriceRow) {
    // A special price was found. The price itself is a string message.
    return { partNumber, price: 0, cartonQuantity: 0, cartonPrice: 0, isOversize: false, notes: specialPriceRow.Override_Price };
  }

  // --- GATE 2: Non-Standard (Oversize) Dimension Check ---
  const threshold = pricingData.dimensionThresholds.find(
    (t) => t.Depth === `${inputs.depth}"`
  );

  const isOversize = threshold
    ? inputs.width > threshold.Width_Limit || inputs.length > threshold.Length_Limit
    : false;

  if (isOversize) {
    // This is a fixed, non-standard price as per the user's request.
    // This value may need to be adjusted based on business rules.
    const nonStandardPrice = 999.99;
    return {
      partNumber,
      price: nonStandardPrice,
      cartonQuantity: 0,
      cartonPrice: 0,
      isOversize: true,
      notes: 'Oversize dimensions - Manual Quote',
    };
  }

  // --- GATE 3: Standard Price Calculation ---
  const priceCode = partNumber.substring(0, 5);
  const priceCodeAsNumber = parseInt(priceCode, 10);

  const priceRow = pricingData.standardPrices.find(
    // Compare as numbers to avoid type mismatch from CSV parsing
    (p) => p.Product_Code === priceCodeAsNumber
  );

  if (!priceRow) {
    // Return the valid part number, but with a note about the pricing error.
    return { partNumber, price: 0, cartonQuantity: 0, cartonPrice: 0, isOversize: false, notes: 'Invalid Price Code' };
  }

  const priceKey = `${inputs.depth}"_Price` as keyof typeof priceRow;
  const listPrice = priceRow[priceKey];

  if (typeof listPrice !== 'number') {
    return { partNumber, price: 0, cartonQuantity: 0, cartonPrice: 0, isOversize: false, notes: 'Price not available for depth' };
  }

  // --- Final Assembly ---
  // Calculate carton quantity based on depth.
  let cartonQuantity: number;
  if (inputs.depth === 4) {
    cartonQuantity = 6;
  } else {
    cartonQuantity = 12;
  }
  const cartonPrice = listPrice * cartonQuantity;

  return {
    partNumber,
    price: parseFloat(listPrice.toFixed(2)),
    cartonQuantity,
    cartonPrice: parseFloat(cartonPrice.toFixed(2)),
    isOversize: false,
  };
};