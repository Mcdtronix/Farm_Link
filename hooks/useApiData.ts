import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../lib/apiConfig';

export interface County {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface MarketPrice {
  id: string;
  crop: string;
  category: string;
  price: number;
  unit: string;
  change: number;
  change_percent: number;
  market: string;
  date: string;
  updated_at: string;
}

export const useApiData = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCounties = useCallback(async (): Promise<County[] | null> => {
    setLoading(true);
    setError(null);

    try {
        const response = await fetch(`${API_BASE_URL}/counties/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error || 'Failed to fetch counties');
        }

        const counties = await response.json();
        return counties;
    } catch (error: any) {
        console.error('Error fetching counties:', error);
        setError(error.message || 'Failed to fetch counties');
        return null;
    } finally {
        setLoading(false);
    }
  }, []);

  const getCategories = useCallback(async (): Promise<ProductCategory[] | null> => {
    setLoading(true);
    setError(null);

    try {
        const response = await fetch(`${API_BASE_URL}/categories/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error || 'Failed to fetch categories');
        }

        const categories = await response.json();
        return categories;
    } catch (error: any) {
        console.error('Error fetching categories:', error);
        setError(error.message || 'Failed to fetch categories');
        return null;
    } finally {
        setLoading(false);
    }
  }, []);

  const getMarketPrices = useCallback(async (filters?: {
    crop?: string;
    market?: string;
  }): Promise<MarketPrice[] | null> => {
    setLoading(true);
    setError(null);

    try {
        const params = new URLSearchParams();
        
        if (filters?.crop) params.append('crop', filters.crop);
        if (filters?.market) params.append('market', filters.market);

        const url = filters ? `${API_BASE_URL}/market-prices/?${params}` : `${API_BASE_URL}/market-prices/`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error || 'Failed to fetch market prices');
        }

        const prices = await response.json();
        return prices;
    } catch (error: any) {
        console.error('Error fetching market prices:', error);
        setError(error.message || 'Failed to fetch market prices');
        return null;
    } finally {
        setLoading(false);
    }
  }, []);

  return { getCounties, getCategories, getMarketPrices, loading, error };
};
