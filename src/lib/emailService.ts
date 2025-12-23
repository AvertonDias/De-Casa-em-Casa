
// src/lib/emailService.ts
import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_w3xe95d';
// CORREÇÃO: Usando um template mais genérico para evitar formatação indesejada.
const TEMPLATE_ID = 'template_geral'; 
const PUBLIC_KEY = 'JdR2XKNICKcHc1jny';

// Inicializa o EmailJS uma vez.
emailjs.init({ publicKey: PUBLIC_KEY });

/**
 * Envia um e-mail usando EmailJS com um template genérico.
 * Este template espera as variáveis:
 * - to_email: o destinatário
 * - subject: o assunto do e-mail
 * - html_content: o corpo do e-mail em HTML
 */
export const sendEmail = async (templateParams: {
  to_email: string;
  subject: string;
  html_content: string;
}) => {
  // A chamada agora usa o TEMPLATE_ID correto, que é mais genérico.
  return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
};
