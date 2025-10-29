// Based on the template from src/hooks/useSleevesData.ts
import { useState, useEffect } from 'react';
import type { PadsData } from '../data/PadsData/padsDataTypes';
import { loadPadsData } from '../services/padsDataService';

export const usePadsData = () => {
  const [data, setData] = useState<PadsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const loadedData = await loadPadsData();
        setData(loadedData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred loading pads data'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, isLoading, error };
};