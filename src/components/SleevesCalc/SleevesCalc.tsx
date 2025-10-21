import React, { useState, useEffect } from 'react';
import CalculatorTemplate from '../ui/CalculatorTemplate.tsx';
import FormField from '../ui/FormField.tsx';
import PricingResult from '../ui/PricingResult.tsx';

// Define the component's props interface
interface SleevesCalcProps {
  onCalculate: (productType: string, config: object, price: number, quoteDetails: object) => void;
}

const initialSleevesQuote = { 'Part Number': 'N/A', 'Price': 0, 'Carton Quantity': 0, 'Carton Price': 0 };

function SleevesCalc({ onCalculate }: SleevesCalcProps) {
  const [productFamily, setProductFamily] = useState('tri-dek-sleeves');
  const [option, setOption] = useState('standard');
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [pricingResult, setPricingResult] = useState(initialSleevesQuote);

  useEffect(() => {
    if (productFamily === 'wire-ring-frames' && option === 'antimicrobial') {
      setOption('none');
    } else if (productFamily === 'tri-dek-sleeves' && option === 'none') {
        setOption('standard');
    }
    generateQuote();
  }, [productFamily, option, width, length]);

  const generateQuote = () => {
    const numWidth = parseFloat(width) || 0;
    const numLength = parseFloat(length) || 0;

    if (numWidth === 0 || numLength === 0) {
        setPricingResult(initialSleevesQuote);
        return;
    }

    let basePrice = 10.0;
    if (productFamily === 'wire-ring-frames') basePrice = 5.0;
    const area = numWidth * numLength;
    const optionMultiplier = option === 'antimicrobial' ? 1.30 : 1.0;
    const price = (basePrice + (area * 0.25)) * optionMultiplier;

    const partNumber = `SL-${productFamily.includes('wire') ? 'WR' : 'TD'}-${Math.floor(1000 + numWidth)}`;
    const cartonQuantity = 75;
    const cartonPrice = price * cartonQuantity * 0.97;

    setPricingResult({ 'Part Number': partNumber, 'Price': price, 'Carton Quantity': cartonQuantity, 'Carton Price': cartonPrice });
  };

  const handleAddToDashboard = () => {
    if (pricingResult && pricingResult.Price > 0) {
      const config = { productFamily, option, width, length };
      onCalculate('sleeves', config, pricingResult.Price, {
        partNumber: pricingResult['Part Number'],
        cartonQuantity: pricingResult['Carton Quantity'],
        cartonPrice: pricingResult['Carton Price'],
      });
    }
  };

  return (
    <CalculatorTemplate 
      title="Sleeves Calculator"
      description="Configure sleeve and frame specifications"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <FormField label="Product Family"><select value={productFamily} onChange={(e) => setProductFamily(e.target.value)} className="w-full p-3 border rounded-md bg-white"><option value="tri-dek-sleeves">Tri-Dek #3 2-Ply Pre-Cut Sleeves</option><option value="wire-ring-frames">Wire Ring Frames for Pre-Cut Sleeves</option></select></FormField>
          <FormField label="Option"><select value={option} onChange={(e) => setOption(e.target.value)} className="w-full p-3 border rounded-md bg-white">
              {productFamily === 'tri-dek-sleeves' && (<><option value="standard">Standard</option><option value="antimicrobial">Antimicrobial</option></>)}
              {productFamily === 'wire-ring-frames' && (<><option value="none">None</option><option value="standard">Standard</option></>)}
          </select></FormField>
          <FormField label="Width (inches)"><input type="number" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="e.g., 8.5" className="w-full p-3 border rounded-md" step="any"/></FormField>
          <FormField label="Length (inches)"><input type="number" value={length} onChange={(e) => setLength(e.target.value)} placeholder="e.g., 20.0" className="w-full p-3 border rounded-md" step="any"/></FormField>
        </div>
        <PricingResult results={pricingResult} onCalculate={handleAddToDashboard}/>
      </div>
    </CalculatorTemplate>
  );
}

export default SleevesCalc;

