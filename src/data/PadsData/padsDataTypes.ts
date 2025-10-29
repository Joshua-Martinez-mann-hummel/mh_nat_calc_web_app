// Based on the template from src/data/SleevesData/sleevesDataTypes.ts

/**
 * User inputs for the Pads calculator.
 * Modeled after SleeveInputs, but without the 'option' field.
 * The antimicrobial choice will be handled by a boolean in the logic.
 */
export interface PadsInputs {
  productName: string;
  widthWhole: number;
  widthFraction: number;
  lengthWhole: number;
  lengthFraction: number;
}

/**
 * The final calculated result for a Pad quote.
 * Identical in structure to SleeveResult for consistency.
 */
export interface PadsResult {
  partNumber: string;
  price: number;
  cartonQty: number;
  cartonPrice: number;
  errors: string[];
  debugInfo: object;
}

// This is the shape for the joined CrossRef and Master tables
export interface ProductInfo {
  prefix: string;
  standardCartonQty: number;
  atOptionAvailable: boolean;
  min: number; // Added based on PadsProductMaster.csv
  max: number; // Added based on PadsProductMaster.csv
}

// This is for the tiered pricing
export interface PriceTier {
  from: number;
  to: number;
  standardPrice: number;
  atPrice?: number; // atPrice is optional
}

/**
 * The main data object holding all parsed and structured data for the Pads calculator.
 */
export interface PadsData {
  // Map<ProductName, ProductInfo>
  productInfo: Map<string, ProductInfo>;
  // Map<Decimal, LetterCode>
  fractionalCodes: Map<number, string>;
  // Map<PartNumberKey, ReturnValue>
  priceExceptions: Map<string, string>;
  // The nested pricing object
  padPricing: { // Changed to be a Map for consistency with other data structures
    [prefix: string]: { standard: PriceTier[]; at: PriceTier[]; };
  };
  // Separate structures for under 26 (per prefix) and universal length tiers (over 26)
  cartonQty: { qtyUnder26: Map<string, number>; universalLengthTiers: { from: number; to: number; qty: number; }[]; };
}