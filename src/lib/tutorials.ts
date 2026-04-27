/**
 * IDs dos vídeos de tutorial do YouTube.
 * Substitua os valores abaixo pelos IDs reais dos seus vídeos (o código que aparece na URL).
 */
export const TUTORIAL_IDS = {
  ACCEPT_USER: 'X9tWNXo7JBK', // Tutorial: Aceitar usuário pendente
  REGISTER: 'qyOk9Q9vIhc',    // Tutorial: Cadastro no app (URL: https://youtube.com/shorts/qyOk9Q9vIhc)
  SHARE_APP: '6BDJDUNeeec',   // Tutorial: Compartilhar app (URL: https://youtube.com/shorts/6BDJDUNeeec)
  MANAGE_HOUSES: '9SM5oP5qmcc', // Tutorial: Gerenciar, editar e reordenar casas (URL: https://youtube.com/shorts/9SM5oP5qmcc)
};

/**
 * Gera a URL de embed do YouTube otimizada para Shorts e reprodução direta.
 */
export const getTutorialUrl = (id: string) => `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
