import Papa, {
  type ParseResult,
  type ParseRemoteConfig,
} from 'papaparse';

/**
 * A generic, reusable utility to fetch and parse a CSV file from a URL.
 * @param filePath The URL of the CSV file.
 * @returns A promise that resolves to an array of parsed objects.
 */
export const parseCsvFromUrl = <T>(filePath: string): Promise<T[]> => {
  return new Promise<T[]>((resolve, reject) => {
    const config: ParseRemoteConfig<T> = {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results: ParseResult<T>) => resolve(results.data),
      error: (error: Error) => reject(error),
    };
    Papa.parse<T>(filePath, config);
  });
};