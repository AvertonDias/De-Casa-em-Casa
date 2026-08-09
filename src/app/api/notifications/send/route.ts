import { NextRequest, NextResponse } from 'next/server';
import { initializeAdmin } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    // 1. Exigir e validar um token de ID do Firebase Auth no header
    //    Authorization. Sem isso, qualquer pessoa na internet conseguia
    //    disparar push notifications e gravar documentos de notificação
    //    para qualquer userId — essa era a falha crítica original.
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    const { admin, error: initError } = await initializeAdmin();
    if (!admin) {
      console.error('[Push API] Firebase Admin não inicializado:', initError?.message);
      return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
    }

    let callerUid: string;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      callerUid = decoded.uid;
    } catch (tokenErr) {
      return NextResponse.json({ error: 'Token inválido ou expirado.' }, { status: 401 });
    }

    const db = admin.firestore();
    const messaging = admin.messaging();

    // 2. Carregar o perfil de quem está chamando, para restringir o envio
    //    apenas a usuários da mesma congregação (evita que um usuário mande
    //    notificações para pessoas de fora da sua congregação).
    const callerDoc = await db.doc(`users/${callerUid}`).get();
    if (!callerDoc.exists) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 403 });
    }
    const callerData = callerDoc.data();
    const callerCongregationId: string | undefined = callerData?.congregationId;
    if (callerData?.status !== 'ativo' || !callerCongregationId) {
      return NextResponse.json({ error: 'Usuário sem permissão para enviar notificações.' }, { status: 403 });
    }

    let reqBody: any;
    try {
      reqBody = await req.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido ou corpo vazio no request.' }, { status: 400 });
    }

    const { userId, userIds, title, message, body: messageBody, link, type, notifId } = reqBody;
    const contentBody = message || messageBody || '';
    const targetLink = link || '/dashboard/notificacoes';
    const requestedTargets: string[] = userIds || (userId ? [userId] : []);

    if (requestedTargets.length === 0 || !title) {
      return NextResponse.json({ error: 'userId/userIds e title são obrigatórios.' }, { status: 400 });
    }

    const results: any[] = [];

    for (const targetUserId of requestedTargets) {
      try {
        // 3. Confirmar que o alvo pertence à mesma congregação de quem envia,
        //    antes de gravar qualquer coisa no documento dele.
        const targetDoc = await db.doc(`users/${targetUserId}`).get();
        if (!targetDoc.exists) {
          results.push({ userId: targetUserId, deliveredPush: false, reason: 'Usuário alvo não encontrado' });
          continue;
        }
        const targetData = targetDoc.data();
        if (targetData?.congregationId !== callerCongregationId) {
          results.push({ userId: targetUserId, deliveredPush: false, reason: 'Fora da sua congregação' });
          continue;
        }

        const notifData = {
          title,
          body: contentBody,
          message: contentBody,
          link: targetLink,
          type: type || 'general',
          isRead: false,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (notifId) {
          await db.doc(`users/${targetUserId}/notifications/${notifId}`).set(notifData, { merge: true });
        } else {
          await db.collection(`users/${targetUserId}/notifications`).add(notifData);
        }

        const tokensSet = new Set<string>();
        if (targetData?.fcmToken && typeof targetData.fcmToken === 'string') {
          tokensSet.add(targetData.fcmToken);
        }
        if (Array.isArray(targetData?.fcmTokens)) {
          targetData.fcmTokens.forEach((t: string) => {
            if (t && typeof t === 'string' && t.trim().length > 0) tokensSet.add(t.trim());
          });
        }

        const tokens = Array.from(tokensSet);
        if (tokens.length === 0) {
          results.push({ userId: targetUserId, deliveredPush: false, reason: 'Nenhum token FCM registrado' });
          continue;
        }

        const pushPromises = tokens.map((token) =>
          messaging.send({
            token,
            notification: { title, body: contentBody },
            data: {
              title,
              body: contentBody,
              link: targetLink,
              click_action: targetLink,
              icon: '/images/Logo_v3.png',
            },
            webpush: {
              headers: { Urgency: 'high' },
              notification: {
                title,
                body: contentBody,
                icon: '/images/Logo_v3.png',
                badge: '/images/De casa em casa pb.png',
                tag: 'de-casa-em-casa-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
                renotify: true,
                requireInteraction: true,
              },
              fcmOptions: { link: targetLink },
            },
            android: {
              priority: 'high' as const,
              notification: {
                title,
                body: contentBody,
                icon: 'ic_launcher',
                color: '#0d9488',
                clickAction: targetLink,
              },
            },
          })
        );

        const fcmResponses = await Promise.allSettled(pushPromises);
        const deliveredCount = fcmResponses.filter((r) => r.status === 'fulfilled').length;
        results.push({ userId: targetUserId, deliveredPush: deliveredCount > 0, deliveredCount, totalTokens: tokens.length });
      } catch (userErr: any) {
        console.warn(`[Push API] Erro ao processar para o usuário ${targetUserId}:`, userErr?.message || userErr);
        results.push({ userId: targetUserId, deliveredPush: false, error: 'Erro interno no processamento do usuário' });
      }
    }

    // Nota: os detalhes de diagnóstico (env vars configuradas, tamanhos de
    // chave, stack traces) que existiam aqui antes foram removidos da
    // resposta pública — eles ajudavam um atacante a mapear a configuração
    // do servidor. Use `console.error`/`console.warn` (acima) para depurar
    // via logs do servidor, nunca devolvendo isso no JSON de resposta.
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('[Push API] Erro fatal geral no endpoint:', error);
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}