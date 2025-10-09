import React, { useState } from 'react';
import { Calculator, FileSpreadsheet, Package, Settings, Layers, Grid3x3, Download, Home } from 'lucide-react';

// Main App Component (like your "Table of Contents" + "Output" sheets)
export default function PricingCalculator() {
  const [activeTab, setActiveTab] = useState('home');
  const [calculations, setCalculations] = useState([]);

  const addCalculation = (productType, config, price, quoteDetails) => {
    const newCalc = {
      id: Date.now(),
      productType,
      config,
      price,
      timestamp: new Date().toLocaleString(),
      partNumber: quoteDetails.partNumber,
      cartonQuantity: quoteDetails.cartonQuantity,
      cartonPrice: quoteDetails.cartonPrice,
    };
    setCalculations([newCalc, ...calculations]);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header - like Excel title bar */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Calculator className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">NAT Pricing Calculator</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                <Download className="h-4 w-4 mr-2" />
                Export Results
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs - like Excel sheet tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'home', label: 'Dashboard', icon: Home },
              { id: 'pleats', label: 'Pleats Calc', icon: Layers },
              { id: 'panels', label: 'Panels-Links Calc', icon: Grid3x3 },
              { id: 'pads', label: 'Pads Calc', icon: Package },
              { id: 'sleeves', label: 'Sleeves Calc', icon: Settings },
              { id: 'guide', label: 'Product Guide', icon: FileSpreadsheet }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'home' && <Dashboard calculations={calculations} />}
        {activeTab === 'pleats' && <PleatsCalc onCalculate={addCalculation} />}
        {activeTab === 'panels' && <PanelsCalc onCalculate={addCalculation} />}
        {activeTab === 'pads' && <PadsCalc onCalculate={addCalculation} />}
        {activeTab === 'sleeves' && <SleevesCalc onCalculate={addCalculation} />}
        {activeTab === 'guide' && <ProductGuide />}
      </main>
    </div>
  );
}

// Dashboard Component (like your "Output" sheet)
function Dashboard({ calculations }) {
  const totalValue = calculations.reduce((sum, calc) => sum + calc.price, 0);
  const uniqueProductTypes = new Set(calculations.map(calc => calc.config.productFamily));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow"><h3 className="text-lg font-semibold text-gray-900">Total Calculations</h3><p className="text-3xl font-bold text-blue-600">{calculations.length}</p></div>
        <div className="bg-white p-6 rounded-lg shadow"><h3 className="text-lg font-semibold text-gray-900">Unique Products Quoted</h3><p className="text-3xl font-bold text-purple-600">{uniqueProductTypes.size}</p></div>
        <div className="bg-white p-6 rounded-lg shadow"><h3 className="text-lg font-semibold text-gray-900">Total Quote Value</h3><p className="text-3xl font-bold text-green-600">${totalValue.toFixed(2)}</p></div>
      </div>
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b"><h3 className="text-lg font-semibold">Quote History</h3></div>
        <div className="p-6">
          {calculations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No calculations yet. Use the tabs above to start pricing products!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Product Family</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Part Number</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Carton Qty</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Carton Price</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {calculations.map((calc) => (
                    <tr key={calc.id}>
                      <td className="py-4 px-4 whitespace-nowrap font-medium text-gray-800">{calc.config.productFamily}</td>
                      <td className="py-4 px-4 whitespace-nowrap text-gray-600">{calc.partNumber}</td>
                      <td className="py-4 px-4 whitespace-nowrap font-semibold text-blue-600">${calc.price.toFixed(2)}</td>
                      <td className="py-4 px-4 whitespace-nowrap text-gray-600">{calc.cartonQuantity}</td>
                      <td className="py-4 px-4 whitespace-nowrap font-semibold text-green-600">${calc.cartonPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const initialPleatsQuote = { 'Part Number': 'N/A', 'Price': 0, 'Carton Quantity': 0, 'Carton Price': 0 };

// Pleats Calculator
function PleatsCalc({ onCalculate }) {
  const [productFamily, setProductFamily] = useState('standard-duty');
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [isExact, setIsExact] = useState('no');
  const [depth, setDepth] = useState('');
  const [pricingResult, setPricingResult] = useState(initialPleatsQuote);

  const generateQuote = () => {
    const numWidth = parseFloat(width) || 0;
    const numLength = parseFloat(length) || 0;
    const numDepth = parseFloat(depth) || 0;

    if (numWidth === 0 || numLength === 0 || numDepth === 0) {
      setPricingResult(initialPleatsQuote);
      return;
    }

    let basePrice = 20.0;
    if (productFamily === 'heavy-duty') basePrice = 35.0;
    if (productFamily === 'premium-plus') basePrice = 50.0;
    const area = numWidth * numLength;
    const exactMultiplier = isExact === 'yes' ? 1.15 : 1.0;
    const depthMultiplier = 1 + (numDepth / 10);
    const price = basePrice + (area * 0.75) * exactMultiplier * depthMultiplier;
    
    const partNumber = `PL-${Math.floor(1000 + numWidth)}-${Math.floor(1000 + numLength)}`;
    const cartonQuantity = 20;
    const cartonPrice = price * cartonQuantity * 0.95;

    setPricingResult({ 'Part Number': partNumber, 'Price': price, 'Carton Quantity': cartonQuantity, 'Carton Price': cartonPrice });
  };
  
  React.useEffect(() => {
    generateQuote();
  }, [productFamily, width, length, isExact, depth]);

  const handleAddToDashboard = () => {
    if (pricingResult && pricingResult.Price > 0) {
      const config = { productFamily, width, length, isExact, depth };
      onCalculate('pleats', config, pricingResult.Price, {
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
          <FormField label="Product Family"><select value={productFamily} onChange={(e) => setProductFamily(e.target.value)} className="w-full p-3 border rounded-md bg-white"><option value="standard-duty">Standard Duty</option><option value="heavy-duty">Heavy Duty</option><option value="premium-plus">Premium Plus</option></select></FormField>
          <FormField label="Width (inches)"><input type="number" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="e.g., 24.5" className="w-full p-3 border rounded-md" step="any"/></FormField>
          <FormField label="Length (inches)"><input type="number" value={length} onChange={(e) => setLength(e.target.value)} placeholder="e.g., 18.25" className="w-full p-3 border rounded-md" step="any"/></FormField>
          <FormField label="Depth (inches)"><input type="number" value={depth} onChange={(e) => setDepth(e.target.value)} placeholder="e.g., 2.75" className="w-full p-3 border rounded-md" step="any"/></FormField>
          <FormField label="Made Exact?"><div className="flex items-center space-x-4"><label className="flex items-center"><input type="radio" name="isExact" value="yes" checked={isExact === 'yes'} onChange={(e) => setIsExact(e.target.value)} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"/><span className="ml-2">Yes</span></label><label className="flex items-center"><input type="radio" name="isExact" value="no" checked={isExact === 'no'} onChange={(e) => setIsExact(e.target.value)} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"/><span className="ml-2">No</span></label></div></FormField>
        </div>
        <PricingResult results={pricingResult} onCalculate={handleAddToDashboard} />
      </div>
    </CalculatorTemplate>
  );
}

const initialPanelsQuote = { 'Range of Link Width': 'N/A', 'Part Number': 'N/A', 'Price': 0, 'Carton Quantity': 0, 'Carton Price': 0 };

// Panels-Links Calculator
function PanelsCalc({ onCalculate }) {
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
  
  React.useEffect(() => {
    if (type === 'panel') setNumPanels(1);
    generateQuote();
  }, [productFamily, addOn, type, numPanels, isExact, width, height]);
  
  const handleAddToDashboard = () => {
    if(pricingResult && pricingResult.Price > 0) {
      let config = { productFamily, addOn, type, isExact, width, height };
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

const initialPadsQuote = { 'Part Number': 'N/A', 'Price': 0, 'Carton Quantity': 0, 'Carton Price': 0 };

// Pads Calculator
function PadsCalc({ onCalculate }) {
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

    React.useEffect(() => {
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

const initialSleevesQuote = { 'Part Number': 'N/A', 'Price': 0, 'Carton Quantity': 0, 'Carton Price': 0 };

// Sleeves Calculator
function SleevesCalc({ onCalculate }) {
  const [productFamily, setProductFamily] = useState('tri-dek-sleeves');
  const [option, setOption] = useState('standard');
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [pricingResult, setPricingResult] = useState(initialSleevesQuote);

  React.useEffect(() => {
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


// Product Guide
function ProductGuide() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">Product Guide</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { name: 'Pleats', description: 'Flexible pleated products with variable dimensions', features: ['Multiple material options', 'Custom widths and heights', 'Standard to deluxe quality'] },
          { name: 'Panels-Links', description: 'Modular panel systems with linking capabilities', features: ['Single, double, or triple panels', 'Up to 4 link connections', 'Scalable configurations'] },
          { name: 'Pads', description: 'Protective padding in various weights and sizes', features: ['Light to heavy duty options', 'Multiple size configurations', 'Durable construction'] },
          { name: 'Sleeves', description: 'Protective sleeves with diameter variations', features: ['Short, medium, and long lengths', '4" to 10" diameter options', 'Custom applications'] }
        ].map((product) => (
          <div key={product.name} className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
            <p className="text-gray-600 mb-3">{product.description}</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">{product.features.map((feature, i) => (<li key={i}>{feature}</li>))}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// Reusable Components
function CalculatorTemplate({ title, description, children }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6"><h2 className="text-2xl font-bold">{title}</h2><p className="text-gray-600">{description}</p></div>
      {children}
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div><label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>{children}</div>
  );
}

// Reusable PricingResult component
function PricingResult({ results, onCalculate }) {
  const isCalculated = results && results.Price > 0;

  return (
    <div className="bg-gray-50 rounded-lg p-6 flex flex-col">
      <h3 className="text-lg font-semibold mb-4">Pricing Result</h3>
      <div className="flex-grow space-y-2 mb-4">
        {results && Object.entries(results).map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-gray-600">{label}:</span>
            <span className={`font-medium ${label.toLowerCase().includes('price') ? 'text-green-600' : 'text-gray-900'}`}>
              {typeof value === 'number' ? `$${value.toFixed(2)}` : value}
            </span>
          </div>
        ))}
      </div>
      <button 
        onClick={onCalculate}
        disabled={!isCalculated}
        className={`w-full text-white py-2 px-4 rounded-md transition-colors ${isCalculated ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
      >
        Add to Dashboard
      </button>
    </div>
  );
}

