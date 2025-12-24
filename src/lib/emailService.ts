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


// Função para buscar o conteúdo do template
async function getEmailTemplate() {
  try {
      const response = await fetch('/email-template.html');
      if (!response.ok) {
          throw new Error('Não foi possível carregar o template de e-mail.');
      }
      return await response.text();
  } catch (error) {
      console.error(error);
      return '<p>{{ message }}</p><a href="{{reset_link}}">Clique aqui</a>';
  }
}

/**
 * Envia um e-mail de redefinição de senha.
 * @param templateParams Os parâmetros para o template de redefinição de senha.
 */
export const sendPasswordResetEmail = async (templateParams: any) => {
  const emailTemplate = await getEmailTemplate();

  const finalHtml = emailTemplate
    .replace('{{ subject }}', templateParams.subject || 'Redefinição de Senha')
    .replace('{{ to_name }}', templateParams.to_name || 'Usuário')
    .replace('{{ message }}', templateParams.message || '')
    .replace(/{{reset_link}}/g, templateParams.reset_link || '')
    .replace('{{ action_button_text }}', templateParams.action_button_text || 'Clique Aqui')
    .replace('{{email}}', templateParams.email || '');

  const paramsToSend = {
    ...templateParams,
    html_content: finalHtml,
  };

  return emailjs.send(SERVICE_ID, PASSWORD_RESET_TEMPLATE_ID, paramsToSend);
};
