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

  // --- Step 2: Find the Correct Row from the Tiered Matrix ---
  console.log(`Searching Tiered Matrix for Product_Prefix=${productCode} and FaceValue=${faceValue}`);
  const relevantRow: TieredLookupRow | undefined = pricingData.tieredLookupMatrix.find(
    (row) =>
      row.Product_Prefix === productCode &&
      faceValue >= row.Min_Range &&
      faceValue <= row.Max_Range
  );
  
  if (!relevantRow) {
    console.error('Could not find a matching row in the Tiered Lookup Matrix.');
    return 'Dimensions out of range';
  }
  console.log('Found Tiered Matrix Row:', relevantRow);

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
  console.log(`Determined Secondary Code: ${secondaryCode}`);

  // --- Step 4: Determine the Primary Code ---
  // This replicates the logic from cells AA24 and AA25
  let primaryCode: string;
  const isWholeNumber = (num: number) => num % 1 === 0;
  const isExactAndWhole = inputs.isExact && isWholeNumber(width) && isWholeNumber(length);
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

  console.log('Assembling final part number from pieces:', { productCode, primaryCode, depth: inputs.depth, formattedWholeWidth, fractionalWidthCode, formattedWholeLength, fractionalLengthCode });
  const partNumber = `${productCode}${primaryCode}0${inputs.depth}${formattedWholeWidth}${fractionalWidthCode}${formattedWholeLength}${fractionalLengthCode}`;

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

  // --- GATE 2: Non-Standard (Oversize) Dimension Check ---
  const threshold = pricingData.dimensionThresholds.find(
    (t) => t.Depth === `${inputs.depth}"`
  );

  const isOversize = threshold
    ? width > threshold.Width_Limit || length > threshold.Length_Limit
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