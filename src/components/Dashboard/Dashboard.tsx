import React from 'react';

// Define the component's props interface
interface DashboardProps {
  calculations: any[]; // Using 'any' for now, can be tightened later
}

function Dashboard({ calculations }: DashboardProps) {
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

export default Dashboard;

