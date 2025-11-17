// src/components/PleatsCalc.tsx

import { useState, useEffect, useReducer, useMemo } from 'react';
import CalculatorTemplate from '../ui/CalculatorTemplate';
import FormField from '../ui/FormField';
import PricingResult from '../ui/PricingResult';
import { usePricingData } from '../../hooks/usePricingData';
import { calculatePleatPrice, type PleatInputs, type PleatPricingResult } from '../../logic/pleatLogic';

const initialInputs: PleatInputs = {
  productFamily: '',
  widthWhole: 12,
  widthFraction: 0,
  lengthWhole: 24,
  lengthFraction: 0,
  depth: 1,
  isExact: false,
};

type PleatsAction =
  | { type: 'SET_FIELD'; payload: { field: keyof PleatInputs; value: any } }
  | { type: 'SET_DECIMAL_DIMENSION'; payload: { dim: 'width' | 'length'; value: number } }
  | { type: 'RESET_DEPTH' };

function pleatsReducer(state: PleatInputs, action: PleatsAction): PleatInputs {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.payload.field]: action.payload.value };
    case 'SET_DECIMAL_DIMENSION':
      const { dim, value } = action.payload;
      const whole = Math.floor(value);
      const fraction = value - whole;
      return { ...state, [`${dim}Whole`]: whole, [`${dim}Fraction`]: fraction };
    case 'RESET_DEPTH':
      return { ...state, depth: 1 };
    default:
      return state;
  }
}

interface PleatsCalcProps {
  onCalculate: (productType: string, config: object, price: number, quoteDetails: object) => void;
}
export const PleatsCalc = ({ onCalculate }: PleatsCalcProps) => {
  // Hook to load all our CSV data
  const { data, isLoading, error } = usePricingData();

  const [inputMode, setInputMode] = useState<'decimal' | 'fractional'>('fractional');
  const [inputs, dispatch] = useReducer(pleatsReducer, initialInputs);

  // State to hold the full pricing result, including debug info
  const [pricingResult, setPricingResult] = useState<PleatPricingResult | null>(null);

  // Derived decimal values from the single source of truth: `inputs`
  const decimalWidth = useMemo(() => inputs.widthWhole + inputs.widthFraction, [inputs.widthWhole, inputs.widthFraction]);
  const decimalLength = useMemo(() => inputs.lengthWhole + inputs.lengthFraction, [inputs.lengthWhole, inputs.lengthFraction]);

  // A derived state for what's shown in the UI, which can include notes.
  const displayResult = {
    'Part Number': pricingResult?.partNumber || 'N/A',
    'Price': pricingResult?.notes || pricingResult?.price || 0,
    'Carton Quantity': pricingResult?.notes ? 0 : pricingResult?.cartonQuantity || 0,
    'Carton Price': pricingResult?.notes ? 0 : pricingResult?.cartonPrice || 0,
  };

  // This effect runs once when the data is loaded to set the initial product family
  useEffect(() => {
    if (data?.productFamilyCodes?.[0]?.Name) {
      dispatch({ type: 'SET_FIELD', payload: { field: 'productFamily', value: data.productFamilyCodes[0].Name } });
    }
  }, [data]); // Only run this when `data` changes

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
      dispatch({ type: 'RESET_DEPTH' });
    }
  }, [inputs.productFamily, isDepthRestricted, inputs.depth]);

  // This "effect" runs whenever the user's inputs change to calculate the new price
  useEffect(() => {
    if (data) {
      const result = calculatePleatPrice(inputs, data);
      setPricingResult(result);
    }
  }, [inputs, data]); // Dependency array: triggers recalculation on input change

  // Handler for decimal width input change
  const handleDecimalWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    dispatch({ type: 'SET_DECIMAL_DIMENSION', payload: { dim: 'width', value } });
  };
  // --- Render Logic ---
  if (isLoading) {
    return <div>Loading pricing data...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const handleAddToDashboard = () => {
    if (pricingResult && pricingResult.price > 0) {
      onCalculate('pleats', inputs, pricingResult.price, pricingResult);
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
              onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'productFamily', value: e.target.value } })}
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
                    value={inputs.widthWhole || ''}
                    onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'widthWhole', value: parseInt(e.target.value, 10) || 0 } })}
                    placeholder="Whole"
                    className="w-1/2 p-3 border rounded-md"
                    min="0"
                    step="1" // Prevent decimal input here
                  />
                  <select
                    value={inputs.widthFraction || 0}
                    onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'widthFraction', value: Number(e.target.value) } })}
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
                    value={inputs.lengthWhole || ''}
                    onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'lengthWhole', value: parseInt(e.target.value, 10) || 0 } })}
                    placeholder="Whole"
                    className="w-1/2 p-3 border rounded-md"
                    min="0"
                    step="1" // Prevent decimal input here
                  />
                  <select
                    value={inputs.lengthFraction || 0}
                    onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'lengthFraction', value: Number(e.target.value) } })}
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
                  value={decimalWidth || ''}
                  onChange={handleDecimalWidthChange}
                  placeholder="e.g., 12.5"
                  className="w-full p-3 border rounded-md"
                  step="any" // Allow decimal input here
                />
              </FormField>
              <FormField label="Length (inches)">
                <input
                  type="number"
                  value={decimalLength || ''}
                  onChange={(e) => dispatch({ type: 'SET_DECIMAL_DIMENSION', payload: { dim: 'length', value: Number(e.target.value) } })}
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
                dispatch({ type: 'SET_FIELD', payload: { field: 'depth', value } });
              }}
              className="w-full p-3 border rounded-md bg-white"
            >
              <option value={1}>1"</option>
              <option value={2}>2"</option>
              {!isDepthRestricted && <option value={4}>4"</option>}
            </select>
          </FormField>
          <FormField label="Made Exact?">
            <div className="flex items-center space-x-4"><label className="flex items-center"><input type="radio" name="isExact" value="yes" checked={inputs.isExact} onChange={() => dispatch({ type: 'SET_FIELD', payload: { field: 'isExact', value: true } })} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" /><span className="ml-2">Yes</span></label><label className="flex items-center"><input type="radio" name="isExact" value="no" checked={!inputs.isExact} onChange={() => dispatch({ type: 'SET_FIELD', payload: { field: 'isExact', value: false } })} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" /><span className="ml-2">No</span></label></div>
          </FormField>
          {/* Mobile-only "Add to Dashboard" button */}
          <div className="mt-6 md:hidden">
            <button id="tour-add-to-quote-mobile" onClick={handleAddToDashboard} className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-colors" disabled={!pricingResult || !pricingResult.price || pricingResult.price <= 0}>Add to Dashboard</button>
          </div>
        </div>
        <div className="hidden md:block">
          <PricingResult results={displayResult} onCalculate={handleAddToDashboard} buttonId="tour-add-to-quote-desktop" />
        </div>
      </div>
    </CalculatorTemplate>
  );
};