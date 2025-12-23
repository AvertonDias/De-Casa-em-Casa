// src/lib/emailService.ts
import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_w3xe95d'; 
// Usando o mesmo template do feedback que já sabemos que funciona.
const TEMPLATE_ID = 'template_8jxgats';
const PUBLIC_KEY = 'JdR2XKNICKcHc1jny'; 

// Inicializa o EmailJS uma vez.
emailjs.init({ publicKey: PUBLIC_KEY });

/**
 * Envia um e-mail usando EmailJS.
 * @param templateParams - Um objeto contendo as variáveis para o template.
 */
export const sendEmail = (templateParams: Record<string, unknown>) => {
  // A chamada agora usa o TEMPLATE_ID que já está validado.
  return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
};
