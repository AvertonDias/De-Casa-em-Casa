// Importações necessárias para o Service Worker do Firebase
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// IMPORTANTE: Substitua os valores abaixo pelas credenciais do seu projeto Firebase.
// Você pode encontrar esses valores nas configurações do seu projeto no console do Firebase.
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializa o app Firebase no Service Worker
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Opcional: manipular notificações recebidas com o app em segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log("Notificação recebida em segundo plano: ", payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png' // Ícone que aparece na notificação
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
