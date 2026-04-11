import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../lib/apiConfig';

export interface UserLookupData {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  county: string;
  location: string;
  phone: string;
  date_joined: string;
}

export const useUserLookup = () => {
  const { user } = useAuth();

  const getUserById = async (userId: string): Promise<UserLookupData | null> => {
    try {
      console.log(`🔍 FRONTEND USER LOOKUP:`);
      console.log(`   User ID: ${userId}`);

      const response = await fetch(`${API_BASE_URL}/users/${userId}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`📤 USER LOOKUP RESPONSE:`);
      console.log(`   Status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'User lookup failed');
      }

      const userData = await response.json();
      
      console.log(`✅ USER LOOKUP SUCCESS:`);
      console.log(`   User Data: ${JSON.stringify(userData, null, 2)}`);

      return userData;
    } catch (error: any) {
      console.error(`❌ USER LOOKUP FAILED: ${error.message}`);
      return null;
    }
  };

  return { getUserById };
};
