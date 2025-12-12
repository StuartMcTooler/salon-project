// Service color mapping utility for calendar views
// Colors use HSL format for design system consistency

export type ServiceColorKey = 'cuts' | 'color' | 'specialty' | 'other';

export const serviceColors: Record<ServiceColorKey, { bg: string; text: string; border: string }> = {
  cuts: {
    bg: 'hsl(217, 91%, 60%)', // Blue
    text: 'hsl(0, 0%, 100%)',
    border: 'hsl(217, 91%, 50%)',
  },
  color: {
    bg: 'hsl(258, 90%, 66%)', // Purple
    text: 'hsl(0, 0%, 100%)',
    border: 'hsl(258, 90%, 56%)',
  },
  specialty: {
    bg: 'hsl(168, 76%, 42%)', // Teal
    text: 'hsl(0, 0%, 100%)',
    border: 'hsl(168, 76%, 32%)',
  },
  other: {
    bg: 'hsl(38, 92%, 50%)', // Amber
    text: 'hsl(0, 0%, 100%)',
    border: 'hsl(38, 92%, 40%)',
  },
};

// Status colors for badges
export const statusColors: Record<string, { dot: string; label: string }> = {
  checked_in: { dot: 'bg-green-500', label: 'Checked In' },
  confirmed: { dot: 'bg-blue-500', label: 'Confirmed' },
  pending: { dot: 'bg-yellow-500', label: 'Pending' },
  completed: { dot: 'bg-gray-400', label: 'Completed' },
  cancelled: { dot: 'bg-red-500', label: 'Cancelled' },
  no_show: { dot: 'bg-red-600', label: 'No Show' },
};

// Pattern matching keywords for service categorization
const cutKeywords = ['fade', 'cut', 'trim', 'buzz', 'taper', 'clipper', 'kids', 'hair'];
const colorKeywords = ['color', 'dye', 'highlights', 'balayage', 'bleach', 'tint', 'styling', 'style'];
const specialtyKeywords = ['beard', 'shave', 'razor', 'hot towel', 'facial', 'treatment', 'wash'];

export function getServiceCategory(serviceName: string, categoryId?: string | null): ServiceColorKey {
  // If we have a category ID, we could map it directly (for future use)
  // For now, use pattern matching on service name
  
  const lowerName = serviceName.toLowerCase();
  
  if (cutKeywords.some(keyword => lowerName.includes(keyword))) {
    return 'cuts';
  }
  
  if (colorKeywords.some(keyword => lowerName.includes(keyword))) {
    return 'color';
  }
  
  if (specialtyKeywords.some(keyword => lowerName.includes(keyword))) {
    return 'specialty';
  }
  
  return 'other';
}

export function getServiceColor(serviceName: string, categoryId?: string | null) {
  const category = getServiceCategory(serviceName, categoryId);
  return serviceColors[category];
}
