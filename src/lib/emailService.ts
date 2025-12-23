
// src/lib/emailService.ts
import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_w3xe95d';
const PUBLIC_KEY = 'JdR2XKNICKcHc1jny';

emailjs.init({ publicKey: PUBLIC_KEY });

/**
 * Envia um e-mail usando EmailJS, especificando o template a ser usado.
 * @param templateId O ID do template do EmailJS a ser usado.
 * @param templateParams Os parâmetros para preencher o template.
 */
export const sendEmail = async (templateId: string, templateParams: any) => {
  return emailjs.send(SERVICE_ID, templateId, templateParams);
};
