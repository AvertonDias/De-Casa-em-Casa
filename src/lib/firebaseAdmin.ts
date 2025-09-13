// src/lib/firebaseAdmin.ts
import * as admin from "firebase-admin";

// Apenas exporta a referência do admin. A inicialização será feita
// sob demanda dentro de cada API route para garantir que as variáveis
// de ambiente estejam disponíveis no contexto do servidor.
export default admin;
