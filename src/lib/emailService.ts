// src/lib/emailService.ts
import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_w3xe95d';
const TEMPLATE_ID = 'template_8jxgats'; // Usando o template que sabemos que existe
const PUBLIC_KEY = 'JdR2XKNICKcHc1jny';

emailjs.init({ publicKey: PUBLIC_KEY });

/**
 * Envia um e-mail usando EmailJS.
 * Este template usa o 'template_8jxgats' e passa o HTML completo
 * para o campo 'feedback_message' para ter controle total sobre o conteúdo.
 */
export const sendEmail = async (templateParams: {
  to_email: string;
  subject: string;
  // O conteúdo HTML completo do e-mail
  html_content: string; 
}) => {
  const paramsForTemplate = {
    email: templateParams.to_email, // O template espera 'email'
    subject: templateParams.subject,
    feedback_message: templateParams.html_content, // Nosso HTML vai aqui
    user_name: 'Sistema', // Preenchedor para evitar erros no template
    user_email: 'nao-responda@decasaemcasa.com', // Preenchedor
    congregation_info: 'N/A' // Preenchedor
  };

  return emailjs.send(SERVICE_ID, TEMPLATE_ID, paramsForTemplate);
};
