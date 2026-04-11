import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../lib/apiConfig';

export interface FarmerProfile {
  id: string;
  name: string;
  farmer_name: string;
  avatar_url: string;
  location: string;
  county: string;
  county_name: string;
  crops: string[];
  rating: number;
  total_reviews: number;
  is_verified: boolean;
  coordinates?: { lat: number; lng: number };
  active_listings: number;
  phone: string;
  email: string;
  distance?: number;
  created_at: string;
}

export interface FarmerDirectoryResponse {
  count: number;
  next: boolean;
  previous: boolean;
  results: FarmerProfile[];
}

export const useFarmerDirectory = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFarmers = useCallback(async (filters?: {
    search?: string;
    county?: string;
    crops?: string;
    verified?: boolean;
    page?: number;
    page_size?: number;
    ordering?: string;
  }): Promise<FarmerDirectoryResponse | null> => {
    setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            
            if (filters?.search) params.append('search', filters.search);
            if (filters?.county) params.append('county', filters.county);
            if (filters?.crops) params.append('crops', filters.crops);
            if (filters?.verified !== undefined) params.append('verified', filters.verified.toString());
            if (filters?.page) params.append('page', filters.page.toString());
            if (filters?.page_size) params.append('page_size', filters.page_size.toString());
            if (filters?.ordering) params.append('ordering', filters.ordering);

            const response = await fetch(`${API_BASE_URL}/farmers/?${params}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || 'Failed to fetch farmers');
            }

            const data = await response.json();
            
            // Parse coordinates from PostGIS format to {lat, lng}
            data.results = data.results.map((farmer: any) => {
                if (farmer.coordinates && typeof farmer.coordinates === 'string') {
                    // Parse "SRID=4326;POINT (lng lat)" format
                    const match = farmer.coordinates.match(/POINT \(([-\d.]+) ([-\d.]+)\)/);
                    if (match) {
                        farmer.coordinates = {
                            lng: parseFloat(match[1]),
                            lat: parseFloat(match[2])
                        };
                    } else {
                        farmer.coordinates = undefined;
                    }
                }
                return farmer;
            });
            
            return data;
        } catch (error: any) {
            console.error('Error fetching farmers:', error);
            setError(error.message || 'Failed to fetch farmers');
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const getFarmerById = useCallback(async (farmerId: string): Promise<FarmerProfile | null> => {
        try {
            const response = await fetch(`${API_BASE_URL}/farmers/${farmerId}/`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || 'Failed to fetch farmer details');
            }

            const farmer = await response.json();
            return farmer;
        } catch (error: any) {
            console.error('Error fetching farmer details:', error);
            setError(error.message || 'Failed to fetch farmer details');
            return null;
        }
    }, []);

    return { getFarmers, getFarmerById, loading, error };
};
