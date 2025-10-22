// src/data/dataTypes.ts

export interface ProductFamilyCode {
  Name: string;
  Product_Prefix: number;
}

export interface TieredLookupRow {
  Product_Prefix: number;
  Min_Range: number;
  Max_Range: number;
  '1_Update': number | 'N/A';
  '1_Double': number | 'N/A';
  '1_Triple': number | 'N/A';
  '2_Update': number | 'N/A';
  '2_Double': number | 'N/A';
  '2_Triple': number | 'N/A';
  '4_Update': number | 'N/A';
  '4_Double': number | 'N/A';
  '4_Triple': number | 'N/A';
}

export interface SpecialOverridePriceRow {
  Lookup_Key: string;
  Override_Price: string;
}

export interface StandardPriceRow {
  Product_Code: number;
  '1_Price': number;
  '2_Price': number;
  '4_Price': number;
}

export interface DimensionThresholdRow {
  Depth: number;
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