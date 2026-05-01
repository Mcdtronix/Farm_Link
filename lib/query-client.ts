import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";

import { Platform } from 'react-native';

/**
 * Gets the base URL for the Django API server (e.g., "http://localhost:8000")
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  // For development, use 10.0.2.2 for Android Emulator, localhost:8000 for others
  const defaultHost = Platform.OS === 'android' ? "10.0.2.2:8000" : "localhost:8000";
  // For real device testing, set EXPO_PUBLIC_DOMAIN to your PC/LAN IP, e.g. "192.168.1.10:8000"
  let host = process.env.EXPO_PUBLIC_DOMAIN || defaultHost;

  // Ensure the URL has the correct protocol
  if (!host.startsWith("http://") && !host.startsWith("https://")) {
    host = `http://${host}`;
  }

  // ← ADD THIS: Remove trailing slash to avoid double-slash issues
  host = host.replace(/\/$/, "");


  return host;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const res = await fetch(url.toString(), {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url.toString(), {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
