# Resumo Técnico do Projeto "De Casa em Casa"

Este documento fornece uma visão geral da linguagem de programação, tecnologias e estrutura de arquivos do aplicativo.

## 1. Linguagens e Tecnologias Principais

*   **Linguagem Principal:** **TypeScript**
    *   Usado tanto no frontend (Next.js) quanto no backend (Firebase Functions) para garantir segurança de tipos e manutenibilidade.

*   **Frontend:**
    *   **Framework:** [**Next.js 14+**](https://nextjs.org/) com **App Router**.
    *   **Biblioteca UI:** [**React**](https://react.dev/)
    *   **Componentes:** [**ShadCN UI**](https://ui.shadcn.com/) (Componentes pré-construídos e customizáveis).
    *   **Estilização:** [**Tailwind CSS**](https://tailwindcss.com/) (Utility-first CSS framework).

*   **Backend & Banco de Dados:**
    *   **Plataforma:** [**Firebase**](https://firebase.google.com/)
    *   **Autenticação:** Firebase Authentication (login por e-mail/senha).
    *   **Banco de Dados Principal:** Cloud Firestore (banco de dados NoSQL em tempo real).
    *   **Funções Serverless:** Firebase Functions (para lógica de backend, gatilhos e tarefas automatizadas).
    *   **Presença Online:** Realtime Database (para o sistema de status "online/offline").
    *   **Armazenamento de Arquivos:** Cloud Storage (usado para imagens de cartões de território, etc.).

*   **Progressive Web App (PWA):**
    *   Capacidade de ser "instalado" em dispositivos móveis e desktop para uma experiência de aplicativo nativo e com suporte offline.

## 2. Estrutura de Arquivos Principais

A estrutura do projeto está organizada para separar claramente as responsabilidades do frontend e do backend.

```
/
├── api/
│   └── functions/
│       ├── src/
│       │   ├── index.ts      # Ponto de entrada das Cloud Functions
│       │   └── types/        # Tipos específicos do backend
│       └── package.json    # Dependências do backend
│
├── public/
│   ├── images/             # Imagens estáticas (logos, ícones)
│   └── manifest.json       # Configuração do PWA
│
├── src/
│   ├── app/
│   │   ├── (auth)/         # Páginas de autenticação (login, cadastro, etc.)
│   │   ├── dashboard/      # Layout e páginas principais do sistema após o login
│   │   ├── layout.tsx      # Layout raiz da aplicação
│   │   └── page.tsx        # Página inicial (login)
│   │
│   ├── components/
│   │   ├── admin/          # Componentes específicos da área de administração
│   │   ├── dashboard/      # Componentes para o painel de controle
│   │   ├── users/          # Componentes para gerenciamento de usuários
│   │   └── ui/             # Componentes base do ShadCN (Button, Input, etc.)
│   │
│   ├── contexts/
│   │   ├── UserContext.tsx # Gerencia o estado do usuário e autenticação
│   │   └── ...             # Outros contextos (Tema, Fonte, etc.)
│   │
│   ├── hooks/
│   │   └── useUser.ts      # Hook para acessar o contexto do usuário
│   │   └── ...             # Outros hooks customizados
│   │
│   ├── lib/
│   │   ├── firebase.ts     # Configuração e inicialização do Firebase (cliente)
│   │   └── utils.ts        # Funções utilitárias (formatação, etc.)
│   │
│   └── types/
│       └── types.ts        # Definições de tipos TypeScript compartilhadas
│
├── firebase.json           # Configuração de deploy do Firebase (Hosting, Functions)
├── firestore.rules         # Regras de segurança do Cloud Firestore
└── tailwind.config.ts      # Configuração do Tailwind CSS
```

### Detalhes das Pastas:

*   `api/functions/src`: Contém todo o código TypeScript para as funções serverless (Cloud Functions). Elas lidam com tarefas que precisam ser executadas em um ambiente seguro no servidor, como criação de congregação, exclusão de usuários e gatilhos de banco de dados.

*   `src/app`: Coração da aplicação Next.js.
    *   O roteamento é baseado nos diretórios. Uma pasta dentro de `app` se torna uma nova rota (ex: `/app/dashboard/usuarios` vira a URL `/dashboard/usuarios`).
    *   Arquivos `page.tsx` definem a UI visível para uma rota.
    *   Arquivos `layout.tsx` definem uma UI compartilhada por múltiplas páginas.

*   `src/components`: Contém todos os componentes React reutilizáveis, organizados por funcionalidade (`admin`, `users`) ou de propósito geral (`ui`).

*   `src/contexts`: Provedores de contexto React que disponibilizam estado e lógica global para a aplicação, como as informações do usuário logado.

*   `src/lib`: Arquivos de "biblioteca" para o projeto. O `firebase.ts` é crucial, pois é onde a conexão com o Firebase é configurada para o lado do cliente.

*   `src/types`: Centraliza as interfaces e tipos do TypeScript, garantindo que os dados tenham uma estrutura consistente em todo o aplicativo.
