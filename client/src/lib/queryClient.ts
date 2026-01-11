import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = unknown>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }
  return {} as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";

function buildUrl(queryKey: readonly unknown[]): string {
  const [basePath, ...params] = queryKey;
  if (params.length === 0 || params[0] === undefined) {
    return basePath as string;
  }
  
  const baseUrl = basePath as string;
  
  if (typeof params[0] === "object" && params[0] !== null) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params[0] as Record<string, string>)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }
  
  if (baseUrl === "/api/scripts" && params[0]) {
    return `${baseUrl}?projectId=${params[0]}`;
  }
  if (baseUrl === "/api/scenes" && params[0]) {
    return `${baseUrl}?projectId=${params[0]}`;
  }
  if (baseUrl === "/api/shots" && params[0]) {
    return `${baseUrl}?sceneId=${params[0]}`;
  }
  if (baseUrl === "/api/characters" && params[0]) {
    return `${baseUrl}?projectId=${params[0]}`;
  }
  if (baseUrl === "/api/performance-guides" && params.length >= 1) {
    const sceneId = params[0];
    const characterId = params[1];
    let url = `${baseUrl}?sceneId=${sceneId}`;
    if (characterId) url += `&characterId=${characterId}`;
    return url;
  }
  if (baseUrl === "/api/production-notes" && params[0]) {
    return `${baseUrl}?sceneId=${params[0]}`;
  }
  
  return queryKey.join("/") as string;
}

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = buildUrl(queryKey);
    const res = await fetch(url, {
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
