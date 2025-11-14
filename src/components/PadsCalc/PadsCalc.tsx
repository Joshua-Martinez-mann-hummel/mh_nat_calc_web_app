import React, { useState, useEffect, useMemo } from 'react';
import CalculatorTemplate from '../ui/CalculatorTemplate.tsx';
import FormField from '../ui/FormField.tsx';
import PricingResult from '../ui/PricingResult.tsx';
import { usePadsData } from '../../hooks/usePadsData.js';
import { calculatePads } from '../../logic/padsLogic.js';
import type { PadsInputs, PadsResult } from '../../data/PadsData/padsDataTypes.js';

// Define the component's props interface
interface PadsCalcProps {
  onCalculate: (productType: string, config: object, price: number, quoteDetails: object) => void;
}

const initialPadsResult: PadsResult = {
  partNumber: 'N/A',
  price: 0,
  cartonQty: 0,
  cartonPrice: 0,
  errors: [],
  debugInfo: {},
};

const initialInputs: PadsInputs = {
  productName: '',
  widthWhole: 12,
  widthFraction: 0,
  lengthWhole: 24,
  lengthFraction: 0,
};

function PadsCalc({ onCalculate }: PadsCalcProps) {
  const { data, isLoading, error } = usePadsData();
  const [inputMode, setInputMode] = useState<'decimal' | 'fractional'>('fractional');
  const [inputs, setInputs] = useState<PadsInputs>(initialInputs);
  const [option, setOption] = useState('Standard'); // Separate state for option
  const [availableOptions, setAvailableOptions] = useState<string[]>(['Standard']);
  const [pricingResult, setPricingResult] = useState<PadsResult>(initialPadsResult);

  const [decimalWidth, setDecimalWidth] = useState<number>(initialInputs.widthWhole + initialInputs.widthFraction);
  const [decimalLength, setDecimalLength] = useState<number>(initialInputs.lengthWhole + initialInputs.lengthFraction);

  // Set initial product name once data is loaded
  useEffect(() => {
    if (data?.productInfo) {
      const firstProduct = data.productInfo.keys().next().value;
      if (firstProduct) {
        setInputs((prev) => ({ ...prev, productName: firstProduct }));
      }
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

  useEffect(() => {
    if (data && inputs.productName) {
      const info = data.productInfo.get(inputs.productName);
      
      if (info && info.atOptionAvailable) {
        // This product HAS the AT option
        setAvailableOptions(['Standard', 'Antimicrobial']);
      } else {
        // This product does NOT have the AT option
        setAvailableOptions(['Standard']);
        
        // If the user had "Antimicrobial" selected and changed products,
        // reset them back to "Standard".
        if (option === 'Antimicrobial') {
          setOption('Standard');
        }
      }
    }
  }, [data, inputs.productName, option, setOption]); // Add all dependencies

  // Main calculation "effect" - runs whenever inputs change
  useEffect(() => {
    if (data) {
      const totalWidth = inputs.widthWhole + inputs.widthFraction;
      const totalLength = inputs.lengthWhole + inputs.lengthFraction;

      if (!inputs.productName || totalWidth <= 0 || totalLength <= 0) {
        setPricingResult(initialPadsResult);
        return;
      }
      // Pass the separate 'option' state to the calculate function
      const result = calculatePads({ ...inputs, option }, data);
      setPricingResult(result);
    }
  }, [inputs, option, data]);

  // A derived state for what's shown in the UI, handling errors and notes.
  const { displayResult, displayNote } = useMemo(() => {
    if (!pricingResult) {
      return { displayResult: {}, displayNote: undefined };
    }

    const hasHardError = pricingResult.errors.some(e => e.includes('Antimicrobial'));

    const result = {
      'Part Number': pricingResult.partNumber || 'N/A',
      Price: hasHardError ? 0 : pricingResult.price || 0,
      'Carton Quantity': hasHardError ? 0 : pricingResult.cartonQty || 0,
      'Carton Price': hasHardError ? 0 : pricingResult.cartonPrice || 0,
    };

    const note = pricingResult.errors.length > 0 ? pricingResult.errors.join(', ') : undefined;

    return { displayResult: result, displayNote: note };
  }, [pricingResult]);

  const handleAddToDashboard = () => {
    if (pricingResult && pricingResult.price > 0) {
      // Combine inputs and option for the config object
      const config = { ...inputs, option };
      onCalculate('pads', config, pricingResult.price, pricingResult);
    }
  };

  // Handler for decimal width input change
  const handleDecimalWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {    
    let value = Number(e.target.value);
    // Constrain the input to the maximum allowed width
    const maxFraction = Math.max(...(Array.from(data?.fractionalCodes.keys() || [0])));
    if (value > maxAllowedWidth + maxFraction) {
      value = maxAllowedWidth + maxFraction;
    }
    setDecimalWidth(value);    
    const whole = Math.floor(value);    
    const fraction = value - whole;    
    // Find the closest valid fraction to avoid floating point issues
    const closestFraction = Array.from(data?.fractionalCodes.keys() || []).reduce((prev, curr) =>
      (Math.abs(curr - fraction) < Math.abs(prev - fraction) ? curr : prev)
    , 0);
    setInputs((prev) => ({ ...prev, widthWhole: whole, widthFraction: closestFraction }));
  };

  // Handler for decimal length input change
  const handleDecimalLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {    
    let value = Number(e.target.value);
    // Constrain the input to the maximum allowed length
    const maxFraction = Math.max(...(Array.from(data?.fractionalCodes.keys() || [0])));
    if (value > maxAllowedLength + maxFraction) {
      value = maxAllowedLength + maxFraction;
    }
    setDecimalLength(value);
    const whole = Math.floor(value);
    const fraction = value - whole;
    // Find the closest valid fraction
    const closestFraction = Array.from(data?.fractionalCodes.keys() || []).reduce((prev, curr) =>
      (Math.abs(curr - fraction) < Math.abs(prev - fraction) ? curr : prev)
    , 0);
    setInputs((prev) => ({ ...prev, lengthWhole: whole, lengthFraction: closestFraction }));
  };
  
  // --- Dropdown Options Generation ---
  const generateIntList = (min: number, max: number) => {
    const list = [];
    for (let i = min; i <= max; i++) {
      list.push(i);
    }
    return list;
  };

  // Make dropdowns dynamic based on the selected product's validation rules
  const { widthDropdownOptions, lengthDropdownOptions, maxAllowedWidth, maxAllowedLength } = useMemo(() => {
    if (!data) return { widthDropdownOptions: [], lengthDropdownOptions: [], maxAllowedWidth: 999, maxAllowedLength: 999 };

    const currentProductInfo = data.productInfo.get(inputs.productName);
    if (!currentProductInfo) return { widthDropdownOptions: [], lengthDropdownOptions: [], maxAllowedWidth: 999, maxAllowedLength: 999 };

    const { min, max, prefix } = currentProductInfo;
    const specialWidthRules = new Map([['130', 70], ['132', 84], ['134', 96], ['170', 78]]);
    const resolvedMaxWidth = specialWidthRules.get(prefix) ?? max;

    return { widthDropdownOptions: generateIntList(min, resolvedMaxWidth), lengthDropdownOptions: generateIntList(min, max), maxAllowedWidth: resolvedMaxWidth, maxAllowedLength: max };
  }, [data, inputs.productName]);

  // Handle loading and error states FIRST
  if (isLoading) {
    return <div>Loading Pads Data...</div>;
  }

  if (error) {
    return <div>Error loading data: {error.message}</div>;
  }

  if (!data) {
    return <div>No data available.</div>;
  }

  return (
    <CalculatorTemplate title="Pads Calculator" description="Select pad weight and size specifications">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <FormField label="Product Family">
            <select
              value={inputs.productName}
              onChange={(e) => setInputs({ ...inputs, productName: e.target.value })}
              className="w-full p-3 border rounded-md bg-white"
            >
              {Array.from(data.productInfo.keys()).map((productName) => (
                <option key={productName} value={productName}>
                  {productName}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Option">
            <select
              value={option}
              onChange={(e) => setOption(e.target.value)}
              className="w-full p-3 border rounded-md bg-white"
            >
              {availableOptions.map((opt) => (
                <option key={opt} value={opt} >
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
                    {Array.from(data.fractionalCodes.entries()).map(([decimal]) => (
                      <option key={`w-frac-${decimal}`} value={decimal}>{`${decimal}"`}</option>
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
                    {Array.from(data.fractionalCodes.entries()).map(([decimal]) => (
                      <option key={`l-frac-${decimal}`} value={decimal}>{`${decimal}"`}</option>
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
                  step="any"
                />
              </FormField>
              <FormField label="Length (inches)">
                <input
                  type="number"
                  value={decimalLength}
                  onChange={handleDecimalLengthChange}
                  placeholder="e.g., 24.75"
                  className="w-full p-3 border rounded-md"
                  step="any"
                />
              </FormField>
            </>
          )}
        </div>
        <PricingResult results={displayResult} note={displayNote} onCalculate={handleAddToDashboard} />
      </div>
    </CalculatorTemplate>
  );
}

export default PadsCalc;
