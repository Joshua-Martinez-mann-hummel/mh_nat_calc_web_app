import type {
  ProShieldData,
  ProShieldConstantRow,
  ProShieldMaterial,
  ProShieldFastener,
} from '../data/NewProductData/newProductDataTypes';
import { parseCsvFromUrl } from './csvParser';

import constantsUrl from '/src/data/NewProductData/ProShieldConstants.csv?url';
import materialsUrl from '/src/data/NewProductData/ProShieldMaterials.csv?url';
import fastenersUrl from '/src/data/NewProductData/ProShieldFasteners.csv?url';

/**
 * Main data loading function for the ProShield calculator.
 * Fetches CSVs and shapes them into Maps for fast lookup in the logic engine.
 */
export const loadNewProductData = async (): Promise<ProShieldData> => {
  try {
    const [constantsRaw, materialsRaw, fastenersRaw] = await Promise.all([
      parseCsvFromUrl<ProShieldConstantRow>(constantsUrl),
      parseCsvFromUrl<ProShieldMaterial>(materialsUrl),
      parseCsvFromUrl<ProShieldFastener>(fastenersUrl),
    ]);

    const constants = new Map<string, number>();
    constantsRaw.forEach(row => {
      if (row.Constant_Name && row.Value !== undefined) {
        constants.set(row.Constant_Name, row.Value);
      }
    });

    const materials = new Map<string, ProShieldMaterial>();
    materialsRaw.forEach(row => {
      if (row.Material_ID !== undefined) {
        materials.set(row.Material_ID.toString(), row);
      }
    });

    const fasteners = new Map<string, ProShieldFastener>();
    fastenersRaw.forEach(row => {
      if (row.Fastener_ID !== undefined) {
        fasteners.set(row.Fastener_ID.toString(), row);
      }
    });

    // Standard ProShield fractional dimension codes
    const fractionalCodes = new Map<number, string>([
      [0.125, 'A'], [0.25, 'B'], [0.375, 'C'], [0.5, 'D'],
      [0.625, 'F'], [0.75, 'G'], [0.875, 'H'],
    ]);
    
    return { constants, materials, fasteners, fractionalCodes };
  } catch (error) {
    console.error("Error loading ProShield pricing data:", error);
    throw new Error("Could not load ProShield pricing data.");
  }
};
