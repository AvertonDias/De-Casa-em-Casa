import { NextRequest, NextResponse } from 'next/server';
import { initializeAdmin } from '@/lib/firebaseAdmin';
import { isTerritoryOverdue } from '@/lib/utils';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

// Confere um segredo compartilhado antes de rodar a varredura completa do
// banco. Sem isso, qualquer pessoa na internet podia chamar essa rota
// repetidamente e forçar uma varredura pesada em todas as congregações
// (custo de leitura no Firestore + risco de abuso).
//
// Configure a env var CRON_SECRET no ambiente de produção (Vercel: Project
// Settings > Environment Variables) e, se estiver usando Vercel Cron,
// adicione o mesmo valor como "Authorization: Bearer <CRON_SECRET>" na
// configuração do cron job (a Vercel já envia esse header automaticamente
// para crons definidos em vercel.json quando CRON_SECRET está configurado).
function isAuthorizedCronRequest(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Sem CRON_SECRET configurado, recusamos por padrão (fail closed) em
    // vez de deixar a rota aberta silenciosamente.
    console.error('[Cron Overdue] CRON_SECRET não configurado no ambiente.');
    return false;
  }
  const authHeader = req.headers.get('authorization') || '';
  return authHeader === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
  }
  return handleCheckOverdue();
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
  }
  return handleCheckOverdue();
}

async function handleCheckOverdue() {
  try {
    const { admin, error: initError } = await initializeAdmin();
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: 'Firebase Admin não inicializado',
        details: initError?.message
      }, { status: 500 });
    }

    const db = admin.firestore();
    const messaging = admin.messaging();

    const congregationsSnap = await db.collection('congregations').get();
    let checkedCount = 0;
    let overdueCount = 0;
    let pushSentCount = 0;

    for (const congDoc of congregationsSnap.docs) {
      const congId = congDoc.id;
      const territoriesSnap = await db
        .collection(`congregations/${congId}/territories`)
        .where('status', '==', 'designado')
        .get();

      for (const terrDoc of territoriesSnap.docs) {
        checkedCount++;
        const t = terrDoc.data();
        const territoryId = terrDoc.id;
        const assignment = t.assignment;

        if (!assignment || !assignment.uid || !assignment.dueDate) continue;

        const assignedUserId: string = assignment.uid;
        if (assignedUserId.startsWith('custom_')) continue;

        let dueDateObj: Date | null = null;
        if (assignment.dueDate.toDate && typeof assignment.dueDate.toDate === 'function') {
          dueDateObj = assignment.dueDate.toDate();
        } else if (assignment.dueDate._seconds) {
          dueDateObj = new Date(assignment.dueDate._seconds * 1000);
        } else if (typeof assignment.dueDate === 'string' || typeof assignment.dueDate === 'number') {
          dueDateObj = new Date(assignment.dueDate);
        }

        if (!dueDateObj || isNaN(dueDateObj.getTime())) continue;

        const isOverdue = isTerritoryOverdue(dueDateObj);
        if (!isOverdue) continue;

        overdueCount++;

        const notifId = `overdue_${territoryId}`;
        const notifRef = db.doc(`users/${assignedUserId}/notifications/${notifId}`);
        const notifSnap = await notifRef.get();

        if (notifSnap.exists()) {
          // Já foi notificado
          continue;
        }

        const dateFormatted = format(dueDateObj, 'dd/MM/yyyy');
        const notifTitle = "Território Atrasado! ⏰";
        const notifBody = `O prazo de devolução do território "${t.number} - ${t.name}" venceu em ${dateFormatted}. Por favor, faça a devolução.`;
        const notifLink = `/dashboard/meus-territorios`;

        // 1. Salvar no Firestore
        await notifRef.set({
          title: notifTitle,
          body: notifBody,
          link: notifLink,
          type: 'territory_overdue',
          isRead: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 2. Buscar tokens FCM do usuário
        const userDoc = await db.doc(`users/${assignedUserId}`).get();
        if (!userDoc.exists) continue;

        const userData = userDoc.data();
        const tokensSet = new Set<string>();

        if (userData?.fcmToken && typeof userData.fcmToken === 'string') {
          tokensSet.add(userData.fcmToken);
        }
        if (Array.isArray(userData?.fcmTokens)) {
          userData.fcmTokens.forEach((tk: string) => {
            if (tk && typeof tk === 'string' && tk.trim().length > 0) {
              tokensSet.add(tk.trim());
            }
          });
        }

        const tokens = Array.from(tokensSet);
        if (tokens.length === 0) continue;

        // 3. Disparar notificações push
        const pushPromises = tokens.map((token) => {
          const payload = {
            token: token,
            notification: {
              title: notifTitle,
              body: notifBody,
            },
            data: {
              title: notifTitle,
              body: notifBody,
              link: notifLink,
              click_action: notifLink,
              icon: '/images/Logo_v3.png'
            },
            webpush: {
              headers: { Urgency: 'high' },
              notification: {
                title: notifTitle,
                body: notifBody,
                icon: '/images/Logo_v3.png',
                badge: '/images/De casa em casa pb.png',
                tag: notifId,
                renotify: true,
                requireInteraction: true
              },
              fcmOptions: { link: notifLink }
            },
            android: {
              priority: 'high' as const,
              notification: {
                title: notifTitle,
                body: notifBody,
                icon: 'ic_launcher',
                color: '#d97706',
                clickAction: notifLink
              }
            }
          };

          return messaging.send(payload).catch((err: any) => {
            console.warn(`[Cron Overdue] Falha ao enviar para token ${token}:`, err?.message);
          });
        });

        await Promise.allSettled(pushPromises);
        pushSentCount++;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      checkedCount,
      overdueCount,
      pushSentCount
    });

  } catch (error: any) {
    console.error('[Cron Overdue] Erro ao verificar territórios atrasados:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro interno' }, { status: 500 });
  }
}