
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  amount: number | null | undefined, 
  currency: string = "UGX",
  locale: string = "en-UG" 
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "N/A";
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0, // Typically, UGX doesn't use cents
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMoneyInput(value: string): string {
  // Remove all non-digit characters
  const numericValue = value.replace(/\D/g, '');
  
  // If empty, return empty string
  if (!numericValue) return '';
  
  // Format with commas for thousands
  return new Intl.NumberFormat('en-US').format(parseInt(numericValue));
}

export function parseFormattedMoney(formattedValue: string): number {
  // Remove all non-digit characters and parse as integer
  const numericValue = formattedValue.replace(/\D/g, '');
  return parseInt(numericValue) || 0;
}
