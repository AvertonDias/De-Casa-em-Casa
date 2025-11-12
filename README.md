
#  De Casa em Casa - Gerenciador de Territórios

![Logo do App](/images/icon-512x512.jpg)

Um painel de controle web completo, construído como um Progressive Web App (PWA) com **Next.js**, **TypeScript** e **Firebase**. O objetivo do "De Casa em Casa" é permitir o gerenciamento moderno, eficiente e seguro dos territórios de congregações.

---

## ✨ Funcionalidades Principais

*   **Autenticação Completa:** Sistema de login com E-mail/Senha e fluxo de recuperação de senha.
*   **Perfis de Usuário:** Níveis de permissão granulares (Administrador, Dirigente, Publicador) que adaptam a interface e as funcionalidades.
*   **Gerenciamento de Territórios:**
    *   CRUD (Criar, Ler, Atualizar, Deletar) completo para territórios urbanos e rurais.
    *   CRUD para quadras dentro dos territórios.
    *   CRUD para casas dentro das quadras.
*   **Progressive Web App (PWA):** O aplicativo é instalável em dispositivos móveis e desktops, com capacidades offline básicas.
*   **Lógica de Backend com Cloud Functions:**
    *   Cálculo automático de estatísticas (casas feitas, progresso, etc.).
    *   Notificações para administradores sobre novos usuários.
    *   Backups diários e automáticos do banco de dados.
*   **Interface Moderna:**
    *   Tema Claro/Escuro.
    *   Design responsivo para todas as telas.
    *   Componentes reutilizáveis e interface intuitiva.
*   **Upload de Imagens:** Funcionalidade de upload direto para o Firebase Storage para os cartões dos territórios.

---

## 🚀 Tecnologias Utilizadas

*   **Frontend:** [Next.js](https://nextjs.org/) (com App Router) e [React](https://react.dev/)
*   **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
*   **Backend & Banco de Dados:** [Firebase](https://firebase.google.com/)
    *   **Authentication:** Para gerenciamento de usuários.
    *   **Firestore:** Como banco de dados NoSQL em tempo real.
    *   **Cloud Functions:** Para automações e lógica de servidor.
    *   **Storage:** Para armazenamento de arquivos (imagens dos cartões).
*   **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
*   **PWA:** [@ducanh2912/next-pwa](https://www.npmjs.com/package/@ducanh2912/next-pwa)

---

## 🛠️ Configuração do Ambiente de Desenvolvimento

Siga os passos abaixo para rodar o projeto localmente.

### Pré-requisitos

*   [Node.js](https://nodejs.org/) (versão 18 ou superior)
*   Uma conta do [Firebase](https://firebase.google.com/)
*   [Firebase CLI](https://firebase.google.com/docs/cli) instalado e logado (`npm install -g firebase-tools`, `firebase login`)

### Instalação

1.  **Clone o repositório:**
    ```bash
    git clone [URL_DO_SEU_REPOSITORIO]
    cd [NOME_DA_PASTA]
    ```

2.  **Instale as dependências do Frontend:**
    ```bash
    npm install
    ```

3.  **Instale as dependências do Backend:**
    ```bash
    cd functions
    npm install
    cd ..
    ```

4.  **Configure suas Chaves do Firebase:**
    *   Crie um arquivo na raiz do projeto chamado `.env.local`.
    *   Acesse as "Configurações do Projeto" no seu painel do Firebase, encontre as configurações do seu App da Web e preencha o arquivo com suas chaves:
      ```env
      NEXT_PUBLIC_FIREBASE_API_KEY="SUA_API_KEY"
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="SEU_AUTH_DOMAIN"
      NEXT_PUBLIC_FIREBASE_PROJECT_ID="SEU_PROJECT_ID"
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="SEU_STORAGE_BUCKET"
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="SEU_MESSAGING_SENDER_ID"
      NEXT_PUBLIC_FIREBASE_APP_ID="SEU_APP_ID"
      ```

---

## 🔥 Rodando o Aplicativo

1.  **Para rodar o servidor de desenvolvimento do Next.js:**
    ```bash
    npm run dev
    ```
    Abra [http://localhost:3000](http://localhost:3000) no seu navegador para ver o resultado.

2.  **Para rodar o emulador local do Firebase (opcional, mas recomendado):**
    ```bash
    firebase emulators:start
    ```

---

## ☁️ Deploy

Para fazer o deploy das diferentes partes do projeto para o Firebase Hosting e Functions:

*   **Fazer o deploy de TUDO:**
    ```bash
    firebase deploy
    ```

*   **Fazer o deploy apenas do site (Hosting):**
    ```bash
    firebase deploy --only hosting
    ```

*   **Fazer o deploy apenas das Cloud Functions:**
    ```bash
    firebase deploy --only functions
    ```

*   **Fazer o deploy apenas das Regras de Segurança (Firestore & Storage):**
    ```bash
    firebase deploy --only firestore,storage
    ```

---

## 📂 Estrutura do Projeto

A estrutura de arquivos principal foi organizada da seguinte forma:

/
├── functions/ # Projeto de Cloud Functions
│ ├── src/index.ts
│ └── package.json
├── public/ # Arquivos estáticos e PWA
│ ├── manifest.json
│ └── ...
└── src/ # Projeto Next.js
├── app/ # App Router do Next.js
├── components/ # Componentes React reutilizáveis
├── contexts/ # Contextos React (UserContext)
├── lib/ # Configuração do Firebase
└── types/ # Definições de tipos (TypeScript)
