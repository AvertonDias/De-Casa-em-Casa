import { NextRequest, NextResponse } from 'next/server';
import { initializeAdmin } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const reqBody = await req.json();
    const { userId, userIds, title, message, body: messageBody, link, type, notifId } = reqBody;

    const contentBody = message || messageBody || '';
    const targetLink = link || '/dashboard/notificacoes';

    const targets: string[] = userIds || (userId ? [userId] : []);

    if (targets.length === 0 || !title) {
      return NextResponse.json({ error: 'userId/userIds e title são obrigatórios' }, { status: 400 });
    }

    const admin = await initializeAdmin();
    if (!admin) {
      console.warn('[Push API] Firebase Admin não inicializado.');
      return NextResponse.json({ success: false, warning: 'Admin SDK não inicializado' });
    }

    const db = admin.firestore();
    const messaging = admin.messaging();

    const results = [];

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

        // 2. Buscar tokens FCM do usuário destinatário (suporta único ou múltiplos dispositivos)
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

        // 3. Disparar notificação push via FCM para todos os tokens cadastrados do usuário
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
        console.warn(`[Push API] Erro ao enviar para o usuário ${targetUserId}:`, userErr?.message || userErr);
        results.push({ userId: targetUserId, deliveredPush: false, error: userErr?.message });
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (error: any) {
    console.error('[Push API] Erro geral:', error);
    return NextResponse.json({ error: error?.message || 'Erro no servidor' }, { status: 500 });
  }
}
