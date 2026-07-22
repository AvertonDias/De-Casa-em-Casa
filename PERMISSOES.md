# Guia de Permissões de Usuário

Este documento detalha o que cada tipo de usuário (perfil) pode fazer dentro do aplicativo "De Casa em Casa". As permissões são projetadas para garantir segurança, organização e delegação de tarefas.

## Perfis de Usuário

*   **Publicador:** O perfil básico. Pode trabalhar nos territórios que lhe são designados.
*   **Ajudante de Servo de Territórios:** Um auxiliar com permissões de visualização estendidas e gerenciamento básico de territórios.
*   **Servo de Territórios:** Responsável principal pela gestão e designação de todos os territórios.
*   **Dirigente:** Tem permissões de gerenciamento de usuários (aprovar novos membros) e também todas as permissões de um Servo de Territórios.
*   **Administrador:** O superusuário. Tem controle total sobre todos os aspectos do sistema, incluindo configurações da congregação e exclusão de usuários e territórios.

---

## Tabela de Permissões

| Funcionalidade / Página | Publicador | Ajudante de Servo | Servo de Territórios | Dirigente | Administrador |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **GERAL** | | | | | |
| Ver Dashboard (Início) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver seus próprios territórios | ✅ | ✅ | ✅ | ✅ | ✅ |
| Trabalhar em territórios (marcar casas, registrar trabalho rural) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Devolver seus territórios | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editar seu próprio perfil (nome, WhatsApp) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Redefinir a própria senha | ✅ | ✅ | ✅ | ✅ | ✅ |
| Excluir a própria conta | ✅ | ✅ | ✅ | ✅ | ✅ |
| | | | | | |
| **USUÁRIOS (`/usuarios`)** | | | | | |
| Ver a lista de todos os usuários | ❌ | ❌ | ✅ | ✅ | ✅ |
| Ver status (Online/Offline) de outros | ❌ | ❌ | ✅ | ✅ | ✅ |
| Aprovar ou Rejeitar novos usuários | ❌ | ❌ | ✅ | ✅ | ✅ |
| Editar o **perfil** de outros usuários (ex: Publicador para Dirigente) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Editar o **status** de outros usuários (ex: ativo para bloqueado) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Excluir a conta de outro usuário | ❌ | ❌ | ❌ | ❌ | ✅ |
| | | | | | |
| **TERRITÓRIOS (GERAL)** | | | | | |
| Ver a lista de **todos** os territórios (urbanos e rurais) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Criar um novo território | ❌ | ❌ | ❌ | ❌ | ✅ |
| Editar dados de um território (nome, mapa, cartão) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Excluir um território permanentemente | ❌ | ❌ | ❌ | ❌ | ✅ |
| Limpar o progresso de um território (resetar) | ❌ | ❌ | ✅ | ❌ | ✅ |
| Adicionar/Editar/Excluir quadras e casas | ✅️ | ✅️ | ✅ | ✅ | ✅ |
| | | | | | |
| **ADMINISTRAÇÃO (`/administracao`)** | | | | | |
| Acessar a página de Administração | ❌ | ✅ | ✅ | ✅ | ✅ |
| Designar territórios para publicadores | ❌ | ✅ | ✅ | ✅ | ✅ |
| Devolver territórios em nome de outros | ❌ | ✅ | ✅ | ✅ | ✅ |
| Ver relatórios (Cobertura, Disponíveis, S-13) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Editar configurações da congregação | ❌ | ❌ | ❌ | ❌ | ✅ |
| Editar histórico de designação | ❌ | ❌ | ❌ | ❌ | ✅ |

---

### Observações Adicionais:

*   **Ajudante de Servo de Territórios:** Embora não possa designar territórios, este perfil pode visualizar todos os relatórios e o painel de administração, sendo ideal para quem precisa acompanhar o andamento dos trabalhos sem ter permissões de escrita.
*   **Dirigente vs. Administrador:** A principal diferença é que o Dirigente pode gerenciar o fluxo de pessoas (aprovar/rejeitar), mas não pode fazer alterações estruturais ou destrutivas, como excluir territórios ou usuários, nem alterar as configurações globais da congregação. Essas ações são exclusivas do Administrador.

---
