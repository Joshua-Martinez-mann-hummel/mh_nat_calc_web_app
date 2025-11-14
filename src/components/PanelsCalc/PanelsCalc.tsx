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
  const [inputMode, setInputMode] = useState<'decimal' | 'fractional'>('fractional');
  const [decimalHeight, setDecimalHeight] = useState<number>(initialInputs.heightWhole + initialInputs.heightFraction);
  const [decimalWidth, setDecimalWidth] = useState<number>(initialInputs.widthWhole + initialInputs.widthFraction);

  // Set initial product family once data is loaded
  useEffect(() => {
    if (data?.productInfo) {
      const firstProduct = data.productInfo.keys().next().value;
      if (firstProduct) {
        setInputs((prev) => ({ ...prev, productFamily: firstProduct }));
      }
    }
  }, [data]);

  // Sync decimal inputs when fractional inputs change
  useEffect(() => {
    setDecimalHeight(inputs.heightWhole + inputs.heightFraction);
    setDecimalWidth(inputs.widthWhole + inputs.widthFraction);
  }, [inputs.heightWhole, inputs.heightFraction, inputs.widthWhole, inputs.widthFraction]);

  // Reset addOn if Antimicrobial is selected and user switches to a product that doesn't support it.
  useEffect(() => {
    if (inputs.productFamily === 'Tri-Dek FC Panel' && inputs.addOn === 'Antimicrobial') {
      setInputs((prev) => ({ ...prev, addOn: 'Standard' }));
    }
  }, [inputs.productFamily, inputs.addOn]);

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

    const note =
      pricingResult.errors.length > 0
        ? pricingResult.errors.join(', ')
        : undefined;

    // If there are errors, show the first error as the price and zero out other fields.
    if (note) {
      result.Price = note;
      result['Carton Quantity'] = 0;
      result['Carton Price'] = 0;
    }

    return { displayResult: result, displayNote: undefined }; // Note is now part of the result.
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

  // Handlers for decimal inputs
  const handleDecimalHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setDecimalHeight(value);
    const whole = Math.floor(value);
    // Find the closest fractional value from the available options
    const fraction = value - whole;
    setInputs((prev) => ({ ...prev, heightWhole: whole, heightFraction: fraction }));
  };

  const handleDecimalWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setDecimalWidth(value);
    const whole = Math.floor(value);
    // Find the closest fractional value from the available options
    const fraction = value - whole;
    setInputs((prev) => ({ ...prev, widthWhole: whole, widthFraction: fraction }));
  };

  // Loading and error states
  if (isLoading) return <div>Loading Panels-Links Data...</div>;
  if (error) return <div>Error loading data: {error.message}</div>;
  if (!data) return <div>No data available.</div>;

  // Generate integer lists for dropdowns
  const generateIntList = (min: number, max: number) =>
    Array.from({ length: max - min + 1 }, (_, i) => min + i);

  // Determine if the Antimicrobial option should be available.
  const isAntimicrobialAvailable = inputs.productFamily !== 'Tri-Dek FC Panel';

  // Define product-specific max heights for UI validation
  const PRODUCT_MAX_HEIGHTS: { [key: string]: number } = {
    "Tri-Dek FC Panel": 24,
    "Tri-Dek 3/67 2-Ply": 51,
    "Tri-Dek 15/40 3-Ply": 51,
    "Tri-Dek 4-ply XL": 51,
  };
  const maxAllowedHeight = PRODUCT_MAX_HEIGHTS[inputs.productFamily] ?? 77; // Default max

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
              <option value="Standard">Standard</option>
              {isAntimicrobialAvailable && <option value="Antimicrobial">Antimicrobial</option>}
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

          {/* Input Mode Toggle */}
          <div className="flex items-center justify-start space-x-3 pt-2">
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
              <FormField label="Height (inches)">
                <div className="flex space-x-2">
                  <select name="heightWhole" value={inputs.heightWhole} onChange={handleChange} className="w-1/2 p-3 border rounded-md bg-white">
                    {generateIntList(3, maxAllowedHeight).map((val) => (<option key={`h-int-${val}`} value={val}>{val}</option>))}
                  </select>
                  <select name="heightFraction" value={inputs.heightFraction} onChange={handleChange} className="w-1/2 p-3 border rounded-md bg-white">
                    {[0, ...Array.from(data.fractionalCodes.keys())].map((val) => (<option key={`h-frac-${val}`} value={val}>{`${val}"`}</option>))}
                  </select>
                </div>
              </FormField>
              <FormField label="Width (inches)">
                <div className="flex space-x-2">
                  <select name="widthWhole" value={inputs.widthWhole} onChange={handleChange} className="w-1/2 p-3 border rounded-md bg-white">
                    {generateIntList(3, 77).map((val) => (<option key={`w-int-${val}`} value={val}>{val}</option>))}
                  </select>
                  <select name="widthFraction" value={inputs.widthFraction} onChange={handleChange} className="w-1/2 p-3 border rounded-md bg-white">
                    {[0, ...Array.from(data.fractionalCodes.keys())].map((val) => (<option key={`w-frac-${val}`} value={val}>{`${val}"`}</option>))}
                  </select>
                </div>
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Height (inches)">
                <input
                  type="number"
                  value={decimalHeight}
                  onChange={handleDecimalHeightChange}
                  placeholder="e.g., 24.5"
                  className="w-full p-3 border rounded-md"
                  step="any"
                />
              </FormField>
              <FormField label="Width (inches)">
                <input
                  type="number"
                  value={decimalWidth}
                  onChange={handleDecimalWidthChange}
                  placeholder="e.g., 12.75"
                  className="w-full p-3 border rounded-md"
                  step="any"
                />
              </FormField>
            </>
          )}

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
