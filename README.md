
# De Casa em Casa: A Revolução Digital no Gerenciamento de Territórios

![Logo do App](public/images/icon-512x512.jpg)

**De Casa em Casa** é um sistema web completo e moderno, construído como um Progressive Web App (PWA), para revolucionar a forma como as congregações organizam e trabalham seus territórios. Diga adeus aos mapas de papel, às fichas frágeis e à incerteza. Diga olá à eficiência, colaboração em tempo real e segurança.

---

## ✨ Funcionalidades que Transformam o Trabalho

O "De Casa em Casa" foi projetado do zero para ser poderoso, mas incrivelmente simples de usar.

*   **Autenticação Segura e Níveis de Acesso:**
    *   Sistema de login com E-mail/Senha e fluxo de recuperação de senha.
    *   Perfis de usuário (Administrador, Dirigente, Servo de Territórios, Publicador) que adaptam a interface e as permissões, garantindo que cada um veja apenas o que precisa.

*   **Gerenciamento Completo de Territórios (Urbanos e Rurais):**
    *   **Territórios Urbanos:** Crie territórios, adicione quadras e mapeie cada casa. Publicadores podem marcar casas como "feitas" com um único clique, e o progresso é atualizado para todos instantaneamente.
    *   **Territórios Rurais:** Um diário de bordo digital. Em vez de casas, cada trabalho é registrado com data e observações, criando um histórico claro e colaborativo.
    *   **Reordenação Inteligente:** Arraste e solte as casas para organizar a sequência de trabalho na ordem exata do seu percurso na rua.

*   **Painel de Controle (Dashboard) Centralizado:**
    *   **Visão do Dirigente/Admin:** Tenha uma visão geral completa com estatísticas em tempo real: territórios designados, progresso geral, casas trabalhadas e muito mais.
    *   **Visão do Publicador:** Uma interface limpa e focada no que importa: trabalhar seus territórios designados sem distrações.

*   **Designação e Histórico:**
    *   Atribua territórios a publicadores ou grupos com datas de início e devolução.
    *   O sistema mantém um histórico completo de quem trabalhou em cada território e quando, facilitando a geração de relatórios como o S-13.

*   **Progressive Web App (PWA) de Ponta:**
    *   **Instalável:** Adicione o "De Casa em Casa" à tela inicial do seu celular ou computador para acesso rápido, como um aplicativo nativo.
    *   **Funcionalidade Offline:** Continue trabalhando nos seus territórios mesmo sem conexão com a internet. As atualizações são sincronizadas assim que a conexão for restaurada.

*   **Interface Moderna e Intuitiva:**
    *   **Tema Claro e Escuro:** Adapte a aparência para o seu conforto visual.
    *   **Design Responsivo:** Perfeito para usar no celular durante o campo, no tablet em casa ou no computador.

---

## 🚀 Tecnologias Utilizadas

*   **Frontend:** [Next.js](https://nextjs.org/) (com App Router) e [React](https://react.dev/)
*   **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
*   **Backend & Banco de Dados:** [Firebase](https://firebase.google.com/)
    *   **Authentication:** Para gerenciamento seguro de usuários.
    *   **Firestore:** Banco de dados NoSQL em tempo real para sincronização instantânea.
    *   **Cloud Functions:** Para automações e lógicas complexas no backend.
    *   **Storage:** Para armazenamento de imagens dos cartões de território.
*   **Estilização:** [Tailwind CSS](https://tailwindcss.com/) & [ShadCN UI](https://ui.shadcn.com/)

---

## 🛠️ Como Usar (Para Desenvolvedores)

Siga os passos abaixo para configurar e rodar o projeto em um ambiente de desenvolvimento local.

### Pré-requisitos

*   [Node.js](https://nodejs.org/) (versão 20 ou superior)
*   Uma conta no [Firebase](https://firebase.google.com/)
*   [Firebase CLI](https://firebase.google.com/docs/cli) instalado e logado.

### Instalação

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/AvertonDias/De-Casa-em-Casa.git
    cd De-Casa-em-Casa
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```
    (O projeto usa um monorepo para as `functions`, as dependências são instaladas em um único passo).

3.  **Configure suas Chaves do Firebase:**
    *   Crie um arquivo na raiz do projeto chamado `.env.local`.
    *   No seu projeto Firebase, vá para "Configurações do Projeto", crie um App da Web e copie as credenciais para o arquivo `.env.local`:
      ```env
      NEXT_PUBLIC_FIREBASE_API_KEY="SUA_API_KEY"
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="SEU_AUTH_DOMAIN"
      NEXT_PUBLIC_FIREBASE_PROJECT_ID="SEU_PROJECT_ID"
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="SEU_STORAGE_BUCKET"
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="SEU_MESSAGING_SENDER_ID"
      NEXT_PUBLIC_FIREBASE_APP_ID="SEU_APP_ID"
      ```

### Rodando o Aplicativo

1.  **Servidor de Desenvolvimento (Next.js):**
    ```bash
    npm run dev
    ```
    Abra [http://localhost:3000](http://localhost:3000).

2.  **Emuladores do Firebase (Recomendado):**
    Para testar as funções de backend e regras de segurança localmente.
    ```bash
    firebase emulators:start
    ```

---

## ☁️ Deploy

O projeto está configurado para deploy integrado com o Firebase Hosting.

```bash
# Faz o deploy do site e das Cloud Functions
firebase deploy
```
