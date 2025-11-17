

// Define the component's props interface
interface PricingResultProps {
  results: Record<string, any> | null;
  onCalculate: () => void;
  note?: string;
  buttonId?: string;
}

// This component displays the calculated quote and the "Add to Dashboard" button.
function PricingResult({ results, onCalculate, note, buttonId }: PricingResultProps) {
  const isCalculated = results && results.Price > 0;

  const formatValue = (key: string, value: any) => {
    if (typeof value === 'number') {
      // Don't format Part Number or Carton Quantity as currency
      if (key === 'Part Number' || key === 'Carton Quantity') {
        return value.toLocaleString();
      }
      // Format other numbers as currency
      return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
      });
    }
    return value;
  };

  return (
    <div className="bg-gray-50 rounded-lg p-6 flex flex-col">
      <h3 className="text-lg font-semibold mb-4">Pricing Result</h3>
      <div className="flex-grow space-y-2 mb-4">
        {results && Object.entries(results).map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-gray-600">{label}:</span>
            <span className={`font-medium ${label.toLowerCase().includes('price') ? 'text-green-600' : 'text-gray-900'}`}>{formatValue(label, value)}</span>
          </div>
        ))}
        {note && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Note:</span>
            <span className="text-gray-900 font-medium">{note}</span>
          </div>
        )}
      </div>
      <button 
        id={buttonId}
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
