"use client";

import { create } from "zustand";
import { DEFAULT_SITE_ID, DEFAULT_TIME_RANGE } from "@/lib/constants";

interface GlobalFiltersState {
  siteId: string;
  timeRange: string;
  setSiteId: (siteId: string) => void;
  setTimeRange: (range: string) => void;
}

export const useGlobalFilters = create<GlobalFiltersState>((set) => ({
  siteId: DEFAULT_SITE_ID,
  timeRange: DEFAULT_TIME_RANGE,
  setSiteId: (siteId) => set({ siteId }),
  setTimeRange: (timeRange) => set({ timeRange })
}));
