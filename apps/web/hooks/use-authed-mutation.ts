"use client";

import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

interface MutationInput {
  path: string;
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

export function useAuthedMutation<T>() {
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({ path, method = "POST", body }: MutationInput) => {
      if (!session?.accessToken) {
        throw new Error("No access token available");
      }

      return apiFetch<T>(path, session.accessToken, {
        method,
        body: body ? JSON.stringify(body) : undefined
      });
    }
  });
}
