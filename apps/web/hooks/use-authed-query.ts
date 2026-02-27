"use client";

import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

interface UseAuthedQueryOptions {
  enabled?: boolean;
}

export function useAuthedQuery<T>(queryKey: QueryKey, path: string | undefined, options?: UseAuthedQueryOptions) {
  const { data: session } = useSession();
  const enabled = Boolean(session?.accessToken) && Boolean(path) && (options?.enabled ?? true);

  return useQuery({
    queryKey,
    enabled,
    queryFn: async () => {
      if (!session?.accessToken) {
        throw new Error("No access token available");
      }
      if (!path) {
        throw new Error("No query path available");
      }
      return apiFetch<T>(path, session.accessToken);
    }
  });
}
