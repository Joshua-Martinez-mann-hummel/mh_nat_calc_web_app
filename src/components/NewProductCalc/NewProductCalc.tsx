import React, { useState, useEffect, useMemo, useReducer } from 'react';
import CalculatorTemplate from '../ui/CalculatorTemplate';
import FormField from '../ui/FormField';
import PricingResult from '../ui/PricingResult';
import { useNewProductData } from '../../hooks/useNewProductData';
import { calculateProShieldPrice } from '../../logic/newProductLogic';
import type { ProShieldInputs, ProShieldPricingResult } from '../../data/NewProductData/newProductDataTypes';
import { AlertTriangle } from 'lucide-react';
import { appConfig } from '../../config';

interface NewProductCalcProps {
  onCalculate?: (productType: string, config: object, price: number, quoteDetails: object) => void;
}

interface FormState {
  heightWhole: number;
  heightFraction: number;
  widthWhole: number;
  widthFraction: number;
  materialId: string;
  fastenerId: string;
}

const initialInputs: FormState = {
  heightWhole: 48,
  heightFraction: 0,
  widthWhole: 48,
  widthFraction: 0,
  materialId: '1',
  fastenerId: '1',
};

type FormAction =
  | { type: 'SET_FIELD'; payload: { field: keyof FormState; value: any } }
  | { type: 'SET_DECIMAL_DIMENSION'; payload: { dim: 'height' | 'width'; value: number; fractionalKeys: number[] } };

function reducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.payload.field]: action.payload.value };
    case 'SET_DECIMAL_DIMENSION': {
      const { dim, value, fractionalKeys } = action.payload;
      const whole = Math.floor(value);
      const fraction = value - whole;
      // Snap to closest valid fraction
      const closestFraction = fractionalKeys.length > 0
        ? fractionalKeys.reduce((prev, curr) => (Math.abs(curr - fraction) < Math.abs(prev - fraction) ? curr : prev), 0)
        : 0;
      return { ...state, [`${dim}Whole`]: whole, [`${dim}Fraction`]: closestFraction };
    }
    default:
      return state;
  }
}

function NewProductCalc({ onCalculate }: NewProductCalcProps) {
  const { data, isLoading, error } = useNewProductData();
  const [inputMode, setInputMode] = useState<'decimal' | 'fractional'>('fractional');
  const [inputs, dispatch] = useReducer(reducer, initialInputs);
  const [pricingResult, setPricingResult] = useState<ProShieldPricingResult | null>(null);

  // Calculate price dynamically whenever inputs or data change
  useEffect(() => {
    if (data && inputs.materialId && inputs.fastenerId) {
      const totalHeight = inputs.heightWhole + inputs.heightFraction;
      const totalWidth = inputs.widthWhole + inputs.widthFraction;

      if (totalHeight > 0 && totalWidth > 0) {
        const engineInputs: ProShieldInputs = {
          height: totalHeight,
          width: totalWidth,
          materialId: inputs.materialId,
          fastenerId: inputs.fastenerId,
        };
        const result = calculateProShieldPrice(engineInputs, data);
        setPricingResult(result);
      } else {
        setPricingResult(null);
      }
    }
  }, [inputs, data]);

  // Format the outputs for the PricingResult child component
  const displayResult = useMemo(() => {
    if (!pricingResult) return {};

    const res: Record<string, any> = {
      'Part Number': pricingResult.partNumber || 'N/A',
      'Net Price': pricingResult.price || 0,
    };
    
    // Conditional IC Pricing based on global appConfig
    if (appConfig.showICPricing && pricingResult.icPrice) {
      res['IC Price (Purchasing Only)'] = pricingResult.icPrice;
    }

    return res;
  }, [pricingResult]);

  const displayNote = useMemo(() => {
    if (pricingResult?.notes && pricingResult.notes.length > 0) {
      return pricingResult.notes.join(' | ');
    }
    return undefined;
  }, [pricingResult]);

  // Dashboard hand-off
  const handleAddToDashboard = () => {
    if (pricingResult && pricingResult.price > 0 && onCalculate) {
      const resultPayload = {
        ...pricingResult,
        cartonQuantity: 'N/A',
        cartonPrice: 'N/A'
      };
      onCalculate('proshield', { ...inputs, productFamily: 'ProShield' }, pricingResult.price, resultPayload);
    }
  };

  // UI Event Handlers
  const decimalHeight = useMemo(() => inputs.heightWhole + inputs.heightFraction, [inputs.heightWhole, inputs.heightFraction]);
  const decimalWidth = useMemo(() => inputs.widthWhole + inputs.widthFraction, [inputs.widthWhole, inputs.widthFraction]);

  const handleDecimalDimensionChange = (e: React.ChangeEvent<HTMLInputElement>, dim: 'height' | 'width') => {
    let value = Number(e.target.value);
    if (value < 0) value = 0;
    dispatch({
      type: 'SET_DECIMAL_DIMENSION',
      payload: { dim, value, fractionalKeys: Array.from(data?.fractionalCodes.keys() || [0]) }
    });
  };

  // Loading & Error States
  if (isLoading) return <div>Loading Data...</div>;
  if (error) return <div className="text-red-600">Error loading data: {error.message}</div>;
  if (!data) return <div>No data available.</div>;

  return (
    <CalculatorTemplate title="ProShield Calculator" description="Configure custom ProShield filter screens">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Side: Inputs */}
        <div className="space-y-4">
          <div className="flex items-center justify-start space-x-3 mb-4">
            <span className={`font-medium ${inputMode === 'fractional' ? 'text-blue-600' : 'text-gray-500'}`}>Fractional</span>
            <button
              type="button"
              onClick={() => setInputMode(inputMode === 'fractional' ? 'decimal' : 'fractional')}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${inputMode === 'decimal' ? 'bg-blue-600' : 'bg-gray-200'
                }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${inputMode === 'decimal' ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className={`font-medium ${inputMode === 'decimal' ? 'text-blue-600' : 'text-gray-500'}`}>Decimal</span>
          </div>

          {inputMode === 'fractional' ? (
            <>
              <FormField label="Height (inches)">
                <div className="flex space-x-2">
                  <input type="number" value={inputs.heightWhole.toString()} onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'heightWhole', value: parseInt(e.target.value, 10) || 0 } })} className="w-1/2 p-3 border rounded-md bg-white" min="0" />
                  <select value={inputs.heightFraction} onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'heightFraction', value: parseFloat(e.target.value) } })} className="w-1/2 p-3 border rounded-md bg-white">
                    <option value={0}>0"</option>
                    {Array.from(data.fractionalCodes.keys()).sort().map(dec => (<option key={`h-${dec}`} value={dec}>{`${dec}"`}</option>))}
                  </select>
                </div>
              </FormField>
              <FormField label="Width (inches)">
                <div className="flex space-x-2">
                  <input type="number" value={inputs.widthWhole.toString()} onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'widthWhole', value: parseInt(e.target.value, 10) || 0 } })} className="w-1/2 p-3 border rounded-md bg-white" min="0" />
                  <select value={inputs.widthFraction} onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'widthFraction', value: parseFloat(e.target.value) } })} className="w-1/2 p-3 border rounded-md bg-white">
                    <option value={0}>0"</option>
                    {Array.from(data.fractionalCodes.keys()).sort().map(dec => (<option key={`w-${dec}`} value={dec}>{`${dec}"`}</option>))}
                  </select>
                </div>
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Height (inches)"><input type="number" value={decimalHeight.toString()} onChange={(e) => handleDecimalDimensionChange(e, 'height')} className="w-full p-3 border rounded-md" step="any" min="0" /></FormField>
              <FormField label="Width (inches)"><input type="number" value={decimalWidth.toString()} onChange={(e) => handleDecimalDimensionChange(e, 'width')} className="w-full p-3 border rounded-md" step="any" min="0" /></FormField>
            </>
          )}

          <FormField label="Material">
            <select value={inputs.materialId} onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'materialId', value: e.target.value } })} className="w-full p-3 border rounded-md bg-white">
              {Array.from(data.materials.values()).map(mat => (<option key={mat.Material_ID} value={mat.Material_ID}>{mat.Name}</option>))}
            </select>
          </FormField>

          <FormField label="Fastener Type">
            <select value={inputs.fastenerId} onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'fastenerId', value: e.target.value } })} className="w-full p-3 border rounded-md bg-white">
              {Array.from(data.fasteners.values()).map(f => (<option key={f.Fastener_ID} value={f.Fastener_ID}>{f.Name}</option>))}
            </select>
          </FormField>
        </div>

        {/* Right Side: High-Contrast Warning & Outputs */}
        <div className="flex flex-col h-full space-y-4">
          {inputs.fastenerId === '4' && (
            <div className="bg-yellow-300 border-4 border-red-600 rounded-lg p-4 shadow-md flex items-start space-x-3">
              <AlertTriangle className="h-7 w-7 text-red-700 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-extrabold text-red-700 uppercase mb-1 tracking-wider text-lg">Warning</h4>
                <p className="font-bold text-gray-900 text-sm leading-snug">
                  Price utilizes an unverified placeholder for Industrial Velcro - requires management approval.
                </p>
              </div>
            </div>
          )}
          <PricingResult results={displayResult} note={displayNote} onCalculate={handleAddToDashboard} />
        </div>
      </div>
    </CalculatorTemplate>
  );
}

export default NewProductCalc;
