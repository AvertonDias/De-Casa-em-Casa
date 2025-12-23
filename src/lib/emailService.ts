
// src/lib/emailService.ts
import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_w3xe95d';
const TEMPLATE_ID = 'template_8jxgats';
const PUBLIC_KEY = 'JdR2XKNICKcHc1jny';

// Inicializa o EmailJS uma vez.
emailjs.init({ publicKey: PUBLIC_KEY });

/**
 * Envia um e-mail usando EmailJS.
 * @param templateParams - Um objeto contendo as variáveis para o template.
 * O TEMPLATE_ID 'template_8jxgats' espera as seguintes variáveis:
 * - to_email: o destinatário
 * - subject: o assunto do e-mail
 * - html_content: o corpo do e-mail em HTML
 */
export const sendEmail = (templateParams: { to_email: string; subject: string; html_content: string; }) => {
  return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
};
