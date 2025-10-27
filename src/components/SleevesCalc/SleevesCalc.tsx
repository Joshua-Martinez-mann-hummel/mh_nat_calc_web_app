import React, { useState, useEffect, useMemo } from 'react';
import CalculatorTemplate from '../ui/CalculatorTemplate.tsx';
import FormField from '../ui/FormField.tsx';
import PricingResult from '../ui/PricingResult.tsx';
import { useSleevesData } from '../../hooks/useSleevesData';
import { calculateSleeves, type SleeveInputs, type SleeveResult } from '../../logic/sleevesLogic';

// Define the component's props interface
interface SleevesCalcProps {
  onCalculate: (productType: string, config: object, price: number, quoteDetails: object) => void;
}

const initialSleeveResult: SleeveResult = {
  partNumber: 'N/A',
  price: 0,
  cartonQty: 0,
  cartonPrice: 0,
  errors: [],
  debugInfo: {},
};

const initialInputs: SleeveInputs = {
  productName: '',
  option: '',
  widthWhole: 12,
  widthFraction: 0,
  lengthWhole: 24,
  lengthFraction: 0,
};

function SleevesCalc({ onCalculate }: SleevesCalcProps) {
  const { data, isLoading, error } = useSleevesData();
  const [inputMode, setInputMode] = useState<'decimal' | 'fractional'>('fractional');
  const [inputs, setInputs] = useState<SleeveInputs>(initialInputs);
  const [pricingResult, setPricingResult] = useState<SleeveResult>(initialSleeveResult);

  // New states for decimal input fields, synchronized with initial inputs
  const [decimalWidth, setDecimalWidth] = useState<number>(initialInputs.widthWhole + initialInputs.widthFraction);
  const [decimalLength, setDecimalLength] = useState<number>(initialInputs.lengthWhole + initialInputs.lengthFraction);

  // Set initial state once data is loaded
  useEffect(() => {
    if (data?.productMaster?.[0]) {
      setInputs((prev) => ({
        ...prev,
        productName: data.productMaster[0].productName,
        option: data.productMaster[0].options.split(',')[0]
      }));
      // Also update decimal inputs
      setDecimalWidth(initialInputs.widthWhole + initialInputs.widthFraction);
      setDecimalLength(initialInputs.lengthWhole + initialInputs.lengthFraction);
    }
  }, [data]);

  // Effect to synchronize decimal and fractional inputs when mode changes or values update
  useEffect(() => {
    if (inputMode === 'decimal') {
      setDecimalWidth(inputs.widthWhole + inputs.widthFraction);
      setDecimalLength(inputs.lengthWhole + inputs.lengthFraction);
    }
  }, [inputMode, inputs.widthWhole, inputs.widthFraction, inputs.lengthWhole, inputs.lengthFraction]);

  // Memoize product options to avoid re-calculating on every render
  const currentProductOptions = useMemo(() => {
    if (!data) return [];
    const product = data.productMaster.find((p) => p.productName === inputs.productName);
    return product ? product.options.split(',') : [];
  }, [inputs.productName, data]);

  // Reset option if it's not valid for the selected product
  useEffect(() => {
    if (currentProductOptions.length > 0 && !currentProductOptions.includes(inputs.option)) {
      setInputs((prev) => ({ ...prev, option: currentProductOptions[0] }));
    }
  }, [inputs.productName, currentProductOptions, inputs.option]);

  // This "effect" runs whenever the user's inputs change to calculate the new price
  useEffect(() => {
    if (data) {  // Add safety check to ensure data is loaded before calculating
      const totalWidth = inputs.widthWhole + inputs.widthFraction;
      const totalLength = inputs.lengthWhole + inputs.lengthFraction;

      if (!inputs.productName || totalWidth <= 0 || totalLength <= 0) {
        setPricingResult(initialSleeveResult);
        return;
      }
      const result = calculateSleeves(inputs, data);
      setPricingResult(result);
    }
  }, [inputs, data]);

  // A derived state for what's shown in the UI, which can include notes.
  const displayResult = {
    'Part Number': pricingResult?.partNumber || 'N/A',
    Price: pricingResult.errors.length > 0 ? pricingResult.errors.join(', ') : pricingResult?.price || 0,
    'Carton Quantity': pricingResult.errors.length > 0 ? 0 : pricingResult?.cartonQty || 0,
    'Carton Price': pricingResult.errors.length > 0 ? 0 : pricingResult?.cartonPrice || 0,
  };

  const handleAddToDashboard = () => {
    if (pricingResult && pricingResult.price > 0) {
      onCalculate('sleeves', inputs, pricingResult.price, pricingResult);
    }
  };

  // Handler for decimal width input change
  const handleDecimalWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setDecimalWidth(value);
    const whole = Math.floor(value);
    const fraction = value - whole;
    // Find the closest valid fraction to avoid floating point issues
    const closestFraction = data?.fractionalCodes.reduce((prev, curr) => 
      (Math.abs(curr.DecimalValue - fraction) < Math.abs(prev.DecimalValue - fraction) ? curr : prev)
    ).DecimalValue || 0;
    setInputs((prev) => ({ ...prev, widthWhole: whole, widthFraction: closestFraction }));
  };

  // Handler for decimal length input change
  const handleDecimalLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setDecimalLength(value);
    const whole = Math.floor(value);
    const fraction = value - whole;
    // Find the closest valid fraction
    const closestFraction = data?.fractionalCodes.reduce((prev, curr) => 
      (Math.abs(curr.DecimalValue - fraction) < Math.abs(prev.DecimalValue - fraction) ? curr : prev)
    ).DecimalValue || 0;
    setInputs((prev) => ({ ...prev, lengthWhole: whole, lengthFraction: closestFraction }));
  };

// Handle loading and error states FIRST
if (isLoading) {
  return <div>Loading Sleeves Data...</div>;
}

if (error) {
  return <div>Error loading data: {error.message}</div>;
}

if (!data) {
  return <div>No data available.</div>;
}

  // --- Dropdown Options Generation (inside render logic) ---
  const generateIntList = (min: number, max: number) => {
    const list = [];
    for (let i = min; i <= max; i++) {
      list.push(i);
    }
    return list;
  };

  const currentRule = data.validationRules.find(r => r.productName === inputs.productName);
  const widthDropdownOptions = currentRule
    ? generateIntList(4, currentRule.dropdownWidthMax)
    : [];
  const lengthDropdownOptions = currentRule
    ? generateIntList(4, currentRule.dropdownLengthMax)
    : [];

  return (
    <CalculatorTemplate title="Sleeves Calculator" description="Configure sleeve and frame specifications">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <FormField label="Product Family">
            <select
              value={inputs.productName}
              onChange={(e) => setInputs({ ...inputs, productName: e.target.value })}
              className="w-full p-3 border rounded-md bg-white"
            >
              {data.productMaster.map((p) => (
                <option key={p.prefix} value={p.productName}>
                  {p.productName}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Option">
            <select
              value={inputs.option}
              onChange={(e) => setInputs({ ...inputs, option: e.target.value })}
              className="w-full p-3 border rounded-md bg-white"
            >
              {currentProductOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
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
              <select
                value={inputs.widthWhole}
                onChange={(e) => setInputs({ ...inputs, widthWhole: parseInt(e.target.value, 10) })}
                className="w-1/2 p-3 border rounded-md bg-white"
              >
                {widthDropdownOptions.map((val) => (
                  <option key={`w-int-${val}`} value={val}>{val}</option>
                ))}
              </select>
              <select
                value={inputs.widthFraction}
                onChange={(e) => setInputs({ ...inputs, widthFraction: parseFloat(e.target.value) })}
                className="w-1/2 p-3 border rounded-md bg-white"
              >
                {data.fractionalCodes.map((f) => (
                  <option key={`w-frac-${f.DecimalValue}`} value={f.DecimalValue}>{f.FractionText}</option>
                ))}
              </select>
            </div>
          </FormField>
          <FormField label="Length (inches)">
            <div className="flex space-x-2">
              <select
                value={inputs.lengthWhole}
                onChange={(e) => setInputs({ ...inputs, lengthWhole: parseInt(e.target.value, 10) })}
                className="w-1/2 p-3 border rounded-md bg-white"
              >
                {lengthDropdownOptions.map((val) => (
                  <option key={`l-int-${val}`} value={val}>{val}</option>
                ))}
              </select>
              <select
                value={inputs.lengthFraction}
                onChange={(e) => setInputs({ ...inputs, lengthFraction: parseFloat(e.target.value) })}
                className="w-1/2 p-3 border rounded-md bg-white"
              >
                {data.fractionalCodes.map((f) => (
                  <option key={`l-frac-${f.DecimalValue}`} value={f.DecimalValue}>{f.FractionText}</option>
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
                  placeholder="e.g., 8.5"
                  className="w-full p-3 border rounded-md"
                  step="any"
                />
              </FormField>
              <FormField label="Length (inches)">
                <input
                  type="number"
                  value={decimalLength}
                  onChange={handleDecimalLengthChange}
                  placeholder="e.g., 20.0"
                  className="w-full p-3 border rounded-md"
                  step="any"
                />
              </FormField>
            </>
          )}
        </div>
        <PricingResult results={displayResult} onCalculate={handleAddToDashboard}/>
      </div>
    </CalculatorTemplate>
  );
}

export default SleevesCalc;