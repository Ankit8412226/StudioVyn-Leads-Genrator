import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date) {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return formatDate(date);
}

export function formatNumber(num: number) {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatPhoneNumber(phone: string) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    contacted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    interested: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    qualified: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    proposal: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    negotiation: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    won: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    unqualified: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  };
  return colors[status] || colors.new;
}

export function getPriorityColor(priority: string) {
  const colors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800',
  };
  return colors[priority] || colors.medium;
}

export function getSourceIcon(source: string) {
  const icons: Record<string, string> = {
    google_maps: '📍',
    instagram: '📸',
    facebook: '👥',
    linkedin: '💼',
    twitter: '🐦',
    whatsapp: '💬',
    telegram: '✈️',
    email: '📧',
    website_form: '🌐',
    landing_page: '📄',
    chat_widget: '💭',
    webhook: '🔗',
    csv_import: '📊',
    excel_import: '📈',
    manual: '✍️',
    justdial: '📞',
    indiamart: '🏭',
    yelp: '⭐',
    clutch: '🏢',
    other: '📋',
  };
  return icons[source] || '📋';
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function generateWhatsAppLink(phone: string, message?: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  const baseUrl = `https://wa.me/${cleanPhone}`;
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
}

export function generateMailtoLink(email: string, subject?: string, body?: string) {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const queryString = params.toString();
  return `mailto:${email}${queryString ? `?${queryString}` : ''}`;
}

export function generateTelLink(phone: string) {
  return `tel:${phone.replace(/\D/g, '')}`;
}
