import React, { useState, useEffect, useMemo } from 'react';
import CalculatorTemplate from '../ui/CalculatorTemplate';
import FormField from '../ui/FormField';
import PricingResult from '../ui/PricingResult';
import { usePanelsData } from '../../hooks/usePanelsData';
import { calculatePanelsLinks } from '../../logic/panelsLogic';
import type {
  PanelsLinksInputs,
  PanelsLinksResult,
} from '../../data/PanelsData/panelsDataTypes';

// Define the component's props interface
interface PanelsCalcProps {
  onCalculate: (
    productType: string,
    config: object,
    price: number,
    quoteDetails: object
  ) => void;
}

const initialInputs: PanelsLinksInputs = {
  productFamily: '',
  addOn: 'Standard',
  type: 'Panel',
  numberOfPanels: 2,
  isExact: false,
  heightWhole: 24,
  heightFraction: 0,
  widthWhole: 12,
  widthFraction: 0,
};

const initialResult: PanelsLinksResult = {
  partNumber: 'N/A',
  price: 0,
  rangeOfLinkWidth: 'N/A',
  cartonQty: 0,
  cartonPrice: 0,
  errors: [],
};

function PanelsCalc({ onCalculate }: PanelsCalcProps) {
  const { data, isLoading, error } = usePanelsData();
  const [inputs, setInputs] = useState<PanelsLinksInputs>(initialInputs);
  const [pricingResult, setPricingResult] =
    useState<PanelsLinksResult>(initialResult);

  // Set initial product family once data is loaded
  useEffect(() => {
    if (data?.productInfo) {
      const firstProduct = data.productInfo.keys().next().value;
      if (firstProduct) {
        setInputs((prev) => ({ ...prev, productFamily: firstProduct }));
      }
    }
  }, [data]);

  // Main calculation effect
  useEffect(() => {
    if (data && inputs.productFamily) {
      const result = calculatePanelsLinks(inputs, data);
      setPricingResult(result);
    } else {
      setPricingResult(initialResult);
    }
  }, [inputs, data]);

  // Derived state for UI display, handling errors and notes
  const { displayResult, displayNote } = useMemo(() => {
    if (!pricingResult) {
      return { displayResult: {}, displayNote: undefined };
    }

    const result = {
      'Part Number': pricingResult.partNumber,
      Price: pricingResult.price,
      'Carton Quantity': pricingResult.cartonQty,
      'Carton Price': pricingResult.cartonPrice,
      'Range of Link Width': pricingResult.rangeOfLinkWidth,
    };

    // If there are errors, show them as a note and zero out prices.
    if (pricingResult.errors.length > 0) {
      result.Price = 0;
      result['Carton Quantity'] = 0;
      result['Carton Price'] = 0;
    }

    const note =
      pricingResult.errors.length > 0
        ? pricingResult.errors.join(', ')
        : undefined;

    return { displayResult: result, displayNote: note };
  }, [pricingResult]);

  const handleAddToDashboard = () => {
    if (pricingResult && pricingResult.price > 0) {
      onCalculate('panels', inputs, pricingResult.price, pricingResult);
    }
  };

  // Generic change handler for all inputs
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setInputs((prev) => ({ ...prev, [name]: checked }));
    } else {
      // Use dynamic typing from papaparse for numeric values
      const isNumeric =
        e.target.getAttribute('type') === 'number' ||
        !isNaN(parseFloat(value));
      setInputs((prev) => ({
        ...prev,
        [name]: isNumeric ? parseFloat(value) : value,
      }));
    }
  };

  // Loading and error states
  if (isLoading) return <div>Loading Panels-Links Data...</div>;
  if (error) return <div>Error loading data: {error.message}</div>;
  if (!data) return <div>No data available.</div>;

  // Generate integer lists for dropdowns
  const generateIntList = (min: number, max: number) =>
    Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <CalculatorTemplate
      title="Panels-Links Calculator"
      description="Configure panel type and link count for pricing"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <FormField label="Product Family">
            <select name="productFamily" value={inputs.productFamily} onChange={handleChange} className="w-full p-3 border rounded-md bg-white">
              {Array.from(data.productInfo.keys()).map((name) => (<option key={name} value={name}>{name}</option>))}
            </select>
          </FormField>
          <FormField label="Optional Add-on">
            <select name="addOn" value={inputs.addOn} onChange={handleChange} className="w-full p-3 border rounded-md bg-white">
              <option value="Standard">Standard</option><option value="Antimicrobial">Antimicrobial</option>
            </select>
          </FormField>
          <FormField label="Type">
            <select name="type" value={inputs.type} onChange={handleChange} className="w-full p-3 border rounded-md bg-white">
              <option value="Panel">Panel</option><option value="Link">Link</option>
            </select>
          </FormField>
          {inputs.type === 'Link' && (
            <FormField label="Number of Panels">
              <input type="number" name="numberOfPanels" value={inputs.numberOfPanels} onChange={handleChange} placeholder="e.g., 3" className="w-full p-3 border rounded-md" min="2"/>
            </FormField>
          )}
          <FormField label="Height (inches)">
            <div className="flex space-x-2">
              <select name="heightWhole" value={inputs.heightWhole} onChange={handleChange} className="w-1/2 p-3 border rounded-md bg-white">
                {generateIntList(3, 77).map((val) => (<option key={`h-int-${val}`} value={val}>{val}</option>))}
              </select>
              <select name="heightFraction" value={inputs.heightFraction} onChange={handleChange} className="w-1/2 p-3 border rounded-md bg-white">
                {Array.from(data.fractionalCodes.keys()).map((val) => (<option key={`h-frac-${val}`} value={val}>{`${val}"`}</option>))}
              </select>
            </div>
          </FormField>
          <FormField label="Width (inches)">
            <div className="flex space-x-2">
              <select name="widthWhole" value={inputs.widthWhole} onChange={handleChange} className="w-1/2 p-3 border rounded-md bg-white">
                {generateIntList(3, 51).map((val) => (<option key={`w-int-${val}`} value={val}>{val}</option>))}
              </select>
              <select name="widthFraction" value={inputs.widthFraction} onChange={handleChange} className="w-1/2 p-3 border rounded-md bg-white">
                {Array.from(data.fractionalCodes.keys()).map((val) => (<option key={`w-frac-${val}`} value={val}>{`${val}"`}</option>))}
              </select>
            </div>
          </FormField>
          <FormField label="Made Exact?">
            <div className="flex items-center">
              <input type="checkbox" name="isExact" checked={inputs.isExact} onChange={handleChange} className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
              <span className="ml-2 text-gray-700">Yes, dimensions are exact</span>
            </div>
          </FormField>
        </div>
        <PricingResult results={displayResult} note={displayNote} onCalculate={handleAddToDashboard}/>
      </div>
    </CalculatorTemplate>
  );
}

export default PanelsCalc;
