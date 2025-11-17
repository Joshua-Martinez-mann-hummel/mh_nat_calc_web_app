import { useState } from 'react';
import { Calculator, Package, Settings, Layers, Grid3x3, Home, Menu, X } from 'lucide-react';

// Import all separated components with the full file extension to ensure resolution
import { PleatsCalc } from './components/PleatsCalc/PleatsCalc';
import PanelsCalc from './components/PanelsCalc/PanelsCalc';
import PadsCalc from './components/PadsCalc/PadsCalc';
import SleevesCalc from './components/SleevesCalc/SleevesCalc';
import Dashboard from './components/Dashboard/Dashboard';
import { ToastProvider, useToast } from './components/ui/ToastContext';

export interface Calculation {
  id: number;
  productType: string;
  config: Record<string, any>;
  price: number;
  timestamp: string;
  partNumber: string;
  notes?: string;
  cartonQuantity: number;
  cartonPrice: number;
  quantityInput?: number;
}

function AppContent() {
  const [activeTab, setActiveTab] = useState('home');
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { addToast } = useToast();

  const addCalculation = (productType: string, config: object, price: number, resultDetails: any) => {
    const newCalc = {
      id: Date.now(),
      productType,
      config,
      price,
      timestamp: new Date().toLocaleString(),
      partNumber: resultDetails.partNumber,
      cartonQuantity: resultDetails.cartonQuantity ?? resultDetails.cartonQty ?? 0,
      cartonPrice: resultDetails.cartonPrice,
      notes: resultDetails.notes,
      quantityInput: 1, // Default quantity to 1 when adding to quote
    };

    // Log debug information to the console if it exists
    if (resultDetails.debugInfo) {
      console.group(`--- Pricing Debug: ${productType} ---`);
      console.log('Inputs:', config);

      if (resultDetails.debugInfo.partNumberGeneration) {
        console.groupCollapsed('Part Number Generation');
        console.table(resultDetails.debugInfo.partNumberGeneration);
        console.groupEnd();
      }

      if (resultDetails.debugInfo.priceCalculation) {
        console.groupCollapsed('Price Calculation');
        console.table(resultDetails.debugInfo.priceCalculation);
        console.groupEnd();
      }

      console.log('Final Result:', {
        partNumber: resultDetails.partNumber,
        price: resultDetails.price,
        cartonQuantity: resultDetails.cartonQuantity,
        cartonPrice: resultDetails.cartonPrice,
        isOversize: resultDetails.isOversize,
        notes: resultDetails.notes,
      });
      console.groupEnd();
    }
    setCalculations([newCalc, ...calculations]);
    addToast('Filter added to quote', 'success');
  };

  const handleUpdateCalculation = (id: number, newQuantity: number) => {
    setCalculations(currentCalculations =>
      currentCalculations.map(calc =>
        calc.id === id ? { ...calc, quantityInput: newQuantity } : calc
      )
    );
  };

  const handleRemoveCalculation = (id: number) => {
    setCalculations(currentCalculations =>
      currentCalculations.filter(calc => calc.id !== id),
    );
    addToast('Item removed from quote', 'info');
  };

  const handleClearQuote = () => {
    setCalculations([]);
    addToast('Quote cleared', 'info');
  };

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMenuOpen(false); // Close menu on selection
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
              <h1 className="text-2xl font-bold text-gray-900">C&I Custom Calcuators</h1>
            </div>
          </div>
        </div>
      </header>
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Desktop Menu: hidden on small screens */}
          <div className="hidden md:flex md:space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5 mr-2" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mobile Menu Button: visible only on small screens */}
          <div className="md:hidden flex justify-between items-center h-16">
            <button
              onClick={() => handleTabClick('home')}
              className={`flex items-center px-1 py-4 text-sm font-medium border-b-2 transition-colors duration-200 ${
                activeTab === 'home'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Home className="h-5 w-5 mr-2" />
              Dashboard
            </button>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-md text-gray-500 hover:bg-gray-100">
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMenuOpen && (
            <div className="md:hidden absolute top-full left-0 right-0 bg-white shadow-lg border-t">
              <div className="px-2 pt-2 pb-3 space-y-1">
                {tabs.filter(t => t.id !== 'home').map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`w-full text-left flex items-center px-3 py-3 text-base font-medium rounded-md transition-colors duration-200 ${activeTab === tab.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'}`}
                  >
                    <tab.icon className="h-5 w-5 mr-3" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'home' && <Dashboard calculations={calculations} onUpdateCalculation={handleUpdateCalculation} onRemoveCalculation={handleRemoveCalculation} onClearQuote={handleClearQuote} />}
        {activeTab === 'pleats' && <PleatsCalc onCalculate={addCalculation} />}
        {activeTab === 'panels' && <PanelsCalc onCalculate={addCalculation} />}
        {activeTab === 'pads' && <PadsCalc onCalculate={addCalculation} />}
        {activeTab === 'sleeves' && <SleevesCalc onCalculate={addCalculation} />}
      </main>
    </div>
  );
}

// Main App Component - now acts as a clean layout and state manager
export default function PricingCalculator() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
