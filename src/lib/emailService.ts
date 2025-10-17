// src/lib/emailService.ts
import emailjs from '@emailjs/browser';

// Substitua com seus próprios IDs de serviço e chave pública do EmailJS
const SERVICE_ID = 'service_w3xe95d'; // ID do Serviço EmailJS
const PUBLIC_KEY = 'JdR2XKNICKcHc1jny'; // Sua Chave Pública EmailJS

// Inicializa o EmailJS uma vez.
emailjs.init({ publicKey: PUBLIC_KEY });

/**
 * Envia um e-mail usando EmailJS com um template e parâmetros dinâmicos.
 * @param templateId - O ID do template a ser usado.
 * @param templateParams - Um objeto contendo as variáveis para o template.
 */
export const sendEmail = (templateId: string, templateParams: Record<string, unknown>) => {
  return emailjs.send(SERVICE_ID, templateId, templateParams);
};

    