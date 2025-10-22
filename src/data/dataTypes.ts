// src/data/dataTypes.ts

export interface ProductFamilyCode {
  Name: string;
  Product_Prefix: number;
}

export interface TieredLookupRow {
  Product_Prefix: number;
  Min_Range: number;
  Max_Range: number;
  '1" Current': number;
  '2" Current': number;
  '1" Update': number;
  '1" Double': number;
  '1" Triple': number;
  '2" Update': number;
  '2" Double': number;
  '2" Triple': number;
  '4" Update': number;
  '4" Double': number;
  '4" Triple': number;
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

  Length_Limit: number;
}

export interface FractionalCodeRow {
  Decimal_Value: number;
  Fraction_Text: string;
  Letter_Code: string;
  Part_Number_Code: number;
}

// A single object to hold all our structured data
export interface PricingData {
  productFamilyCodes: ProductFamilyCode[];
  tieredLookupMatrix: TieredLookupRow[];
  standardPrices: StandardPriceRow[];
  dimensionThresholds: DimensionThresholdRow[];
  specialOverrideA: SpecialOverridePriceRow[];
  specialOverrideB: SpecialOverridePriceRow[];
  fractionalCodes: FractionalCodeRow[];
}