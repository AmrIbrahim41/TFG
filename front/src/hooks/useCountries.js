import { useState, useEffect, useCallback } from 'react';
import api from '../api'; // تأكد من المسار
import { z } from 'zod';

export const countrySchema = z.object({
  name: z.string().min(1, 'Country name is required').max(80),
  code: z.string().length(2, 'Must be 2 characters').toUpperCase(),
  dial_code: z.string().min(2, 'Dial code required').regex(/^\+\d+$/, 'Must start with +'),
});

export function useCountries() {
  const [countries, setCountries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCountries = useCallback(async (signal) => {
    try {
      const res = await api.get('/countries/', { signal });
      if (!signal?.aborted) setCountries(res.data);
    } catch (e) {
      if (e.name !== 'CanceledError' && e.code !== 'ERR_CANCELED') console.error(e);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCountries(controller.signal);
    return () => controller.abort();
  }, [fetchCountries]);

  const addCountry = async (data) => {
    await api.post('/countries/', data);
    await fetchCountries();
  };

  return { countries, isLoading, addCountry, refetch: fetchCountries };
}