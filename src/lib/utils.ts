import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize phone numbers to international format
 * Converts Irish local format (087...) to international (+353 87...)
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return phone;
  
  // Remove all spaces, dashes, and parentheses
  let normalized = phone.replace(/[\s\-\(\)]/g, '');
  
  // If already has +, return as is
  if (normalized.startsWith('+')) {
    return normalized;
  }
  
  // If starts with 00, replace with +
  if (normalized.startsWith('00')) {
    return '+' + normalized.substring(2);
  }
  
  // If starts with 0 (Irish local format), convert to +353
  if (normalized.startsWith('0')) {
    return '+353' + normalized.substring(1);
  }
  
  // If it's just digits without prefix, assume Irish and add +353
  if (/^\d+$/.test(normalized)) {
    return '+353' + normalized;
  }
  
  return normalized;
}
