import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function maskPhone(value: string): string {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .substring(0, 15); // Limita ao formato (XX) XXXXX-XXXX
}

export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) {
    return '';
  }
  return name
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}
