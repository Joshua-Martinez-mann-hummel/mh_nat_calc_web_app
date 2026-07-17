/**
 * @file The core calculation engine for the ProShield calculator.
 * This file contains the primary logic for determining part number, price,
 * and other quote details based on user inputs and loaded CSV data.
 * It is a direct translation of the logic from `hugo_calc.py`.
 */

import type {
  ProShieldData,
  ProShieldInputs,
  ProShieldPricingResult,
  ProShieldDebugInfo,
} from '../data/NewProductData/newProductDataTypes.js';

// Helper for excel-style rounding
const excelRound = (val: number, digits = 2): number => {
  const multiplier = 10 ** digits;
  return Math.floor(val * multiplier + 0.5) / multiplier;
};

/**
 * Translates the brute-force loop from the legacy Excel sheet.
 * An array is created stepping from 12.0 down to 10.0 by 1/32 (65 steps)
 * to find an optimal divisor for even fastener spacing.
 * @param length The dimension (height or width) to calculate segments for.
 * @returns The number of optimal segments.
 */
const getOptimalSegments = (length: number): number => {
  const divisors: number[] = Array.from({ length: 65 }, (_, i) => 12.0 - i * (1 / 32));

  let bestDivisor: number | null = null;
  let min_dist = Infinity;
  let best_divisor_min_dist: number | null = null;

  for (const d of divisors) {
    const val = length / d;
    const dist = Math.abs(val - Math.round(val));

    if (dist < min_dist) {
      min_dist = dist;
      best_divisor_min_dist = d;
    }

    if (bestDivisor === null && dist <= 0.03125) {
      bestDivisor = d;
    }
  }

  const final_divisor = bestDivisor !== null ? bestDivisor : best_divisor_min_dist;
  if (final_divisor === null || final_divisor === 0) {
      return 0; // Avoid division by zero
  }
  return length / final_divisor;
};

/**
 * Snaps a dimension to the nearest 1/8th and formats it for the part number
 * using a specific letter map for fractions.
 * @param val The dimension value.
 * @param fractionalCodes A map from decimal value to letter code.
 * @returns The formatted dimension string.
 */
const formatDim = (val: number, fractionalCodes: Map<number, string>): string => {
  const snappedVal = Math.round(val * 8) / 8;
  const whole = Math.trunc(snappedVal);
  const frac = parseFloat((snappedVal - whole).toPrecision(15));

  const fracCode = fractionalCodes.get(frac);
  return fracCode ? `${whole}${fracCode}` : String(whole);
};

/**
 * The main calculation engine for ProShield products.
 * Translates the `calculate_net_price` function from `hugo_calc.py`.
 */
export const calculateProShieldPrice = (
  inputs: ProShieldInputs,
  data: ProShieldData
): ProShieldPricingResult => {
  const { height, width, materialId, fastenerId } = inputs;
  const { constants, materials, fasteners, fractionalCodes } = data;
  
  const calculationSteps: string[] = [];
  const log = (msg: string) => calculationSteps.push(msg);

  const warnings: string[] = [];
  const errors: string[] = [];

  const result: ProShieldPricingResult = {
    partNumber: 'N/A',
    price: 0,
    trueCost: 0,
    fastenerQty: 0,
    notes: [],
  };

  const material = materials.get(materialId);
  const fastener = fasteners.get(fastenerId);

  if (!material || !fastener) {
    if (!material) errors.push(`Material with ID '${materialId}' not found.`);
    if (!fastener) errors.push(`Fastener with ID '${fastenerId}' not found.`);
    result.notes = errors;
    return result;
  }

  log(`--- New Calculation: ${new Date().toISOString()} ---`);
  log(`Inputs: Height=${height}", Width=${width}"`);
  log(`Material: ${material.Name}`);
  log(`Fastener: ${fastener.Name}`);

  // 1. PERIMETER & FASTENER COUNT
  log('\n1. PERIMETER & FASTENER COUNT');
  const perimeterInches = height * 2 + width * 2;
  log(`   Perimeter: (${height} * 2) + (${width} * 2) = ${perimeterInches} inches`);

  let fastenerQty = 0;
  if (fastenerId === '4' || fastenerId === '5') { // Industrial Velcro or None
    log(`   Fastener Type is ${fastener.Name}, so discrete fastener quantity is 0.`);
  } else {
    const hQty = getOptimalSegments(height);
    const wQty = getOptimalSegments(width);
    fastenerQty = Math.floor(hQty * 2 + wQty * 2 + 0.5);
    log(`   Fastener Qty: Calculated optimal segments (height=${hQty.toFixed(2)}, width=${wQty.toFixed(2)}). Total = Math.floor(((${hQty.toFixed(2)}*2) + (${wQty.toFixed(2)}*2)) + 0.5) = ${fastenerQty} units`);
  }
  result.fastenerQty = fastenerQty;

  // 2. LABOR CALCULATION
  log('\n2. LABOR CALCULATION');
  const k36_base_minutes = 10 + width / 10;
  const k37_perimeter_minutes = 10 + perimeterInches / 50;
  log(`   Base Minutes: 10 + (Width ${width} / 10) = ${k36_base_minutes.toFixed(2)} mins`);
  log(`   Perimeter Minutes: 10 + (Perimeter ${perimeterInches} / 50) = ${k37_perimeter_minutes.toFixed(2)} mins`);

  let k38_39_fastener_minutes = 0;
  if (fastener.Name.includes('PERMALOCK')) {
    k38_39_fastener_minutes = 1.5 * fastenerQty;
    log(`   Fastener Minutes: 1.5 * ${fastenerQty} = ${k38_39_fastener_minutes.toFixed(2)} mins (Permalock type)`);
  } else if (fastenerId !== '4' && fastenerId !== '5') {
    k38_39_fastener_minutes = 0.75 * fastenerQty;
    log(`   Fastener Minutes: 0.75 * ${fastenerQty} = ${k38_39_fastener_minutes.toFixed(2)} mins`);
  } else {
    log(`   Fastener Minutes: 0 mins (${fastener.Name})`);
  }

  const extra_time_k42 = constants.get('extra_time_k42')!;
  const variable_rate_n2 = constants.get('variable_rate_n2')!;
  const base_rate_n1 = constants.get('base_rate_n1')!;

  const labor_cost_base_cad = k36_base_minutes * variable_rate_n2;
  const labor_cost_additional_cad = (k37_perimeter_minutes + k38_39_fastener_minutes + extra_time_k42) * base_rate_n1;
  const total_labor_cost_cad = labor_cost_base_cad + labor_cost_additional_cad;
  log(`   Base Labor Cost CAD: ${k36_base_minutes.toFixed(2)} mins * ${variable_rate_n2.toFixed(4)} $/min = $${labor_cost_base_cad.toFixed(2)}`);
  log(`   Additional Labor Cost CAD: (${k37_perimeter_minutes.toFixed(2)} + ${k38_39_fastener_minutes.toFixed(2)} + ${extra_time_k42}) * ${base_rate_n1.toFixed(4)} $/min = $${labor_cost_additional_cad.toFixed(2)}`);
  log(`   Total Labor Cost CAD: $${labor_cost_base_cad.toFixed(2)} + $${labor_cost_additional_cad.toFixed(2)} = $${total_labor_cost_cad.toFixed(2)}`);

  // 3. MATERIAL YIELD CALCULATION
  log('\n3. MATERIAL YIELD CALCULATION');
  const roll_width = constants.get(material.Roll_Width_Key)!;
  const margin_l = constants.get('spec_b16')!;
  const margin_w = constants.get('spec_e16')!;

  // Standard Orientation
  let screens_along_length = width > 0 ? Math.floor(3600 / (width + margin_l)) : 0;
  let screens_across_width = height > 0 ? Math.floor((roll_width - margin_w) / height) : 0;
  let max_yield = screens_along_length * screens_across_width;

  // Rotated 90 Degrees Optimization
  const screens_along_swapped = height > 0 ? Math.floor(3600 / (height + margin_l)) : 0;
  const screens_across_swapped = width > 0 ? Math.floor((roll_width - margin_w) / width) : 0;
  const swapped_yield = screens_along_swapped * screens_across_swapped;

  if (swapped_yield > max_yield) {
    screens_along_length = screens_along_swapped;
    screens_across_width = screens_across_swapped;
    log(`   Optimal yield found by rotating screen 90 degrees.`);
  }

  log(`   Screens Along Length: floor = ${screens_along_length}`);
  log(`   Screens Across Width: floor = ${screens_across_width}`);

  let yards_per_screen = 0;
  if (screens_along_length === 0 || screens_across_width === 0) {
    yards_per_screen = 0;
    log('   [❌ ERROR] Screen is too big for the roll. Yards per screen = 0');
    errors.push(`Dimensions exceed maximum cut size. At least one dimension (Height or Width) must be ${roll_width - margin_w}" or less to fit on the ${roll_width}" roll.`);
  } else {
    yards_per_screen = 100 / (screens_along_length * screens_across_width);
    log(`   Yards per Screen: 100 / (${screens_along_length} * ${screens_across_width}) = ${yards_per_screen.toFixed(4)} yards`);
  }

  const mat_cost_per_yd = constants.get(material.Cost_Key)!;
  const material_cost_cad = yards_per_screen * mat_cost_per_yd;
  log(`   Material Cost CAD: ${yards_per_screen.toFixed(4)} yds * $${mat_cost_per_yd.toFixed(4)}/yd = $${material_cost_cad.toFixed(2)}`);

  // 4. FASTENER & VELCRO COST
  log('\n4. FASTENER & VELCRO COST');
  let fastener_cost_cad = 0;
  if (fastenerId === '4') { // Velcro
    const feet = perimeterInches / 12;
    const velcro_usd = feet * 1.00; // Placeholder cost
    fastener_cost_cad = velcro_usd * 1.34; // Placeholder exchange rate
    log(`   [⚠️ WARNING] Velcro $1.00 USD/ft cost and 0.00 additional labor minutes are temporary placeholders.`);
    log(`   Velcro Placeholder Cost: ${feet.toFixed(2)} ft * $1.00 USD/ft * 1.34 CAD/USD = $${fastener_cost_cad.toFixed(2)} CAD`);
  } else if (fastenerId === '5') { // None
    fastener_cost_cad = 0;
    log(`   Fastener is NONE. Cost is $0.00 CAD`);
  } else {
    const unit_cost = constants.get(fastener.Cost_Key)!;
    fastener_cost_cad = fastenerQty * unit_cost;
    log(`   Discrete Fastener Cost: ${fastenerQty} units * $${unit_cost.toFixed(4)}/unit = $${fastener_cost_cad.toFixed(2)} CAD`);
    if (fastener.Name.includes('PERMALOCK')) {
      fastener_cost_cad *= 2;
      log(`   Fastener is Permalock. Doubling cost to account for Top and Bottom pieces: $${fastener_cost_cad.toFixed(2)} CAD`);
    }
  }

  // 5. PERIMETER/EDGE BANDING & THREAD
  log('\n5. PERIMETER/EDGE BANDING & THREAD');
  const spec_j27 = constants.get('spec_j27')!;
  const spec_k27 = constants.get('spec_k27')!;
  const edge_banding_yards = (100 * (perimeterInches + margin_l) * spec_j27) / (3600 * (spec_k27 - margin_w));
  const edge_banding_cost_cad = edge_banding_yards * constants.get('edge_banding_per_yard')!;
  
  const thread_yards = (perimeterInches * 2.75 * 2) / 36;
  const thread_unit_cost = constants.get('thread')!;
  const thread_cost_cad = 2 * thread_unit_cost * thread_yards;

  log(`   Edge Banding Yield CAD: 100 * (${perimeterInches} + ${margin_l}) * ${spec_j27} / (3600 * (${spec_k27} - ${margin_w})) = ${edge_banding_yards.toFixed(4)} yds`);
  log(`   Edge Banding Cost CAD: ${edge_banding_yards.toFixed(4)} yds * $${constants.get('edge_banding_per_yard')!.toFixed(2)}/yd = $${edge_banding_cost_cad.toFixed(2)}`);
  log(`   Thread Cost CAD: 2 * $${thread_unit_cost.toFixed(4)} * ${thread_yards.toFixed(4)} yds = $${thread_cost_cad.toFixed(2)}`);
  const edge_banding_total_cad = edge_banding_cost_cad + thread_cost_cad;
  log(`   Total Edge Banding + Thread: $${edge_banding_total_cad.toFixed(2)} CAD`);

  // 6. TOTAL COST ROLL-UP
  log('\n6. TOTAL COST ROLL-UP');
  const handling_fee_cad = constants.get('coutant_i42_extra')!;
  log(`   Handling Fee CAD: $${handling_fee_cad.toFixed(2)}`);

  const total_raw_cad = material_cost_cad + total_labor_cost_cad + fastener_cost_cad + edge_banding_total_cad + handling_fee_cad;
  log(`   Total Raw Cost CAD: ${material_cost_cad.toFixed(2)} + ${total_labor_cost_cad.toFixed(2)} + ${fastener_cost_cad.toFixed(2)} + ${edge_banding_total_cad.toFixed(2)} + ${handling_fee_cad.toFixed(2)} = $${total_raw_cad.toFixed(2)}`);

  const overhead_margin = constants.get('overhead_margin_n5')!;
  const final_cost_cad = total_raw_cad * (1 + overhead_margin);
  log(`   Final Cost CAD (with Overhead): $${total_raw_cad.toFixed(2)} * ${(1 + overhead_margin).toFixed(2)} = $${final_cost_cad.toFixed(2)}`);

  // 7. CURRENCY CONVERSION & MARKUP
  log('\n7. CURRENCY CONVERSION & MARKUP');
  const snappedHeightStr = formatDim(height, fractionalCodes);
  const snappedWidthStr = formatDim(width, fractionalCodes);
  const mat_suffix = material.Code_Suffix || '';
  const fast_suffix = fastener.Code_Suffix || '';
  result.partNumber = `PROSHIELD-${snappedHeightStr}x${snappedWidthStr}${mat_suffix}${fast_suffix}`;
  log(`   Part Number Generated: ${result.partNumber}`);

  const exchange_rate_cad_to_usd = constants.get('exchange_rate_cad_to_usd')!;
  const net_price_markup = constants.get('net_price_markup')!;
  const cost_usd = final_cost_cad / exchange_rate_cad_to_usd;
  const net_price_usd = excelRound(cost_usd * net_price_markup, 2);
  const true_cost_usd = excelRound(cost_usd, 2);

  log(`   True Cost USD calculation: $${final_cost_cad.toFixed(2)} CAD / ${exchange_rate_cad_to_usd} = $${true_cost_usd.toFixed(2)} USD`);
  log(`   New Net Price USD calculation: $${true_cost_usd.toFixed(2)} USD * ${net_price_markup.toFixed(2)} = $${net_price_usd.toFixed(2)} USD`);
  log('--- End of Calculation ---\n');

  if (errors.length > 0) {
    result.price = 0;
    result.trueCost = 0;
    result.notes = errors;
  } else {
    result.price = net_price_usd;
    result.trueCost = true_cost_usd;
    result.icPrice = excelRound(true_cost_usd * 1.20, 2);
    result.notes = warnings;
  }

  const debugInfo: ProShieldDebugInfo = {
    inputs,
    perimeter: perimeterInches,
    fastenerQty,
    labor: {
      baseMinutes: k36_base_minutes,
      perimeterMinutes: k37_perimeter_minutes,
      fastenerMinutes: k38_39_fastener_minutes,
      totalLaborCostCAD: total_labor_cost_cad,
    },
    material: {
      rollWidth: roll_width,
      screensAlongLength: screens_along_length,
      screensAcrossWidth: screens_across_width,
      yardsPerScreen: yards_per_screen,
      materialCostCAD: material_cost_cad,
    },
    fastener: {
      fastenerCostCAD: fastener_cost_cad,
    },
    edge: {
      edgeBandingYards: edge_banding_yards,
      edgeBandingCostCAD: edge_banding_cost_cad,
      threadYards: thread_yards,
      threadCostCAD: thread_cost_cad,
      totalEdgeBandingAndThreadCAD: edge_banding_total_cad,
    },
    cost: {
      handlingFeeCAD: handling_fee_cad,
      totalRawCAD: total_raw_cad,
      finalCostCAD: final_cost_cad,
      trueCostUSD: true_cost_usd,
    },
    price: {
      netPriceUSD: net_price_usd,
    },
    partNumber: {
      snappedHeight: snappedHeightStr,
      snappedWidth: snappedWidthStr,
      materialSuffix: mat_suffix,
      fastenerSuffix: fast_suffix,
      finalPartNumber: result.partNumber,
    },
    warnings,
    calculationSteps,
  };

  result.debugInfo = debugInfo;
  
  return result;
};
