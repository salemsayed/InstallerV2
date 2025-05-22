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
  // Remove API logging to reduce console noise
  // console.log(`[API] ${method} request to ${url}`);
  
  try {
    // Enhanced headers to ensure proper cookies and cache behavior
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    };
    
    // Add content-type when sending data
    if (data) {
      headers['Content-Type'] = 'application/json';
    }
    
    // Add session ID from localStorage if available (helps with auth in problematic environments)
    const tempUserId = localStorage.getItem("temp_user_id");
    if (tempUserId && !url.includes('logout')) {
      headers['X-Temp-User-ID'] = tempUserId;
    }
    
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // Always include credentials for session cookies
      mode: 'same-origin',
      cache: 'no-cache', // Prevent caching issues with authentication
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
    // Silent logging to reduce console clutter
    // console.log(`[API Query] GET ${queryKey[0]}`);
    
    try {
      // Enhanced headers for better cross-environment compatibility
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      };
      
      // Add temp user ID if available (helps with auth in problematic environments)
      const tempUserId = localStorage.getItem("temp_user_id");
      if (tempUserId) {
        headers['X-Temp-User-ID'] = tempUserId;
        
        // Also add temp role if available
        const tempUserRole = localStorage.getItem("temp_user_role");
        if (tempUserRole) {
          headers['X-Temp-User-Role'] = tempUserRole;
        }
      }
      
      const res = await fetch(queryKey[0] as string, {
        method: 'GET',
        headers,
        credentials: "include", // Critical for authentication
        cache: "no-cache", // Prevent caching authentication issues
        mode: 'same-origin'
      });
      
      if (res.status === 401 || res.status === 403) {
        // Silent auth error handling
        
        // Check if we should handle 401 specially
        if (unauthorizedBehavior === "returnNull" && res.status === 401) {
          return null;
        }
        
        // Check if we're on login page to avoid redirect loops
        const isLoginPath = window.location.pathname === '/' || 
                           window.location.pathname === '/auth/login';
        
        // Only redirect if we're not already on the login page
        if (res.status === 401 && !isLoginPath) {
          setTimeout(() => {
            window.location.href = '/auth/login';
          }, 100);
          return null;
        }
      }
      
      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      // Silent error handling to reduce console noise
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
