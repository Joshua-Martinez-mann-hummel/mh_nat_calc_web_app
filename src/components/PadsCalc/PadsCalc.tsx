import React, { useState, useEffect } from 'react';
import CalculatorTemplate from '../ui/CalculatorTemplate.tsx';
import FormField from '../ui/FormField.tsx';
import PricingResult from '../ui/PricingResult.tsx';

// Define the component's props interface
interface PadsCalcProps {
    onCalculate: (productType: string, config: object, price: number, quoteDetails: object) => void;
}

const initialPadsQuote = { 'Part Number': 'N/A', 'Price': 0, 'Carton Quantity': 0, 'Carton Price': 0 };

function PadsCalc({ onCalculate }: PadsCalcProps) {
    const [productFamily, setProductFamily] = useState('standard-pad');
    const [option, setOption] = useState('standard');
    const [width, setWidth] = useState('');
    const [length, setLength] = useState('');
    const [pricingResult, setPricingResult] = useState(initialPadsQuote);

    const generateQuote = () => {
        const numWidth = parseFloat(width) || 0;
        const numLength = parseFloat(length) || 0;

        if (numWidth === 0 || numLength === 0) {
            setPricingResult(initialPadsQuote);
            return;
        }

        let basePrice = 15.0;
        if (productFamily === 'heavy-duty-pad') basePrice = 25.0;
        const area = numWidth * numLength;
        const optionMultiplier = option === 'antimicrobial' ? 1.25 : 1.0;
        const price = (basePrice + (area * 0.55)) * optionMultiplier;

        const partNumber = `PD-${productFamily.includes('heavy') ? 'HD' : 'SD'}-${Math.floor(1000 + numWidth)}`;
        const cartonQuantity = 100;
        const cartonPrice = price * cartonQuantity * 0.98;

        setPricingResult({ 'Part Number': partNumber, 'Price': price, 'Carton Quantity': cartonQuantity, 'Carton Price': cartonPrice });
    };

    useEffect(() => {
        generateQuote();
    }, [productFamily, option, width, length]);

    const handleAddToDashboard = () => {
        if(pricingResult && pricingResult.Price > 0) {
            const config = { productFamily, option, width, length };
            onCalculate('pads', config, pricingResult.Price, {
                partNumber: pricingResult['Part Number'],
                cartonQuantity: pricingResult['Carton Quantity'],
                cartonPrice: pricingResult['Carton Price'],
            });
        }
    };

    return (
        <CalculatorTemplate 
            title="Pads Calculator"
            description="Select pad weight and size specifications"
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <FormField label="Product Family"><select value={productFamily} onChange={(e) => setProductFamily(e.target.value)} className="w-full p-3 border rounded-md bg-white"><option value="standard-pad">Standard Pad</option><option value="heavy-duty-pad">Heavy Duty Pad</option></select></FormField>
                    <FormField label="Option"><select value={option} onChange={(e) => setOption(e.target.value)} className="w-full p-3 border rounded-md bg-white"><option value="standard">Standard</option><option value="antimicrobial">Antimicrobial</option></select></FormField>
                    <FormField label="Width (inches)"><input type="number" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="e.g., 36.5" className="w-full p-3 border rounded-md" step="any"/></FormField>
                    <FormField label="Length (inches)"><input type="number" value={length} onChange={(e) => setLength(e.target.value)} placeholder="e.g., 12.25" className="w-full p-3 border rounded-md" step="any"/></FormField>
                </div>
                <PricingResult results={pricingResult} onCalculate={handleAddToDashboard} />
            </div>
        </CalculatorTemplate>
    );
}

export default PadsCalc;

