import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User, UserRole } from "@/data/mock";
import { Platform } from 'react-native';
import { router } from 'expo-router';

const AUTH_KEY = "@agrilink_auth_user";
const USERS_KEY = "@agrilink_users";

// For real device testing, set EXPO_PUBLIC_DOMAIN to your PC/LAN IP, e.g. "192.168.1.10:8000"
// Fallbacks: Android emulator uses 10.0.2.2, others use localhost.
const DEFAULT_HOST = Platform.OS === 'android' ? "10.0.2.2:8000" : "localhost:8000";
const HOST = process.env.EXPO_PUBLIC_DOMAIN || DEFAULT_HOST;
const API_BASE_URL = HOST.startsWith("http://") || HOST.startsWith("https://")
  ? `${HOST.replace(/\/$/, "")}/api/v1`
  : `http://${HOST}/api/v1`;
interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
  password2: string;
  role: UserRole;
  county: string;
  location: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface TwoFactorData {
  user_id: string;
  token?: string;
  backup_code?: string;
}

interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  tokens: {
    access: string;
    refresh: string;
  };
  profile?: {
    phone?: string;
    role?: UserRole;
    county?: string;
    location?: string;
  };
  requires_2fa?: boolean;
  email_verification_required?: boolean;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  verifyTwoFactor: (data: TwoFactorData) => Promise<void>;
  setupTwoFactor: (method: string) => Promise<void>;
  verifyTwoFactorSetup: (token: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  verifyPasswordResetCode: (email: string, token: string, code: string) => Promise<void>;
  resetPassword: (email: string, token: string, newPassword: string, newPassword2: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// API helper functions
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = await AsyncStorage.getItem(`${AUTH_KEY}_access`);
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Don't send token for authentication endpoints
  const isAuthEndpoint = endpoint.startsWith('/auth/') || endpoint.startsWith('/api/v1/auth/');
  
  console.log(`🌐 FRONTEND API REQUEST:`);
  console.log(`   URL: ${url}`);
  console.log(`   Method: ${options.method || 'GET'}`);
  console.log(`   Headers: ${JSON.stringify({
    'Content-Type': 'application/json',
    ...(token && !isAuthEndpoint && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }, null, 2)}`);
  console.log(`   Body: ${options.body || 'No body'}`);
  console.log(`   Token present: ${!!token}`);
  console.log(`   Auth endpoint: ${isAuthEndpoint}`);
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && !isAuthEndpoint && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  });

  console.log(`📤 FRONTEND API RESPONSE:`);
  console.log(`   Status: ${response.status}`);
  console.log(`   Status Text: ${response.statusText}`);
  console.log(`   Headers: ${JSON.stringify(Object.fromEntries(response.headers), null, 2)}`);

  const data = await response.json();
  console.log(`   Response Data: ${JSON.stringify(data, null, 2)}`);

  if (!response.ok) {
    // Build a user-friendly message from all possible DRF error shapes:
    //   { detail: "..." }        — throttle / permission errors
    //   { message: "..." }       — custom app errors
    //   { error: "..." }         — custom app errors (alt key)
    //   { non_field_errors: [] } — serializer validation
    let errorMsg: string;
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const wait = retryAfter ? `${Math.ceil(Number(retryAfter) / 60)} minutes` : 'a while';
      errorMsg = `Too many requests. Please try again in ${wait}.`;
    } else {
      errorMsg =
        data.message ||
        data.detail ||
        data.error ||
        (Array.isArray(data.non_field_errors) ? data.non_field_errors.join(' ') : null) ||
        'Request failed';
    }
    console.error(`❌ API REQUEST FAILED [${response.status}]: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  console.log(`✅ API REQUEST SUCCESSFUL`);
  return data;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTH_KEY);
        if (stored) {
          const userData = JSON.parse(stored);
          setUser(userData);
          
          // Verify token is still valid — only clear on definitive auth failures
          try {
            await apiRequest('/auth/me/');
          } catch (err: any) {
            const msg = err?.message || '';
            const isAuthFailure = msg.includes('401') || msg.includes('Invalid') || msg.includes('expired') || msg.includes('not_authenticated');
            if (isAuthFailure) {
              await AsyncStorage.multiRemove([AUTH_KEY, `${AUTH_KEY}_access`, `${AUTH_KEY}_refresh`]);
              setUser(null);
            }
            // Network/throttle/server errors: keep local user intact
          }
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const getUsers = useCallback(async (): Promise<
    Array<User & { password: string }>
  > => {
    const stored = await AsyncStorage.getItem(USERS_KEY);
    const dbUsers: Array<User & { password: string }> = stored
      ? JSON.parse(stored)
      : [];
    return dbUsers;
  }, []);

  const saveUser = useCallback(async (u: User & { password: string }) => {
    const stored = await AsyncStorage.getItem(USERS_KEY);
    const dbUsers: Array<User & { password: string }> = stored
      ? JSON.parse(stored)
      : [];
    const idx = dbUsers.findIndex((x) => x.id === u.id);
    if (idx >= 0) dbUsers[idx] = u;
    else dbUsers.push(u);
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(dbUsers));
  }, []);

  const login = useCallback(
    async (data: LoginData) => {
      console.log(`🔐 FRONTEND LOGIN ATTEMPT:`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Password provided: ${!!data.password}`);
      console.log(`   API Base URL: ${API_BASE_URL}`);
      
      try {
        // Try backend login first
        const response = await apiRequest('/auth/login/', {
          method: 'POST',
          body: JSON.stringify(data),
        });

        console.log(`✅ LOGIN RESPONSE RECEIVED:`);
        console.log(`   Response: ${JSON.stringify(response, null, 2)}`);

        if (response.requires_2fa) {
          console.log(`🔐 2FA REQUIRED`);
          // Store user_id for 2FA verification
          await AsyncStorage.setItem(`${AUTH_KEY}_2fa_user_id`, response.user_id);
          throw new Error('2FA_REQUIRED');
        }

        if (response.email_verification_required) {
          console.log(`📧 EMAIL NOT VERIFIED`);
          throw new Error('EMAIL_NOT_VERIFIED');
        }

        // Successful login
        console.log(`🎉 LOGIN SUCCESSFUL`);
        const userData = {
          id: response.user.id,
          name: `${response.user.first_name} ${response.user.last_name}`,
          email: response.user.email,
          role: response.profile?.role as UserRole || 'buyer', // Keep fallback for now
          location: response.profile?.location || '',
          county: response.profile?.county || '',
          verified: true,
          joinedDate: new Date().toISOString().split('T')[0],
          rating: 0,
          totalSales: 0,
          avatar: `https://api.dicebear.com/7.x/avataaars/png?seed=${response.user.username}`,
        };

        console.log(`👤 USER DATA PREPARED: ${JSON.stringify(userData, null, 2)}`);

        setUser(userData);
        await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(userData));
        await AsyncStorage.setItem(`${AUTH_KEY}_access`, response.tokens.access);
        await AsyncStorage.setItem(`${AUTH_KEY}_refresh`, response.tokens.refresh);

        console.log(`✅ USER SESSION STORED SUCCESSFULLY`);

      } catch (error: any) {
        console.error(`❌ LOGIN FAILED: ${error.message}`);
        console.error(`   Error details:`, error);
        
        // Backend failed - show error to user
        throw new Error(error.message || 'Login failed');
      }
    },
    []
  );

  const verifyTwoFactor = useCallback(
    async (data: TwoFactorData) => {
      try {
        const response = await apiRequest('/auth/2fa/', {
          method: 'POST',
          body: JSON.stringify(data),
        });

        const userData = {
          id: response.user.id,
          name: `${response.user.first_name} ${response.user.last_name}`,
          email: response.user.email,
          role: response.profile?.role as UserRole || 'buyer', // Keep fallback for now
          location: response.profile?.location || '',
          county: response.profile?.county || '',
          verified: true,
          joinedDate: new Date().toISOString().split('T')[0],
          rating: 0,
          totalSales: 0,
          avatar: `https://api.dicebear.com/7.x/avataaars/png?seed=${response.user.username}`,
        };

        setUser(userData);
        await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(userData));
        await AsyncStorage.setItem(`${AUTH_KEY}_access`, response.tokens.access);
        await AsyncStorage.setItem(`${AUTH_KEY}_refresh`, response.tokens.refresh);
        await AsyncStorage.removeItem(`${AUTH_KEY}_2fa_user_id`);

      } catch (error: any) {
        // Backend failed - show error to user
        throw new Error(error.message || '2FA verification failed');
      }
    },
    []
  );

  const register = useCallback(
    async (data: RegisterData) => {
      console.log(`🔐 FRONTEND REGISTRATION ATTEMPT:`);
      console.log(`   User data: ${JSON.stringify(data, null, 2)}`);
      console.log(`   API Base URL: ${API_BASE_URL}`);
      
      try {
        // Try backend registration first
        const response = await apiRequest('/auth/register/', {
          method: 'POST',
          body: JSON.stringify({
            username: data.email.split('@')[0],
            email: data.email,
            password: data.password,
            password2: data.password2,
            first_name: data.name.split(' ')[0],
            last_name: data.name.split(' ').slice(1).join(' '),
            phone: data.phone,
            role: data.role,
            county: data.county,
            location: data.location,
          }),
        });

        console.log(`✅ REGISTRATION RESPONSE RECEIVED:`);
        console.log(`   Response: ${JSON.stringify(response, null, 2)}`);

        if (response.email_verification_required) {
          console.log(`📧 EMAIL VERIFICATION REQUIRED`);
          throw new Error('EMAIL_VERIFICATION_REQUIRED');
        }

      } catch (error: any) {
        console.error(`❌ REGISTRATION FAILED: ${error.message}`);
        console.error(`   Error details:`, error);
        
        // Backend failed - show error to user
        if (error.message === 'EMAIL_VERIFICATION_REQUIRED') {
          throw error;
        }
        throw new Error(error.message || 'Registration failed');
      }
    },
    []
  );

  const setupTwoFactor = useCallback(
    async (method: string) => {
      try {
        const response = await apiRequest('/auth/setup-2fa/', {
          method: 'POST',
          body: JSON.stringify({ method }),
        });

        return response.backup_codes;
      } catch (error: any) {
        throw new Error(error.message || '2FA setup failed');
      }
    },
    []
  );

  const verifyTwoFactorSetup = useCallback(
    async (token: string) => {
      try {
        const response = await apiRequest('/auth/verify-2fa-setup/', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });

        return response.two_factor_enabled;
      } catch (error: any) {
        throw new Error(error.message || '2FA setup verification failed');
      }
    },
    []
  );

  const resendVerification = useCallback(
    async (email: string) => {
      try {
        // This would be a backend endpoint to resend verification
        await apiRequest('/auth/resend-verification/', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
      } catch (error: any) {
        throw new Error(error.message || 'Failed to resend verification email');
      }
    },
    []
  );

  const logout = useCallback(async () => {
    console.log(`🚪 FRONTEND LOGOUT INITIATED`);
    
    try {
      // Get refresh token for backend logout
      const refreshToken = await AsyncStorage.getItem(`${AUTH_KEY}_refresh`);
      
      if (refreshToken) {
        console.log(`📤 Calling backend logout with refresh token`);
        try {
          await apiRequest('/auth/logout/', {
            method: 'POST',
            body: JSON.stringify({ refresh: refreshToken }),
          });
          console.log(`✅ Backend logout successful`);
        } catch (logoutError) {
          console.warn(`⚠️ Backend logout failed: ${logoutError.message}`);
          // Continue with local logout even if backend fails
        }
      }
    } catch (error) {
      console.error(`❌ Logout process error: ${error.message}`);
    }

    // Clear all authentication data
    console.log(`🧹 Clearing all authentication data`);
    setUser(null);
    
    // Comprehensive cleanup of all auth-related storage
    await AsyncStorage.multiRemove([
      AUTH_KEY,
      `${AUTH_KEY}_access`,
      `${AUTH_KEY}_refresh`,
      `${AUTH_KEY}_2fa_user_id`,
      // Also clear any user-related data
      'USERS_KEY', // Clear stored users
    ]);
    
    console.log(`✅ Logout completed successfully`);
    
    // Navigate to login screen
    if (router && router.replace) {
      router.replace('/(auth)/login');
    }
  }, [router]);

  const updateProfile = useCallback(
    async (updates: Partial<User>) => {
      if (!user) return;
      
      try {
        console.log(`🔧 FRONTEND PROFILE UPDATE:`);
        console.log(`   Updates: ${JSON.stringify(updates, null, 2)}`);
        
        // Call backend profile update endpoint
        const response = await apiRequest('/profile/', {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });

        console.log(`✅ PROFILE UPDATE RESPONSE:`);
        console.log(`   Response: ${JSON.stringify(response, null, 2)}`);

        if (response.error) {
          throw new Error(response.message || 'Profile update failed');
        }

        // Update local state with backend response
        const updatedUser = {
          ...user,
          ...response,
        };
        
        setUser(updatedUser);
        await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(updatedUser));
        
        console.log(`✅ PROFILE UPDATED SUCCESSFULLY`);
        
      } catch (error: any) {
        console.error(`❌ PROFILE UPDATE FAILED: ${error.message}`);
        throw new Error(error.message || 'Profile update failed');
      }
    },
    [user]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // PASSWORD RESET FUNCTIONS (2FA-based flow)
  // ─────────────────────────────────────────────────────────────────────────────

  const forgotPassword = useCallback(async (email: string) => {
    console.log(`🔐 FRONTEND FORGOT PASSWORD REQUEST:`);
    console.log(`   Email: ${email}`);
    console.log(`   API Base URL: ${API_BASE_URL}`);
    
    try {
      const response = await apiRequest('/auth/forgot-password/', {
        method: 'POST',
        body: JSON.stringify({ email: email.toLowerCase() }),
      });
      
      console.log(`✅ FORGOT PASSWORD RESPONSE:`);
      console.log(`   Message: ${response.message}`);
      console.log(`   Response: ${JSON.stringify(response, null, 2)}`);
      
    } catch (error: any) {
      console.error(`❌ FORGOT PASSWORD FAILED: ${error.message}`);
      throw new Error(error.message || 'Failed to initiate password reset');
    }
  }, []);

  const verifyPasswordResetCode = useCallback(async (email: string, token: string, code: string) => {
    console.log(`🔐 FRONTEND VERIFY PASSWORD RESET CODE:`);
    console.log(`   Email: ${email}`);
    console.log(`   Token: ${token}`);
    console.log(`   Code: ${code}`);
    
    try {
      const response = await apiRequest('/auth/password-reset/verify-code/', {
        method: 'POST',
        body: JSON.stringify({
          email: email.toLowerCase(),
          token,
          code,
        }),
      });
      
      console.log(`✅ PASSWORD RESET CODE VERIFICATION RESPONSE:`);
      console.log(`   Message: ${response.message}`);
      console.log(`   Response: ${JSON.stringify(response, null, 2)}`);
      
      // Store the token for use in next step
      await AsyncStorage.setItem(`${AUTH_KEY}_reset_token`, response.token);
      
    } catch (error: any) {
      console.error(`❌ PASSWORD RESET CODE VERIFICATION FAILED: ${error.message}`);
      throw new Error(error.message || 'Invalid verification code');
    }
  }, []);

  const resetPassword = useCallback(
    async (email: string, token: string, newPassword: string, newPassword2: string) => {
      console.log(`🔐 FRONTEND PASSWORD RESET CONFIRM:`);
      console.log(`   Email: ${email}`);
      console.log(`   Token: ${token}`);
      console.log(`   New Password: ${'*'.repeat(newPassword.length)}`);
      
      try {
        const response = await apiRequest('/auth/password-reset/confirm/', {
          method: 'POST',
          body: JSON.stringify({
            email: email.toLowerCase(),
            token,
            new_password: newPassword,
            new_password2: newPassword2,
          }),
        });
        
        console.log(`✅ PASSWORD RESET CONFIRM RESPONSE:`);
        console.log(`   Message: ${response.message}`);
        console.log(`   Response: ${JSON.stringify(response, null, 2)}`);
        
        // Clear the reset token
        await AsyncStorage.removeItem(`${AUTH_KEY}_reset_token`);
        
        // Navigate to login
        if (router && router.replace) {
          router.replace('/(auth)/login');
        }
        
      } catch (error: any) {
        console.error(`❌ PASSWORD RESET CONFIRM FAILED: ${error.message}`);
        throw new Error(error.message || 'Failed to reset password');
      }
    },
    [router]
  );

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      verifyTwoFactor,
      setupTwoFactor,
      verifyTwoFactorSetup,
      updateProfile,
      resendVerification,
      forgotPassword,
      verifyPasswordResetCode,
      resetPassword,
    }),
    [user, isLoading, login, register, logout, verifyTwoFactor, setupTwoFactor, verifyTwoFactorSetup, updateProfile, resendVerification, forgotPassword, verifyPasswordResetCode, resetPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
