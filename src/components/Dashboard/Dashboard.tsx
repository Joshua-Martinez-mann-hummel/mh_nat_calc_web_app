import { useState, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import { Trash2, ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { Calculation } from '../../App';

// Define the component's props interface
interface DashboardProps {
  calculations: Calculation[];
  onUpdateCalculation: (id: number, newQuantity: number) => void;
  onRemoveCalculation: (id: number) => void;
  onClearQuote: () => void;
}

type SortKey = keyof Calculation | 'productFamily' | 'totalPrice';

function Dashboard({ calculations, onUpdateCalculation, onRemoveCalculation, onClearQuote }: DashboardProps) {
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>(null);

  // Calculate total value based on price * quantity for each item.
  const totalValue = calculations.reduce((sum, calc) => {
    const quantity = calc.quantityInput ?? 1;
    return sum + (calc.price * quantity);
  }, 0);
  const uniqueProductTypes = new Set(calculations.map(calc => calc.config.productFamily));

  const sortedCalculations = useMemo(() => {
    let sortableItems = [...calculations];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        // Handle special sort keys
        if (sortConfig.key === 'productFamily') {
          aValue = a.config.productFamily;
          bValue = b.config.productFamily;
        } else if (sortConfig.key === 'totalPrice') {
          aValue = a.price * (a.quantityInput ?? 1);
          bValue = b.price * (b.quantityInput ?? 1);
        } else {
          aValue = a[sortConfig.key as keyof Calculation];
          bValue = b[sortConfig.key as keyof Calculation];
        }

        // Comparison logic
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [calculations, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    // 1. Map the calculation data to the desired Excel format.
    const dataForExport = calculations.map(calc => ({
      sku: calc.partNumber,
      // The Calculation object always has cartonQuantity.
      quantityInput: calc.cartonQuantity ?? 1,
      proposedPriceInput: calc.price,
    }));

    // 2. Create a new worksheet from the formatted data.
    const worksheet = utils.json_to_sheet(dataForExport);

    // 3. Create a new workbook and append the worksheet.
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Quote');

    // 4. Trigger the file download.
    writeFile(workbook, 'quote.xlsx');
  };

  const getSortIcon = (name: SortKey) => {
    if (!sortConfig || sortConfig.key !== name) {
      return <ChevronsUpDown className="h-4 w-4 ml-1 text-gray-400" />;
    }
    if (sortConfig.direction === 'ascending') {
      return <ArrowUp className="h-4 w-4 ml-1" />;
    }
    return <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Helper component for sortable table headers
  const SortableHeader = ({ sortKey, children }: { sortKey: SortKey, children: React.ReactNode }) => (
    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort(sortKey)}>
      <div className="flex items-center">{children}{getSortIcon(sortKey)}</div>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow"><h3 className="text-lg font-semibold text-gray-900">Total Calculations</h3><p className="text-3xl font-bold text-blue-600">{calculations.length}</p></div>
        <div className="bg-white p-6 rounded-lg shadow"><h3 className="text-lg font-semibold text-gray-900">Unique Products Quoted</h3><p className="text-3xl font-bold text-purple-600">{uniqueProductTypes.size}</p></div>
        <div className="bg-white p-6 rounded-lg shadow"><h3 className="text-lg font-semibold text-gray-900">Total Quote Value</h3><p className="text-3xl font-bold text-green-600">${totalValue.toFixed(2)}</p></div>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">Quote History</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to clear the entire quote? This action cannot be undone.')) {
                  onClearQuote();
                }
              }}
              disabled={calculations.length === 0}
              className="bg-red-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Clear Quote
            </button>
            <button
              onClick={handleExport}
              disabled={calculations.length === 0}
              className="bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Export to Excel
            </button>
          </div>
        </div>
        <div className="p-6">
          {calculations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No calculations yet. Use the tabs above to start pricing products!</p>
          ) : (
            <>
            {/* Desktop Table View */}
            <div className="overflow-x-auto hidden md:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <SortableHeader sortKey="productFamily">Product Family</SortableHeader>
                    <SortableHeader sortKey="partNumber">Part Number</SortableHeader>
                    <SortableHeader sortKey="price">Unit Price</SortableHeader>
                    <SortableHeader sortKey="cartonQuantity">Carton Qty</SortableHeader>
                    <SortableHeader sortKey="quantityInput">Quantity</SortableHeader>
                    <SortableHeader sortKey="totalPrice">Total Price</SortableHeader>
                    <SortableHeader sortKey="cartonPrice">Carton Price</SortableHeader>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedCalculations.map((calc) => (
                    <tr key={calc.id}>
                      <td className="py-4 px-4 whitespace-nowrap font-medium text-gray-800">{calc.config.productFamily ?? calc.config.productName}</td>
                      <td className="py-4 px-4 whitespace-nowrap text-gray-600">{calc.partNumber}</td>
                      <td className="py-4 px-4 whitespace-nowrap font-semibold text-blue-600">${calc.price.toFixed(2)}</td>
                      <td className="py-4 px-4 whitespace-nowrap text-gray-600">{calc.cartonQuantity ?? 0}</td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={calc.quantityInput ?? 1}
                          onChange={(e) => onUpdateCalculation(calc.id, parseInt(e.target.value, 10) || 1)}
                          className="w-20 p-1 border rounded-md text-center"
                          min="1"
                        />
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap font-semibold text-green-600">${(calc.price * (calc.quantityInput ?? 1)).toFixed(2)}</td>
                      <td className="py-4 px-4 whitespace-nowrap font-semibold text-gray-800">${calc.cartonPrice.toFixed(2)}</td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <button
                          onClick={() => onRemoveCalculation(calc.id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {sortedCalculations.map((calc) => (
                <div key={calc.id} className="bg-gray-50 rounded-lg shadow p-4 border border-gray-200">
                  {/* Top section: Info and Remove button */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-gray-800 text-base">{calc.config.productFamily ?? calc.config.productName}</p>
                      <p className="text-sm text-gray-500">{calc.partNumber}</p>
                    </div>
                    <button
                      onClick={() => onRemoveCalculation(calc.id)}
                      className="text-red-500 hover:text-red-700 transition-colors flex-shrink-0 ml-2 p-1"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Middle section: Details */}
                  <div className="text-xs text-gray-600 border-t border-b py-2 my-2 flex justify-around">
                    <span>Unit: <strong>${calc.price.toFixed(2)}</strong></span>
                    <span className="border-l mx-2"></span>
                    <span>Carton: <strong>${calc.cartonPrice.toFixed(2)}</strong></span>
                    <span className="border-l mx-2"></span>
                    <span>C.Qty: <strong>{calc.cartonQuantity ?? 0}</strong></span>
                  </div>

                  {/* Bottom section: Quantity and Total Price */}
                  <div className="flex justify-between items-center mt-3">
                    <div className="flex items-center">
                      <label htmlFor={`quantity-mobile-${calc.id}`} className="text-sm font-medium text-gray-700 mr-2">Qty:</label>
                      <input
                        id={`quantity-mobile-${calc.id}`}
                        type="number"
                        value={calc.quantityInput ?? 1}
                        onChange={(e) => onUpdateCalculation(calc.id, parseInt(e.target.value, 10) || 1)}
                        className="w-20 p-1 border rounded-md text-center"
                        min="1" />
                    </div>
                    <p className="text-lg font-bold text-green-600">${(calc.price * (calc.quantityInput ?? 1)).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
