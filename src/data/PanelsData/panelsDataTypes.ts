/**
 * @file Defines the TypeScript interfaces for the Panels-Links calculator.
 * This includes types for user inputs, the structured data loaded from CSV files,
 * and the final calculation result.
 */

/**
 * Defines the user inputs for the Panels-Links calculator form.
 */
export interface PanelsLinksInputs {
  productFamily: string;
  addOn: string; // e.g., 'Standard' or 'Antimicrobial'
  type: string; // e.g., 'Panel' or 'Link'
  numberOfPanels: number;
  isExact: boolean;
  heightWhole: number;
  heightFraction: number;
  widthWhole: number;
  widthFraction: number;
}

/**
 * Represents a single row from the custom pricing CSV file (PanelsPricing.csv).
 * This is a helper interface for structuring the pricing data.
 */
export interface PanelCustomPriceRow {
  type: string;
  media: string;
  height: string;
  width: string;
  rangeFrom: number;
  rangeTo: number;
  priceCustomStandard: number;
  PriceCustomAt: string; // Note: This can be a string like 'N/A' or a numeric string
}

/**
 * The main data container for all data loaded from the Panels-Links CSV files.
 * This object is passed to the core calculation logic.
 */
export interface PanelsLinksData {
  productInfo: Map<string, string>;
  standardOverrides: Map<string, string>;
  linkTiers: { lengthMax: number; btnPanels: number }[];
  customPriceList: PanelCustomPriceRow[];
  fractionalCodes: Map<number, string>;
}

/**
 * Defines the structure of the final result object returned by the calculation engine.
 */
export interface PanelsLinksResult {
  partNumber: string;
  price: number;
  rangeOfLinkWidth: string;
  cartonQty: number;
  cartonPrice: number;
  errors: string[];
  debugInfo: object;
}