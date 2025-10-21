import { useState, useEffect } from 'react';
// Corrected the relative paths to be more explicit for the build tool.
import CalculatorTemplate from '../../components/ui/CalculatorTemplate.tsx';
import FormField from '../../components/ui/FormField.tsx';
import PricingResult from '../../components/ui/PricingResult.tsx';

// Define the component's props interface
interface PanelsCalcProps {
    onCalculate: (productType: string, config: object, price: number, quoteDetails: object) => void;
}

const initialPanelsQuote = { 'Range of Link Width': 'N/A', 'Part Number': 'N/A', 'Price': 0, 'Carton Quantity': 0, 'Carton Price': 0 };

function PanelsCalc({ onCalculate }: PanelsCalcProps) {
  const [productFamily, setProductFamily] = useState('Tri-Dek FC Panel');
  const [addOn, setAddOn] = useState('none');
  const [type, setType] = useState('panel');
  const [numPanels, setNumPanels] = useState(1);
  const [isExact, setIsExact] = useState('no');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [pricingResult, setPricingResult] = useState(initialPanelsQuote);

  const generateQuote = () => {
    const numWidth = parseFloat(width) || 0;
    const numHeight = parseFloat(height) || 0;

    if (numWidth === 0 || numHeight === 0) {
      setPricingResult(initialPanelsQuote);
      return;
    }
    
    let basePrice = 50;
    if (productFamily.includes('2-Ply')) basePrice = 60;
    if (productFamily.includes('3-Ply')) basePrice = 75;
    if (productFamily.includes('4-ply')) basePrice = 90;
    const area = numWidth * numHeight;
    const addOnMultiplier = addOn === 'antimicrobial' ? 1.20 : 1.0;
    const exactMultiplier = isExact === 'yes' ? 1.10 : 1.0;
    let finalPrice = basePrice + (area * 0.95);
    if (type === 'link') {
      finalPrice *= (numPanels * 0.9);
    }
    const price = finalPrice * addOnMultiplier * exactMultiplier;

    const partNumber = `PA-${productFamily.substring(0,2).toUpperCase()}-${Math.floor(1000 + numWidth)}`;
    const cartonQuantity = 10;
    const cartonPrice = price * cartonQuantity * 0.95;
    const linkWidthRange = `${(numWidth * 0.8).toFixed(1)}" - ${(numWidth * 1.2).toFixed(1)}"`;

    setPricingResult({ 'Range of Link Width': linkWidthRange, 'Part Number': partNumber, 'Price': price, 'Carton Quantity': cartonQuantity, 'Carton Price': cartonPrice });
  };
  
  useEffect(() => {
    if (type === 'panel') setNumPanels(1);
    generateQuote();
  }, [productFamily, addOn, type, numPanels, isExact, width, height]);
  
  const handleAddToDashboard = () => {
    if(pricingResult && pricingResult.Price > 0) {
      let config: any = { productFamily, addOn, type, isExact, width, height };
      if (type === 'link') config.numPanels = numPanels;
      onCalculate('panels', config, pricingResult.Price, {
        partNumber: pricingResult['Part Number'],
        cartonQuantity: pricingResult['Carton Quantity'],
        cartonPrice: pricingResult['Carton Price'],
      });
    }
  };
  
  return (
    <CalculatorTemplate 
      title="Panels-Links Calculator"
      description="Configure panel type and link count for pricing"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <FormField label="Product Family"><select value={productFamily} onChange={(e) => setProductFamily(e.target.value)} className="w-full p-3 border rounded-md bg-white"><option>Tri-Dek FC Panel</option><option>Tri-Dek 3/67 2-Ply</option><option>Tri-Dek 15/40 3-Ply</option><option>Tri-Dek 4-ply XL</option></select></FormField>
          <FormField label="Optional Add-on"><select value={addOn} onChange={(e) => setAddOn(e.target.value)} className="w-full p-3 border rounded-md bg-white"><option value="none">None</option><option value="antimicrobial">Antimicrobial</option></select></FormField>
          <FormField label="Type"><div className="flex items-center space-x-4"><label className="flex items-center"><input type="radio" name="type" value="panel" checked={type === 'panel'} onChange={(e) => setType(e.target.value)} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"/><span className="ml-2">Panel</span></label><label className="flex items-center"><input type="radio" name="type" value="link" checked={type === 'link'} onChange={(e) => setType(e.target.value)} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"/><span className="ml-2">Link</span></label></div></FormField>
          {type === 'link' && (<FormField label="Number of Panels"><input type="number" value={numPanels} onChange={(e) => setNumPanels(Math.max(1, parseInt(e.target.value) || 1))} placeholder="e.g., 3" className="w-full p-3 border rounded-md" min="1"/></FormField>)}
          <FormField label="Width (inches)"><input type="number" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="e.g., 48.5" className="w-full p-3 border rounded-md" step="any"/></FormField>
          <FormField label="Height (inches)"><input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g., 24.75" className="w-full p-3 border rounded-md" step="any"/></FormField>
          <FormField label="Made Exact?"><div className="flex items-center space-x-4"><label className="flex items-center"><input type="radio" name="isExactPanel" value="yes" checked={isExact === 'yes'} onChange={(e) => setIsExact(e.target.value)} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"/><span className="ml-2">Yes</span></label><label className="flex items-center"><input type="radio" name="isExactPanel" value="no" checked={isExact === 'no'} onChange={(e) => setIsExact(e.target.value)} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"/><span className="ml-2">No</span></label></div></FormField>
        </div>
        <PricingResult results={pricingResult} onCalculate={handleAddToDashboard} />
      </div>
    </CalculatorTemplate>
  );
}

export default PanelsCalc;
