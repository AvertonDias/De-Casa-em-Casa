// src/lib/emailService.ts
import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_w3xe95d'; 
const TEMPLATE_ID = 'template_geral'; // ID do Template Geral
const PUBLIC_KEY = 'JdR2XKNICKcHc1jny'; 

// Inicializa o EmailJS uma vez.
emailjs.init({ publicKey: PUBLIC_KEY });

/**
 * Envia um e-mail usando EmailJS com parâmetros dinâmicos.
 * @param templateParams - Um objeto contendo as variáveis para o template, como 'subject', 'to_email' e 'html_content'.
 */
export const sendEmail = (templateParams: Record<string, unknown>) => {
  return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
};
