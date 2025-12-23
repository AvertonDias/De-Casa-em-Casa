// src/lib/emailService.ts
import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_w3xe95d';
const PUBLIC_KEY = 'JdR2XKNICKcHc1jny';

emailjs.init({ publicKey: PUBLIC_KEY });

/**
 * Envia um e-mail usando EmailJS com um template ID dinâmico.
 */
export const sendEmail = async (templateId: string, templateParams: any) => {
  return emailjs.send(SERVICE_ID, templateId, templateParams);
};
