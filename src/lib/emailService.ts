// src/lib/emailService.ts
import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_w3xe95d';
const TEMPLATE_ID = 'template_geral'; // CORREÇÃO DEFINITIVA: Usando o template genérico correto.
const PUBLIC_KEY = 'JdR2XKNICKcHc1jny';

emailjs.init({ publicKey: PUBLIC_KEY });

/**
 * Envia um e-mail usando EmailJS com um template genérico.
 * Este template espera que o conteúdo HTML completo seja passado
 * para controlar totalmente a aparência do e-mail.
 */
export const sendEmail = async (templateParams: {
  to_email: string;
  subject: string;
  html_content: string; 
}) => {
  // Os parâmetros são mapeados para as variáveis esperadas pelo template 'template_geral'
  const paramsForTemplate = {
    to_email: templateParams.to_email,
    subject: templateParams.subject,
    html_content: templateParams.html_content,
  };

  // A chamada agora usa o TEMPLATE_ID correto e consistente.
  return emailjs.send(SERVICE_ID, TEMPLATE_ID, paramsForTemplate);
};
