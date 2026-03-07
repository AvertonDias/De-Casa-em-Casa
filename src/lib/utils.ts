import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function maskPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  
  // Se o número tiver mais de 11 dígitos e começar com 55,
  // assumimos que o 55 é o código do país e o removemos para não quebrar a máscara.
  // Números brasileiros têm no máximo 11 dígitos (2 de DDD + 9 de celular).
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.substring(2);
  }

  return digits
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
