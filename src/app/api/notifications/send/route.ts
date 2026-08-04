import { NextRequest, NextResponse } from 'next/server';
import { initializeAdmin } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  let step = 'init';
  const diagnostics: Record<string, any> = {
    env: {
      has_credentials_json: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      credentials_json_length: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.length || 0,
      credentials_starts_with_brace: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim()?.startsWith('{') || false,
      has_vapid_key: !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      vapid_key_length: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.length || 0,
      has_database_url: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    }
  };

  try {
    step = 'parsing_request_body';
    let reqBody;
    try {
      reqBody = await req.json();
    } catch (parseErr: any) {
      console.error('[Push API] Falha ao analisar o corpo do request JSON:', parseErr);
      return NextResponse.json({ 
        error: 'JSON inválido ou corpo vazio no request', 
        details: parseErr?.message,
        step,
        diagnostics 
      }, { status: 400 });
    }

    const { userId, userIds, title, message, body: messageBody, link, type, notifId } = reqBody;

    diagnostics.request = {
      has_userId: !!userId,
      has_userIds: !!userIds,
      userIds_count: Array.isArray(userIds) ? userIds.length : 0,
      title_length: title?.length || 0,
      has_message: !!message,
      has_messageBody: !!messageBody,
      link,
      type,
      notifId
    };

    const contentBody = message || messageBody || '';
    const targetLink = link || '/dashboard/notificacoes';

    const targets: string[] = userIds || (userId ? [userId] : []);

    if (targets.length === 0 || !title) {
      return NextResponse.json({ 
        error: 'userId/userIds e title são obrigatórios', 
        step,
        diagnostics 
      }, { status: 400 });
    }

    step = 'initializing_firebase_admin';
    const admin = await initializeAdmin();
    if (!admin) {
      console.warn('[Push API] Firebase Admin não pôde ser inicializado.');
      return NextResponse.json({ 
        success: false, 
        warning: 'Admin SDK não inicializado (verifique as credenciais no painel da Vercel)',
        step,
        diagnostics
      }, { status: 500 });
    }

    step = 'acquiring_firestore_and_messaging_instances';
    let db;
    let messaging;
    try {
      db = admin.firestore();
      messaging = admin.messaging();
    } catch (sdkErr: any) {
      console.error('[Push API] Falha ao adquirir instâncias do Firestore ou Messaging:', sdkErr);
      return NextResponse.json({
        error: 'Falha ao acessar os serviços do Firebase Admin SDK',
        details: sdkErr?.message,
        stack: sdkErr?.stack,
        step,
        diagnostics
      }, { status: 500 });
    }

    const results = [];

    step = 'iterating_target_users';
    for (const targetUserId of targets) {
      try {
        // 1. Salvar notificação no Firestore
        const notifData = {
          title,
          body: contentBody,
          message: contentBody,
          link: targetLink,
          type: type || 'general',
          isRead: false,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (notifId) {
          await db.doc(`users/${targetUserId}/notifications/${notifId}`).set(notifData, { merge: true });
        } else {
          await db.collection(`users/${targetUserId}/notifications`).add(notifData);
        }

        // 2. Buscar tokens FCM do usuário destinatário
        const userDoc = await db.doc(`users/${targetUserId}`).get();
        const userData = userDoc.data();
        
        const tokensSet = new Set<string>();
        if (userData?.fcmToken && typeof userData.fcmToken === 'string') {
          tokensSet.add(userData.fcmToken);
        }
        if (Array.isArray(userData?.fcmTokens)) {
          userData.fcmTokens.forEach((t: string) => {
            if (t && typeof t === 'string' && t.trim().length > 0) {
              tokensSet.add(t.trim());
            }
          });
        }

        const tokens = Array.from(tokensSet);

        if (tokens.length === 0) {
          results.push({ userId: targetUserId, deliveredPush: false, reason: 'Nenhum token FCM registrado' });
          continue;
        }

        // 3. Disparar notificação push via FCM para todos os tokens
        const pushPromises = tokens.map(async (token) => {
          const payload = {
            token: token,
            notification: {
              title: title,
              body: contentBody,
            },
            data: {
              title: title,
              body: contentBody,
              link: targetLink,
              click_action: targetLink,
              icon: '/images/Logo_v3.png'
            },
            webpush: {
              headers: {
                Urgency: 'high'
              },
              notification: {
                title: title,
                body: contentBody,
                icon: '/images/Logo_v3.png',
                badge: '/images/De casa em casa pb.png',
                tag: 'de-casa-em-casa-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
                renotify: true,
                requireInteraction: true
              },
              fcmOptions: {
                link: targetLink
              }
            },
            android: {
              priority: 'high' as const,
              notification: {
                title: title,
                body: contentBody,
                icon: 'ic_launcher',
                color: '#0d9488',
                clickAction: targetLink
              }
            }
          };

          return messaging.send(payload);
        });

        const fcmResponses = await Promise.allSettled(pushPromises);
        const deliveredCount = fcmResponses.filter(r => r.status === 'fulfilled').length;
        console.log(`[Push API] Push enviado para ${targetUserId} (${deliveredCount}/${tokens.length} entregues)`);
        results.push({ userId: targetUserId, deliveredPush: deliveredCount > 0, deliveredCount, totalTokens: tokens.length });

      } catch (userErr: any) {
        console.warn(`[Push API] Erro ao processar para o usuário ${targetUserId}:`, userErr?.message || userErr);
        results.push({ userId: targetUserId, deliveredPush: false, error: userErr?.message || 'Erro interno no processamento do usuário' });
      }
    }

    return NextResponse.json({ success: true, results, diagnostics });

  } catch (error: any) {
    console.error('[Push API] Erro fatal geral no endpoint:', error);
    return NextResponse.json({ 
      error: error?.message || 'Erro interno no servidor', 
      stack: error?.stack,
      step,
      diagnostics 
    }, { status: 500 });
  }
}
