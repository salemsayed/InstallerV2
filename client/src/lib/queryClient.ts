import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const responseData = await res.text();
    let errorMessage: string;
    let errorData: any = {};
    
    try {
      // Try to parse as JSON
      errorData = JSON.parse(responseData);
      errorMessage = errorData.message || res.statusText;
    } catch (e) {
      // If not valid JSON, use text as is
      errorMessage = responseData || res.statusText;
    }
    
    // Handle session expiration or authentication issues
    if (res.status === 401) {
      console.warn("[AUTH] Authentication error detected", res.url);
      errorMessage = "غير مصرح لك بالوصول. تحقق من بياناتك أو تواصل مع المسؤول.";
      
      // Don't redirect if we're already on the login page to avoid loops
      const isLoginPath = window.location.pathname === '/' || 
                         window.location.pathname === '/auth/login';
      
      if (!isLoginPath) {
        console.warn("[AUTH] Redirecting to login page due to 401 error");
        // Use timeout to allow error handlers to complete first
        setTimeout(() => {
          // Force full page reload to clear any stale state
          window.location.href = '/';
        }, 100);
      }
    }
    
    const error: any = new Error(errorMessage);
    error.status = res.status;
    error.data = errorData;
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.log(`[API] ${method} request to ${url}`);
  
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // Always include credentials for session cookies
    });
    
    // Log status for debugging authentication issues
    if (res.status === 401 || res.status === 403) {
      console.warn(`[API] Auth error: ${res.status} on ${url}`);
    }
    
    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`[API] Error in ${method} request to ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    console.log(`[API Query] GET ${queryKey[0]}`);
    
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include", // Critical for authentication
        cache: "no-cache", // Prevent caching authentication issues
      });
      
      if (res.status === 401 || res.status === 403) {
        console.warn(`[API Query] Auth error: ${res.status} on ${queryKey[0]}`);
        
        if (unauthorizedBehavior === "returnNull" && res.status === 401) {
          console.log(`[API Query] Returning null due to 401 as configured`);
          return null;
        }
      }
      
      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.error(`[API Query] Error fetching ${queryKey[0]}:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false, // Default to false, but we'll override for specific queries
      refetchOnWindowFocus: true, // Enable refetch when window regains focus
      staleTime: 10000, // Consider data stale after 10 seconds
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
