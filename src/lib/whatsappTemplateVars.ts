// Formatting for WhatsApp template variables (Meta rejects empty values).
export const waDate = (d: Date) => d.toLocaleDateString('en-IE', { timeZone: 'Europe/Dublin', weekday: 'short', day: 'numeric', month: 'short' });
export const waTime = (d: Date) => d.toLocaleTimeString('en-IE', { timeZone: 'Europe/Dublin', hour: 'numeric', minute: '2-digit' });
export const firstName = (n?: string | null) => (n || '').trim().split(' ')[0] || 'there';
