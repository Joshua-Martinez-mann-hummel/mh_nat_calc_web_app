import { useState, useEffect } from 'react';
import type { ProShieldData } from '../data/NewProductData/newProductDataTypes';
import { loadNewProductData } from '../services/newProductDataService';

export const useNewProductData = () => {
  const [data, setData] = useState<ProShieldData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const loadedData = await loadNewProductData();
        setData(loadedData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []); // Empty dependency array ensures this runs only once on mount

  return { data, isLoading, error };
};
