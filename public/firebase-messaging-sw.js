// Importações necessárias para o Service Worker do Firebase
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// Config do Firebase Client (pública, pode ficar no client)
const firebaseConfig = {
  apiKey: "SEU_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID",
};

// Inicializa o app Firebase no Service Worker
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Manipula notificações recebidas em segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log("Mensagem recebida em segundo plano: ", payload);

  const notificationTitle = payload.notification?.title || "Nova notificação";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/icon-192x192.png",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
