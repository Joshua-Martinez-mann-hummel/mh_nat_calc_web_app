import { useState, useEffect } from 'react';
import type { SleevesData } from '../services/sleeveDataService';
import { loadSleevesData } from '../services/sleeveDataService';

export const useSleevesData = () => {
  const [data, setData] = useState<SleevesData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const loadedData = await loadSleevesData();
        setData(loadedData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred loading sleeves data'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, isLoading, error };
};