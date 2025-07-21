import { QueryClient, QueryFunction } from "@tanstack/react-query";
import axios from "axios";

// export const BASE_API = "http://192.168.1.11:5000";
export const BASE_API = "http://10.43.206.244:5000";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  // Prepend BASE_API if url is relative
  const fullUrl = url.startsWith("http://") || url.startsWith("https://") ? url : BASE_API + url;
  let headers = data ? { "Content-Type": "application/json" } : {};
  let payload = data;
  if (data && typeof data === "object" && "__headers" in data) {
    headers = { ...headers, ...(data as any).__headers };
    // Remove __headers from payload
    const { __headers, ...rest } = data as any;
    payload = rest;
  }
  const config = {
    method,
    url: fullUrl,
    data: payload,
    withCredentials: true,
    headers,
  };
  const res = await axios(config);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await axios.get(queryKey[0] as string, { withCredentials: true });
      return res.data;
    } catch (err: any) {
      if (
        unauthorizedBehavior === "returnNull" &&
        err.response &&
        err.response.status === 401
      ) {
        return null;
      }
      throw err;
    }
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
