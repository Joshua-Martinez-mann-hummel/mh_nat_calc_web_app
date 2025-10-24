// @ts-check

/**
 * @typedef {import('../services/sleeveDataService').SleevesData} SleevesData
 */

/**
 * @typedef {Object} SleeveInputs
 * @property {string} productName - The name of the selected product.
 * @property {string} option - The selected option (e.g., "Standard", "Antimicrobial").
 * @property {number} width - The total width (integer + fraction).
 * @property {number} length - The total length (integer + fraction).
 */

/**
 * @typedef {Object} SleeveResult
 * @property {string} partNumber
 * @property {number} price
 * @property {number} cartonQty
 * @property {number} cartonPrice
 * @property {string[]} errors
 * @property {Object} debugInfo - For internal debugging.
 */

/**
 * The main calculation engine for Sleeves and Frames.
 *
 * @param {SleeveInputs} inputs - The user's selections.
 * @param {SleevesData} data - The loaded data from CSV files.
 * @returns {SleeveResult} The calculated quote.
 */
export const calculateSleeves = (inputs, data) => {
  const { productName, option, width, length } = inputs;
  const errors = [];
  const debugInfo = {};

  // --- 1. Find Product Info ---
  const productInfo = data.productMaster.find((p) => p.productName === productName);
  if (!productInfo) {
    errors.push('Selected product not found.');
    return { partNumber: 'N/A', price: 0, cartonQty: 0, cartonPrice: 0, errors, debugInfo };
  }

  const isFrame = productName.includes('Frame');
  debugInfo.isFrame = isFrame;
  debugInfo.productPrefix = productInfo.prefix;

  // --- 2. Part Number Generation ---
  // This logic is simplified for now. We will expand it later.
  const widthWhole = Math.floor(width);
  const widthFracCode = ((width - widthWhole) * 1000).toString().padStart(3, '0');
  const lengthWhole = Math.floor(length);
  const lengthFracCode = ((length - lengthWhole) * 1000).toString().padStart(3, '0');

  const partNumber = `${productInfo.prefix}-${widthWhole.toString().padStart(2, '0')}${widthFracCode}-${lengthWhole.toString().padStart(2, '0')}${lengthFracCode}`;
  debugInfo.partNumber = partNumber;

  // --- 3. Price Calculation ---
  let price = 0;
  const faceValue = width * length;
  debugInfo.faceValue = faceValue;

  if (isFrame) {
    // --- Frame Pricing Logic ---
    let widthGroup = '';
    if (width > 4 && width <= 8.88) widthGroup = 'group1';
    else if (width > 8.88 && width <= 16.875) widthGroup = 'group2';
    else if (width > 16.875 && width <= 33.25) widthGroup = 'group3';
    debugInfo.frameWidthGroup = widthGroup;

    if (widthGroup) {
      const pricingTiers = data.framePricing.filter((p) => p.group === widthGroup);
      const priceTier = pricingTiers.find((t) => faceValue <= t.rangeTo);

      if (priceTier) {
        price = priceTier.price;
        debugInfo.framePriceTier = priceTier;
      } else {
        errors.push('Frame dimensions out of range for pricing.');
      }
    } else {
      errors.push('Frame width is out of range.');
    }

    // Cross-wire logic for frames
    const maxDim = Math.max(width, length);
    const wireRule = data.crossWireRules.find((r) => maxDim <= r.maxDim);
    const wireCost = wireRule ? wireRule.wires * 0.25 : 0; // Assuming $0.25 per wire
    price += wireCost;
    debugInfo.wireRule = wireRule;
    debugInfo.wireCost = wireCost;

  } else {
    // --- Sleeve Pricing Logic ---
    const priceTier = data.sleevePricing.find((t) => faceValue >= t.from && faceValue <= t.to);
    if (priceTier) {
      price = option === 'Antimicrobial' ? priceTier.atPrice : priceTier.standardPrice;
      debugInfo.sleevePriceTier = priceTier;
    } else {
      errors.push('Sleeve dimensions out of range for pricing.');
    }
  }

  debugInfo.initialPrice = price;

  // --- 4. Carton Quantity & Price ---
  let cartonQty = 0;
  let cartonPrice = 0;

  if (isFrame) {
    cartonQty = 100; // Frames are always 100 per carton
  } else {
    // Sleeve carton quantity logic
    const cartonTier = data.sleeveCartonQty.find((t) => length <= t.maxLength);
    if (cartonTier) {
      cartonQty = cartonTier.qty;
      debugInfo.cartonTier = cartonTier;
    } else {
      // If length is over the max in the table, use the last tier's quantity
      cartonQty = data.sleeveCartonQty[data.sleeveCartonQty.length - 1]?.qty || 0;
      debugInfo.cartonTier = 'Over max length, using last tier';
    }
  }

  if (price > 0 && cartonQty > 0) {
    cartonPrice = price * cartonQty;
  }

  return {
    partNumber: errors.length > 0 ? 'N/A' : partNumber,
    price: errors.length > 0 ? 0 : parseFloat(price.toFixed(2)),
    cartonQty: errors.length > 0 ? 0 : cartonQty,
    cartonPrice: errors.length > 0 ? 0 : parseFloat(cartonPrice.toFixed(2)),
    errors,
    debugInfo,
  };
};