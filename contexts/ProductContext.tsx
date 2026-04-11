import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";
import { MOCK_PRODUCTS, type Product } from "@/data/mock";
import { Platform } from "react-native";

const AUTH_KEY = "@agrilink_auth_user";
const AUTH_ACCESS_KEY = `${AUTH_KEY}_access`;
const AUTH_REFRESH_KEY = `${AUTH_KEY}_refresh`;
const API_BASE_URL = `${getApiUrl().replace(/\/$/, "")}/api/v1`;

function normalizeImageUrl(url: string): string {
  try {
    const apiOrigin = new URL(getApiUrl()).origin;
    const u = new URL(url);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return `${apiOrigin}${u.pathname}${u.search}`;
    }
    return url;
  } catch {
    return url;
  }
}

async function refreshAccessTokenOrThrow(): Promise<string> {
  const refresh = await AsyncStorage.getItem(AUTH_REFRESH_KEY);
  if (!refresh) throw new Error("Session expired. Please login again.");

  const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  const data = await res.json().catch(() => null);
  const newAccess = data?.access;
  if (!res.ok || !newAccess) {
    await AsyncStorage.multiRemove([AUTH_KEY, AUTH_ACCESS_KEY, AUTH_REFRESH_KEY]);
    throw new Error("Session expired. Please login again.");
  }

  await AsyncStorage.setItem(AUTH_ACCESS_KEY, newAccess);
  return newAccess;
}

interface NewProductData {
  name: string;
  category: string;
  description: string;
  price: number;
  unit: string;
  quantity: number;
  isOrganic: boolean;
  county: string;
  images?: string[];
}

interface ProductContextValue {
  products: Product[];
  isLoading: boolean;
  addProduct: (
    data: NewProductData,
    farmerId: string,
    farmerName: string,
    farmerLocation: string
  ) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  getProductsByFarmer: (farmerId: string) => Product[];
  refreshProducts: () => Promise<void>;
}

const ProductContext = createContext<ProductContextValue | null>(null);

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/products/`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to load products");

      // Backend returns { results: Product[] }
      const raw: Product[] = Array.isArray(data?.results) ? data.results : [];
      const backendProducts: Product[] = raw.map((p) => ({
        ...p,
        images: Array.isArray(p.images) ? p.images.map(normalizeImageUrl) : [],
      }));

      // Keep a fallback to mock products if backend empty (nice UX for demo)
      setProducts(backendProducts.length ? backendProducts : MOCK_PRODUCTS);
    } catch {
      setProducts(MOCK_PRODUCTS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const addProduct = useCallback(
    async (
      data: NewProductData,
      farmerId: string,
      farmerName: string,
      farmerLocation: string
    ) => {
      let token = await AsyncStorage.getItem(AUTH_ACCESS_KEY);
      if (!token) throw new Error("Not authenticated");

      const form = new FormData();
      form.append("name", data.name);
      form.append("category", data.category);
      form.append("description", data.description);
      form.append("price", String(data.price));
      form.append("unit", data.unit);
      form.append("quantity", String(data.quantity));
      form.append("isOrganic", String(!!data.isOrganic));
      form.append("county", data.county);

      for (const uri of (data.images || []).slice(0, 5)) {
        if (typeof uri !== "string" || !uri) continue;

        if (Platform.OS === "web") {
          const resp = await fetch(uri);
          const blob = await resp.blob();
          const mime = blob.type || "image/jpeg";
          const ext = mime.split("/")[1] || "jpg";
          const file = new File([blob], `product.${ext}`, { type: mime });
          form.append("images", file as any);
        } else {
          form.append("images", {
            uri,
            name: "product.jpg",
            type: "image/jpeg",
          } as any);
        }
      }

      const doPost = async (accessToken: string) => {
        return await fetch(`${API_BASE_URL}/products/`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: form,
        });
      };

      let res = await doPost(token);
      if (res.status === 401) {
        token = await refreshAccessTokenOrThrow();
        res = await doPost(token);
      }

      const out = await res.json().catch(() => null);
      if (!res.ok) throw new Error(out?.message || out?.error || "Failed to create product");

      await loadProducts();
    },
    [loadProducts]
  );

  const updateProduct = useCallback(
    async (
      id: string,
      data: Partial<NewProductData>
    ) => {
      let token = await AsyncStorage.getItem(AUTH_ACCESS_KEY);
      if (!token) throw new Error("Not authenticated");

      try {
        console.log(`🔧 FRONTEND PRODUCT UPDATE:`);
        console.log(`   Product ID: ${id}`);
        console.log(`   Update Data: ${JSON.stringify(data, null, 2)}`);

        const form = new FormData();
        
        // Add only provided fields to form
        if (data.name) form.append("name", data.name);
        if (data.category) form.append("category", data.category);
        if (data.description) form.append("description", data.description);
        if (data.price !== undefined) form.append("price", String(data.price));
        if (data.unit) form.append("unit", data.unit);
        if (data.quantity !== undefined) form.append("quantity", String(data.quantity));
        if (data.isOrganic !== undefined) form.append("is_organic", String(data.isOrganic));
        if (data.county) form.append("county", data.county);

        // Handle images if provided
        if (data.images && data.images.length > 0) {
          for (const uri of data.images.slice(0, 5)) {
            if (typeof uri !== "string" || !uri) continue;

            if (Platform.OS === "web") {
              const resp = await fetch(uri);
              const blob = await resp.blob();
              const mime = blob.type || "image/jpeg";
              const ext = mime.split("/")[1] || "jpg";
              const file = new File([blob], `product.${ext}`, { type: mime });
              form.append("images", file as any);
            } else {
              form.append("images", {
                uri,
                name: "product.jpg",
                type: "image/jpeg",
              } as any);
            }
          }
        }

        const doUpdate = async (accessToken: string) => {
          return await fetch(`${API_BASE_URL}/products/${id}/`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            body: form,
          });
        };

        let res = await doUpdate(token);
        if (res.status === 401) {
          token = await refreshAccessTokenOrThrow();
          res = await doUpdate(token);
        }

        const out = await res.json().catch(() => null);
        if (!res.ok) throw new Error(out?.message || out?.error || "Failed to update product");

        await loadProducts();
        
        console.log(`✅ PRODUCT UPDATED SUCCESSFULLY`);
        return out;
        
      } catch (error: any) {
        console.error(`❌ PRODUCT UPDATE FAILED: ${error.message}`);
        throw new Error(error.message || "Failed to update product");
      }
    },
    []
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      let token = await AsyncStorage.getItem(AUTH_ACCESS_KEY);
      if (!token) throw new Error("Not authenticated");

      const doDelete = async (accessToken: string) => {
        return await fetch(`${API_BASE_URL}/products/${id}/`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      };

      let res = await doDelete(token);
      if (res.status === 401) {
        token = await refreshAccessTokenOrThrow();
        res = await doDelete(token);
      }

      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(text || "Failed to delete product");
      }

      await loadProducts();
    },
    [loadProducts]
  );

  const getProductsByFarmer = useCallback(
    (farmerId: string) => products.filter((p) => p.farmerId === farmerId),
    [products]
  );

  const value = useMemo(
    () => ({
      products,
      isLoading,
      addProduct,
      updateProduct,
      deleteProduct,
      getProductsByFarmer,
      refreshProducts: loadProducts,
    }),
    [products, isLoading, addProduct, deleteProduct, getProductsByFarmer, loadProducts]
  );

  return (
    <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error("useProducts must be used within ProductProvider");
  return ctx;
}

export { type NewProductData };
