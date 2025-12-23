// src/lib/emailService.ts
import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_w3xe95d';
// Este é o ID do template de FEEDBACK, que será usado como um "envelope" genérico.
const TEMPLATE_ID = 'template_8jxgats';
const PUBLIC_KEY = 'JdR2XKNICKcHc1jny';

emailjs.init({ publicKey: PUBLIC_KEY });

/**
 * Envia um e-mail usando EmailJS.
 * Os parâmetros devem corresponder aos esperados pelo template no EmailJS.
 */
export const sendEmail = async (templateParams: any) => {
  // A função agora usa o TEMPLATE_ID fixo que sabemos que existe.
  return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
};
