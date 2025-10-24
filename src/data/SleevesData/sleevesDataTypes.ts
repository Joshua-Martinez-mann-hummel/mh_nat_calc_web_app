export interface SleeveProduct {
  productName: string;
  prefix: string;
  options: string; // Comma-separated
}

export interface SleevePricingTier {
  from: number;
  to: number;
  standardPrice: number;
  atPrice: number;
}

export interface FramePricingTier {
  group: 'group1' | 'group2' | 'group3';
  rangeTo: number;
  price: number;
}

export interface CrossWireRule {
  maxDim: number;
  wires: number;
}

export interface SleeveCartonQty {
  maxLength: number;
  qty: number;
}

export interface SleeveFractionalCode {
  DecimalValue: number;
  LetterCode: string;
  FractionText: string;
}

export interface SleeveValidationRule {
  productName: string;
  prefix: string;
  minWidth: number;
  maxWidth: number;
  minLength: number;
  maxLength: number;
  dropdownWidthMax: number;
  dropdownLengthMax: number;
}

export interface SleevesData {
  productMaster: SleeveProduct[];
  sleevePricing: SleevePricingTier[];
  framePricing: FramePricingTier[];
  crossWireRules: CrossWireRule[];
  sleeveCartonQty: SleeveCartonQty[];
  fractionalCodes: SleeveFractionalCode[];
  validationRules: SleeveValidationRule[];
}