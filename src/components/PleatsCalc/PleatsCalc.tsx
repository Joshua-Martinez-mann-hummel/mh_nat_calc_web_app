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

  // State to hold the user's form inputs
  const [inputs, setInputs] = useState<PleatInputs>({
    productFamily: '', // Will be set once data is loaded
    width: 12,
    length: 24,
    depth: 1 as 1 | 2 | 4,
    isExact: false,
  });

  // State to hold the final calculated part number
  // Let's manage the full quote result in state
  const [pricingResult, setPricingResult] = useState({ 'Part Number': 'N/A', 'Price': 0, 'Carton Quantity': 0, 'Carton Price': 0 });

  // This effect runs once when the data is loaded to set the initial product family
  useEffect(() => {
    if (data?.productFamilyCodes?.[0]?.Name) {
      setInputs((currentInputs) => ({
        ...currentInputs,
        productFamily: data.productFamilyCodes[0].Name,
      }));
    }
  }, [data]); // Only run this when `data` changes
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
          <FormField label="Width (inches)">
            <input type="number" value={inputs.width} onChange={(e) => setInputs({ ...inputs, width: Number(e.target.value) })} placeholder="e.g., 24.5" className="w-full p-3 border rounded-md" step="any" />
          </FormField>
          <FormField label="Length (inches)">
            <input type="number" value={inputs.length} onChange={(e) => setInputs({ ...inputs, length: Number(e.target.value) })} placeholder="e.g., 18.25" className="w-full p-3 border rounded-md" step="any" />
          </FormField>
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
              <option value={4}>4"</option>
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