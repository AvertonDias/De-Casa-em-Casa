// src/lib/emailService.ts
import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_w3xe95d';
const PUBLIC_KEY = 'JdR2XKNICKcHc1jny';
const FEEDBACK_TEMPLATE_ID = 'template_8jxgats';
const PASSWORD_RESET_TEMPLATE_ID = 'template_uw6rp1c';

emailjs.init({ publicKey: PUBLIC_KEY });

/**
 * Envia um e-mail de feedback.
 * @param templateParams Os parâmetros para o template de feedback.
 */
export const sendFeedbackEmail = async (templateParams: any) => {
  return emailjs.send(SERVICE_ID, FEEDBACK_TEMPLATE_ID, templateParams);
};

/**
 * Envia um e-mail de redefinição de senha.
 * @param templateParams Deve conter `email` e `link`.
 */
export const sendPasswordResetEmail = async (templateParams: { email: string; link: string; }) => {
  return emailjs.send(SERVICE_ID, PASSWORD_RESET_TEMPLATE_ID, templateParams);
};
