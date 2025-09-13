"use server";

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";

if (!getApps().length) {
  const credentialsBase64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (!credentialsBase64) {
    throw new Error("❌ Variável GOOGLE_APPLICATION_CREDENTIALS_JSON não configurada no ambiente.");
  }

  const credentials = JSON.parse(
    Buffer.from(credentialsBase64, "base64").toString("utf-8")
  );

  initializeApp({
    credential: cert(credentials),
  });
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
export const adminMessaging = getMessaging();
