/**
 * @file Type definitions for the ProShield calculator.
 * These interfaces define the shape of the data loaded from CSV files
 * and the inputs/outputs for the calculation logic, mirroring the
 * established patterns from other calculators like pleatLogic.ts.
 */

/**
 * Represents a single row from the ProShieldConstants.csv file.
 * This is used for parsing but the data is flattened into a Map for use.
 */
export interface ProShieldConstantRow {
  Category: 'LABOR' | 'COSTS_CAD' | 'MANUFACTURING' | 'US_CONVERSION';
  Constant_Name: string;
  Value: number;
}

/**
 * Represents a single row from the ProShieldMaterials.csv file.
 */
export interface ProShieldMaterial {
  Material_ID: string;
  Name: string;
  Code_Suffix: string;
  Cost_Key: string;
  Roll_Width_Key: string;
}

/**
 * Represents a single row from the ProShieldFasteners.csv file.
 */
export interface ProShieldFastener {
  Fastener_ID: string;
  Name: string;
  Code_Suffix: string;
  Cost_Key: string;
}

/**
 * The main data object holding all parsed and structured data for the ProShield calculator.
 */
export interface ProShieldData {
  constants: Map<string, number>;
  materials: Map<string, ProShieldMaterial>;
  fasteners: Map<string, ProShieldFastener>;
  fractionalCodes: Map<number, string>;
}

/**
 * User inputs for the ProShield calculator.
 */
export interface ProShieldInputs {
  height: number;
  width: number;
  materialId: string;
  fastenerId: string;
}

/**
 * A detailed breakdown of each step in the calculation for debugging.
 */
export interface ProShieldDebugInfo {
  inputs: ProShieldInputs;
  perimeter: number;
  fastenerQty: number;
  labor: {
    baseMinutes: number;
    perimeterMinutes: number;
    fastenerMinutes: number;
    totalLaborCostCAD: number;
  };
  material: {
    rollWidth: number;
    screensAlongLength: number;
    screensAcrossWidth: number;
    yardsPerScreen: number;
    materialCostCAD: number;
  };
  fastener: {
    fastenerCostCAD: number;
  };
  edge: {
    edgeBandingYards: number;
    edgeBandingCostCAD: number;
    threadYards: number;
    threadCostCAD: number;
    totalEdgeBandingAndThreadCAD: number;
  };
  cost: {
    handlingFeeCAD: number;
    totalRawCAD: number;
    finalCostCAD: number;
    trueCostUSD: number;
  };
  price: {
    netPriceUSD: number;
  };
  partNumber: {
    snappedHeight: string;
    snappedWidth: string;
    materialSuffix: string;
    fastenerSuffix: string;
    finalPartNumber: string;
  };
  warnings: string[];
  calculationSteps: string[];
}

/**
 * The final calculated result for a ProShield quote.
 */
export interface ProShieldPricingResult {
  partNumber: string;
  price: number; // Final Net Price USD
  trueCost: number; // True Cost USD
  fastenerQty: number;
  notes: string[];
  debugInfo?: ProShieldDebugInfo;
}
