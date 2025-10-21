// src/data/dataTypes.ts

export interface ProductFamilyCode {
  Name: string;
  Product_Prefix: number;
}

export interface TieredLookupRow {
  Product_Prefix: number;
  Min_Range: number;
  Max_Range: number;
  '1"_Current': number; // Add this line
  '2"_Current': number; // Add this line
  '1"_Update': number;
  '1"_Double': number;
  '1"_Triple': number;
  '2"_Update': number;
  '2"_Double': number;
  '2"_Triple': number;
  '4"_Update': number;
  '4"_Double': number;
  '4"_Triple': number;
}

export interface SpecialOverridePriceRow {
  Lookup_Key: string;
  Override_Price: string;
}

export interface StandardPriceRow {
  Product_Code: number;
  '1"_Price': number;
  '2"_Price': number;
  '4"_Price': number;
}

export interface DimensionThresholdRow {
  Depth: string;
  Limit_Type: 'Standard' | 'Oversize';
  Width_Limit: number;
  Length_Limit: number;
}

// A single object to hold all our structured data
export interface PricingData {
  productFamilyCodes: ProductFamilyCode[];
  tieredLookupMatrix: TieredLookupRow[];
  standardPrices: StandardPriceRow[];
  dimensionThresholds: DimensionThresholdRow[];
  specialOverrideA: SpecialOverridePriceRow[];
  specialOverrideB: SpecialOverridePriceRow[];
}