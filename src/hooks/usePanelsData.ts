/**
 * @file React hook to fetch and manage the data for the Panels-Links calculator.
 * This hook encapsulates the logic for loading, error handling, and storing the data
 * required by the Panels-Links calculation engine.
 */

import { useState, useEffect } from 'react';
import type { PanelsLinksData } from '../data/PanelsData/panelsDataTypes';
import { loadPanelsData } from '../services/panelsDataServices';

/**
 * Custom hook that provides the Panels-Links data, along with loading and error states.
 * It fetches the data from the `panelsDataServices` on component mount.
 *
 * @returns An object containing the panels data, loading status, and any potential error.
 */
export const usePanelsData = () => {
  const [data, setData] = useState<PanelsLinksData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const loadedData = await loadPanelsData();
        setData(loadedData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('An unknown error occurred loading panels data'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []); // Empty dependency array ensures this runs only once on mount.

  return { data, isLoading, error };
};