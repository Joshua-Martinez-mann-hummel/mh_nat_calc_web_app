import { useState, useEffect } from 'react';
import type { PricingData } from '../data/PleatsData/dataTypes';
import { loadAndParseData } from '../services/dataService';

export const usePricingData = () => {
  const [data, setData] = useState<PricingData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const loadedData = await loadAndParseData();
        setData(loadedData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []); // The empty array ensures this runs only once on mount

  return { data, isLoading, error };
};