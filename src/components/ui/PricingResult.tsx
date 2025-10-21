import React from 'react';

// Define the component's props interface
interface PricingResultProps {
  results: Record<string, any> | null;
  onCalculate: () => void;
}

// This component displays the calculated quote and the "Add to Dashboard" button.
function PricingResult({ results, onCalculate }: PricingResultProps) {
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

export default PricingResult;
