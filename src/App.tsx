import { useState } from 'react';
import { Calculator, Package, Settings, Layers, Grid3x3, Download, Home } from 'lucide-react';

// Import all separated components with the full file extension to ensure resolution
import { PleatsCalc } from './components/PleatsCalc/PleatsCalc';
import PanelsCalc from './components/PanelsCalc/PanelsCalc';
import PadsCalc from './components/PadsCalc/PadsCalc';
import SleevesCalc from './components/SleevesCalc/SleevesCalc';
import Dashboard from './components/Dashboard/Dashboard';

interface Calculation {
  id: number;
  productType: string;
  config: object;
  price: number;
  timestamp: string;
  partNumber: string;
  cartonQuantity: number;
  cartonPrice: number;
}
// Main App Component - now acts as a clean layout and state manager
export default function PricingCalculator() {
  const [activeTab, setActiveTab] = useState('home');
  const [calculations, setCalculations] = useState<Calculation[]>([]);

  const addCalculation = (productType: string, config: object, price: number, quoteDetails: any) => {
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

  // Removed 'Product Guide' from the tabs array
  const tabs = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'pleats', label: 'Pleats Calc', icon: Layers },
    { id: 'panels', label: 'Panels-Links Calc', icon: Grid3x3 },
    { id: 'pads', label: 'Pads Calc', icon: Package },
    { id: 'sleeves', label: 'Sleeves Calc', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
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
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'home' && <Dashboard calculations={calculations} />}
        {activeTab === 'pleats' && <PleatsCalc onCalculate={addCalculation} />}
        {activeTab === 'panels' && <PanelsCalc onCalculate={addCalculation} />}
        {activeTab === 'pads' && <PadsCalc onCalculate={addCalculation} />}
        {activeTab === 'sleeves' && <SleevesCalc onCalculate={addCalculation} />}
      </main>
    </div>
  );
}
