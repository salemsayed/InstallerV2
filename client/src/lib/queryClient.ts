import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const responseData = await res.text();
    let errorMessage: string;
    
    try {
      // Try to parse as JSON
      const jsonError = JSON.parse(responseData);
      errorMessage = jsonError.message || res.statusText;
    } catch (e) {
      // If not valid JSON, use text as is
      errorMessage = responseData || res.statusText;
    }
    
    // Format more user-friendly error for 401
    if (res.status === 401) {
      errorMessage = "غير مصرح لك بالوصول. تحقق من بياناتك أو تواصل مع المسؤول.";
    }
    
    const error: any = new Error(errorMessage);
    error.status = res.status;
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
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
    const res = await fetch(queryKey[0] as string, {
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
