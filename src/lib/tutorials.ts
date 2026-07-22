/**
 * IDs dos vídeos de tutorial do YouTube.
 */
export const TUTORIAL_IDS = {
  ACCEPT_USER: '8KR6XVokh8o',
  REGISTER: 'qyOk9Q9vIhc',
  SHARE_APP: '6BDJDUNeeec',
  MANAGE_HOUSES: '9SM5oP5qmcc',
  REGISTER_CONGREGATION: '9uWqWaFMDjY',
};

/**
 * Lista organizada de tutoriais para a página central.
 */
export const TUTORIAL_LIST = [
  { 
    id: TUTORIAL_IDS.REGISTER, 
    title: "Como se cadastrar", 
    description: "Passo a passo para novos publicadores solicitarem acesso à sua congregação." 
  },
  { 
    id: TUTORIAL_IDS.REGISTER_CONGREGATION, 
    title: "Criar uma Congregação", 
    description: "Guia para administradores que estão trazendo sua congregação para o sistema digital." 
  },
  { 
    id: TUTORIAL_IDS.ACCEPT_USER, 
    title: "Aprovar novos membros", 
    description: "Para administradores e dirigentes liberarem o acesso dos irmãos que solicitaram cadastro." 
  },
  { 
    id: TUTORIAL_IDS.MANAGE_HOUSES, 
    title: "Gerenciar números e casas", 
    description: "Aprenda a adicionar, editar e organizar a ordem das casas dentro das quadras." 
  },
  { 
    id: TUTORIAL_IDS.SHARE_APP, 
    title: "Compartilhar o App", 
    description: "Como enviar o link oficial para que outros irmãos instalem o sistema no celular." 
  },
];

/**
 * Gera a URL de embed do YouTube otimizada para Shorts e reprodução direta.
 */
export const getTutorialUrl = (id: string) => `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
