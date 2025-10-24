import React, { useState, useEffect, useMemo } from 'react';
import CalculatorTemplate from '../ui/CalculatorTemplate.tsx';
import FormField from '../ui/FormField.tsx';
import PricingResult from '../ui/PricingResult.tsx';
import { useSleevesData } from '../../hooks/useSleevesData.ts';
import { calculateSleeves } from '../../logic/sleevesLogic.js';

// Define the component's props interface
interface SleevesCalcProps {
  onCalculate: (productType: string, config: object, price: number, quoteDetails: object) => void;
}

const initialSleevesQuote = { 'Part Number': 'N/A', Price: 0, 'Carton Quantity': 0, 'Carton Price': 0 };
const initialSleeveResult = {
  partNumber: 'N/A',
  price: 0,
  cartonQty: 0,
  cartonPrice: 0,
  errors: [],
  debugInfo: {},
};

function SleevesCalc({ onCalculate }: SleevesCalcProps) {
  const { data, isLoading, error } = useSleevesData();
  const [productName, setProductName] = useState('');
  const [option, setOption] = useState('');
  const [width, setWidth] = useState(0);
  const [length, setLength] = useState(0);
  const [pricingResult, setPricingResult] = useState(initialSleeveResult);

  // Set initial state once data is loaded
  useEffect(() => {
    if (data?.productMaster?.[0]) {
      setProductName(data.productMaster[0].productName);
      setOption(data.productMaster[0].options.split(',')[0]);
    }
  }, [data]);

  // Memoize product options to avoid re-calculating on every render
  const currentProductOptions = useMemo(() => {
    const product = data?.productMaster.find((p) => p.productName === productName);
    return product ? product.options.split(',') : [];
  }, [productName, data]);

  // Reset option if it's not valid for the selected product
  useEffect(() => {
    if (currentProductOptions.length > 0 && !currentProductOptions.includes(option)) {
      setOption(currentProductOptions[0]);
    }
  }, [productName, currentProductOptions, option]);

  // This "effect" runs whenever the user's inputs change to calculate the new price
  useEffect(() => {
    generateQuote();
  }, [productName, option, width, length, data]);

  const generateQuote = () => {
    if (!data || isLoading || !productName || width <= 0 || length <= 0) {
      setPricingResult(initialSleeveResult);
      return;
    }

    const inputs = { productName, option, width, length };
    const result = calculateSleeves(inputs, data);
    setPricingResult(result);
  };

  // A derived state for what's shown in the UI, which can include notes.
  const displayResult = {
    'Part Number': pricingResult?.partNumber || 'N/A',
    Price: pricingResult.errors.length > 0 ? pricingResult.errors.join(', ') : pricingResult?.price || 0,
    'Carton Quantity': pricingResult.errors.length > 0 ? 0 : pricingResult?.cartonQty || 0,
    'Carton Price': pricingResult.errors.length > 0 ? 0 : pricingResult?.cartonPrice || 0,
  };

  const handleAddToDashboard = () => {
    if (pricingResult && pricingResult.price > 0) {
      const config = { productName, option, width, length };
      // Pass the whole result object to onCalculate
      onCalculate('sleeves', config, pricingResult.price, pricingResult);
    }
  };

  if (isLoading) {
    return <div>Loading Sleeves Data...</div>;
  }

  if (error) {
    return <div>Error loading data: {error.message}</div>;
  }

  return (
    <CalculatorTemplate title="Sleeves Calculator" description="Configure sleeve and frame specifications">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <FormField label="Product Family">
            <select value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full p-3 border rounded-md bg-white">
              {data?.productMaster.map((p) => (
                <option key={p.prefix} value={p.productName}>
                  {p.productName}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Option">
            <select value={option} onChange={(e) => setOption(e.target.value)} className="w-full p-3 border rounded-md bg-white">
              {currentProductOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Width (inches)">
            <input type="number" value={width} onChange={(e) => setWidth(parseFloat(e.target.value) || 0)} placeholder="e.g., 8.5" className="w-full p-3 border rounded-md" step="any" />
          </FormField>
          <FormField label="Length (inches)">
            <input type="number" value={length} onChange={(e) => setLength(parseFloat(e.target.value) || 0)} placeholder="e.g., 20.0" className="w-full p-3 border rounded-md" step="any" />
          </FormField>
        </div>
        <PricingResult results={displayResult} onCalculate={handleAddToDashboard}/>
      </div>
    </CalculatorTemplate>
  );
}

export default SleevesCalc;
