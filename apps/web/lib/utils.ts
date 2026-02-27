import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(input: string | Date | null) {
  if (!input) return "-";
  const value = input instanceof Date ? input : new Date(input);
  return value.toLocaleString();
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}
