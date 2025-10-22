// src/components/PleatsCalc.tsx

import { useState, useEffect } from 'react';
import CalculatorTemplate from '../ui/CalculatorTemplate';
import FormField from '../ui/FormField';
import PricingResult from '../ui/PricingResult';
import { usePricingData } from '../../hooks/usePricingData';
import { calculatePleatPrice, type PleatInputs } from '../../logic/pleatLogic';

interface PleatsCalcProps {
  onCalculate: (productType: string, config: object, price: number, quoteDetails: object) => void;
}
export const PleatsCalc = ({ onCalculate }: PleatsCalcProps) => {
  // Hook to load all our CSV data
  const { data, isLoading, error } = usePricingData();

  const [inputMode, setInputMode] = useState<'decimal' | 'fractional'>('fractional'); // New state for input mode

  // State to hold the user's form inputs
  const [inputs, setInputs] = useState<PleatInputs>({
    productFamily: '', // Will be set once data is loaded
    widthWhole: 12,
    widthFraction: 0,
    lengthWhole: 24,
    lengthFraction: 0,
    depth: 1 as 1 | 2 | 4,
    isExact: false,
  });

  // New states for decimal input fields, synchronized with initial inputs
  const [decimalWidth, setDecimalWidth] = useState<number>(inputs.widthWhole + inputs.widthFraction);
  const [decimalLength, setDecimalLength] = useState<number>(inputs.lengthWhole + inputs.lengthFraction);

  // State to hold the final calculated part number
  // Let's manage the full quote result in state
  const [pricingResult, setPricingResult] = useState({ 'Part Number': 'N/A', 'Price': 0, 'Carton Quantity': 0, 'Carton Price': 0 });

  // This effect runs once when the data is loaded to set the initial product family
  useEffect(() => {
    if (data?.productFamilyCodes?.[0]?.Name) {
      setInputs((currentInputs) => ({
        ...currentInputs,
        productFamily: data.productFamilyCodes[0].Name, // Set default product family
        // Initialize fractions to 0 if not already set
        widthFraction: currentInputs.widthFraction || 0,
        lengthFraction: currentInputs.lengthFraction || 0,
      }));
      // Also update decimal inputs if they haven't been explicitly set yet
      setDecimalWidth(inputs.widthWhole + inputs.widthFraction);
      setDecimalLength(inputs.lengthWhole + inputs.lengthFraction);
    }
  }, [data]); // Only run this when `data` changes

  // Effect to synchronize decimal and fractional inputs when mode changes
  useEffect(() => {
    if (inputMode === 'decimal') {
      setDecimalWidth(inputs.widthWhole + inputs.widthFraction);
      setDecimalLength(inputs.lengthWhole + inputs.lengthFraction);
    }
  }, [inputMode, inputs.widthWhole, inputs.widthFraction, inputs.lengthWhole, inputs.lengthFraction]);

  // Find the current product code to determine available depths
  const currentProductCode = data?.productFamilyCodes.find(
    (p) => p.Name === inputs.productFamily
  )?.Product_Prefix;

  const restrictedDepthProducts = [11204, 12204];
  const isDepthRestricted = currentProductCode ? restrictedDepthProducts.includes(currentProductCode) : false;

  // This effect will run when the product family changes.
  // If the new product has restricted depth and the current depth is 4, reset it.
  useEffect(() => {
    if (isDepthRestricted && inputs.depth === 4) {
      setInputs((prev) => ({ ...prev, depth: 1 })); // Reset to a valid depth
    }
  }, [inputs.productFamily, isDepthRestricted, inputs.depth]);

  // This "effect" runs whenever the user's inputs change to calculate the new price
  useEffect(() => {
    if (data) {
      const result = calculatePleatPrice(inputs, data);
      // If there's an override note, display it instead of the price.
      setPricingResult({
        'Part Number': result.partNumber,
        'Price': result.notes || result.price,
        'Carton Quantity': result.notes ? 0 : result.cartonQuantity,
        'Carton Price': result.notes ? 0 : result.cartonPrice,
      });
    } else {
      setPricingResult({ 'Part Number': 'Loading...', 'Price': 0, 'Carton Quantity': 0, 'Carton Price': 0 });
    }
  }, [inputs, data]); // Dependency array: triggers recalculation on input change

  // Handler for decimal width input change
  const handleDecimalWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setDecimalWidth(value);
    const whole = Math.floor(value);
    const fraction = value - whole;
    setInputs((prev) => ({ ...prev, widthWhole: whole, widthFraction: fraction }));
  };

  // Handler for decimal length input change
  const handleDecimalLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setDecimalLength(value);
    const whole = Math.floor(value);
    const fraction = value - whole;
    setInputs((prev) => ({ ...prev, lengthWhole: whole, lengthFraction: fraction }));
  };

  // Handler for fractional width whole part change
  const handleWidthWholeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Parse as an integer to prevent decimals in the whole number field
    const value = parseInt(e.target.value, 10);
    setInputs((prev) => ({ ...prev, widthWhole: isNaN(value) ? 0 : value }));
  };

  // Handler for fractional width fraction part change
  const handleWidthFractionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number(e.target.value);
    setInputs((prev) => ({ ...prev, widthFraction: value }));
  };

  // Handler for fractional length whole part change
  const handleLengthWholeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Parse as an integer to prevent decimals in the whole number field
    const value = parseInt(e.target.value, 10);
    setInputs((prev) => ({ ...prev, lengthWhole: isNaN(value) ? 0 : value }));
  };

  // Handler for fractional length fraction part change
  const handleLengthFractionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number(e.target.value);
    setInputs((prev) => ({ ...prev, lengthFraction: value }));
  };

  // --- Render Logic ---
  if (isLoading) {
    return <div>Loading pricing data...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const handleAddToDashboard = () => {
    if (pricingResult && pricingResult.Price > 0) {
      onCalculate('pleats', inputs, pricingResult.Price, {
        partNumber: pricingResult['Part Number'],
        cartonQuantity: pricingResult['Carton Quantity'],
        cartonPrice: pricingResult['Carton Price'],
      });
    }
  };

  return (
    <CalculatorTemplate
      title="Pleats Calculator"
      description="Configure your pleat specifications and get instant pricing"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <FormField label="Product Family">
            <select
              value={inputs.productFamily}
              onChange={(e) => setInputs({ ...inputs, productFamily: e.target.value })}
              className="w-full p-3 border rounded-md bg-white"
            >
              {data?.productFamilyCodes.map((family) => (
                <option key={family.Name} value={family.Name}>
                  {family.Name}
                </option>
              ))}
            </select>
          </FormField>

          {/* Input Mode Toggle */}
          <div className="flex items-center justify-start space-x-3 mb-4">
            <span className={`font-medium ${inputMode === 'fractional' ? 'text-blue-600' : 'text-gray-500'}`}>Fractional</span>
            <button
              type="button"
              onClick={() => setInputMode(inputMode === 'fractional' ? 'decimal' : 'fractional')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                inputMode === 'decimal' ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              aria-label="Toggle input mode"
            >
              <span
                aria-hidden="true"
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${inputMode === 'decimal' ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
            <span className={`font-medium ${inputMode === 'decimal' ? 'text-blue-600' : 'text-gray-500'}`}>Decimal</span>
          </div>

          {inputMode === 'fractional' ? (
            <>
              <FormField label="Width (inches)">
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={inputs.widthWhole}
                    onChange={handleWidthWholeChange}
                    placeholder="Whole"
                    className="w-1/2 p-3 border rounded-md"
                    min="0"
                    step="1" // Prevent decimal input here
                  />
                  <select
                    value={inputs.widthFraction}
                    onChange={handleWidthFractionChange}
                    className="w-1/2 p-3 border rounded-md bg-white"
                  >
                    {data?.fractionalCodes.map((code) => (
                      <option key={`w-${code.Decimal_Value}`} value={code.Decimal_Value}>
                        {code.Fraction_Text}
                      </option>
                    ))}
                  </select>
                </div>
              </FormField>
              <FormField label="Length (inches)">
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={inputs.lengthWhole}
                    onChange={handleLengthWholeChange}
                    placeholder="Whole"
                    className="w-1/2 p-3 border rounded-md"
                    min="0"
                    step="1" // Prevent decimal input here
                  />
                  <select
                    value={inputs.lengthFraction}
                    onChange={handleLengthFractionChange}
                    className="w-1/2 p-3 border rounded-md bg-white"
                  >
                    {data?.fractionalCodes.map((code) => (
                      <option key={`l-${code.Decimal_Value}`} value={code.Decimal_Value}>
                        {code.Fraction_Text}
                      </option>
                    ))}
                  </select>
                </div>
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Width (inches)">
                <input
                  type="number"
                  value={decimalWidth}
                  onChange={handleDecimalWidthChange}
                  placeholder="e.g., 12.5"
                  className="w-full p-3 border rounded-md"
                  step="any" // Allow decimal input here
                />
              </FormField>
              <FormField label="Length (inches)">
                <input
                  type="number"
                  value={decimalLength}
                  onChange={handleDecimalLengthChange}
                  placeholder="e.g., 24.75"
                  className="w-full p-3 border rounded-md"
                  step="any" // Allow decimal input here
                />
              </FormField>
            </>
          )}
          <FormField label="Depth (inches)">
            <select
              value={inputs.depth}
              onChange={(e) => {
                const value = Number(e.target.value) as 1 | 2 | 4;
                setInputs({ ...inputs, depth: value });
              }}
              className="w-full p-3 border rounded-md bg-white"
            >
              <option value={1}>1"</option>
              <option value={2}>2"</option>
              {!isDepthRestricted && <option value={4}>4"</option>}
            </select>
          </FormField>
          <FormField label="Made Exact?">
            <div className="flex items-center space-x-4"><label className="flex items-center"><input type="radio" name="isExact" value="yes" checked={inputs.isExact} onChange={() => setInputs({ ...inputs, isExact: true })} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" /><span className="ml-2">Yes</span></label><label className="flex items-center"><input type="radio" name="isExact" value="no" checked={!inputs.isExact} onChange={() => setInputs({ ...inputs, isExact: false })} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" /><span className="ml-2">No</span></label></div>
          </FormField>
        </div>
        <PricingResult results={pricingResult} onCalculate={handleAddToDashboard} />
      </div>
    </CalculatorTemplate>
  );
};