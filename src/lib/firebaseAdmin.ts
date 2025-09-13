"use server";

import * as admin from "firebase-admin";

if (!admin.apps.length) {
  const credentialsBase64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credentialsBase64) {
    throw new Error("A variável GOOGLE_APPLICATION_CREDENTIALS_JSON não está definida.");
  }

  const credentialsJSON = Buffer.from(credentialsBase64, "base64").toString("utf8");

  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(credentialsJSON)),
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export const adminMessaging = admin.messaging();
