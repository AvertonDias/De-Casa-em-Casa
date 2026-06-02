"use client";

import { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { db, app, getFirestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader, DatabaseBackup, CheckCircle, AlertTriangle } from 'lucide-react';
import { logEvent } from '@/lib/audit';

export default function RestoreBackupTool() {
  const { user } = useUser();
  const { toast } = useToast();
  const [sourceDbId, setSourceDbId] = useState('');
  const [territoryId, setTerritoryId] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [status, setStatus] = useState<string>('');

  const handleRestore = async () => {
    if (!sourceDbId || !territoryId || !user?.congregationId) {
      toast({ title: "Erro", description: "Preencha o nome do banco e o ID do território.", variant: "destructive" });
      return;
    }

    setIsRestoring(true);
    setStatus('Conectando ao banco de backup...');

    try {
      const sourceDb = getFirestore(app, sourceDbId);
      const targetDb = db;
      const congregationId = user.congregationId;

      // 1. Buscar Território
      const sourceTerrRef = doc(sourceDb, 'congregations', congregationId, 'territories', territoryId);
      const territorySnap = await getDoc(sourceTerrRef);

      if (!territorySnap.exists()) {
        throw new Error("Território não encontrado no banco de backup.");
      }

      const territoryData = territorySnap.data();
      setStatus(`Restaurando território ${territoryData.number}...`);

      // 2. Salvar Território no banco principal
      const targetTerrRef = doc(targetDb, 'congregations', congregationId, 'territories', territoryId);
      await setDoc(targetTerrRef, {
        ...territoryData,
        lastUpdate: serverTimestamp()
      });

      // 3. Restaurar Quadras e Casas
      setStatus('Buscando quadras...');
      const quadrasSnap = await getDocs(collection(sourceTerrRef, 'quadras'));
      
      let housesRestored = 0;
      for (const qDoc of quadrasSnap.docs) {
        setStatus(`Recriando ${qDoc.data().name}...`);
        const qData = qDoc.data();
        const targetQuadraRef = doc(targetTerrRef, 'quadras', qDoc.id);
        await setDoc(targetQuadraRef, qData);

        // Casas da quadra
        const casasSnap = await getDocs(collection(qDoc.ref, 'casas'));
        for (const cDoc of casasSnap.docs) {
          await setDoc(doc(targetQuadraRef, 'casas', cDoc.id), cDoc.data());
          housesRestored++;
        }
      }

      // 4. Restaurar Histórico de Atividade
      setStatus('Trazendo histórico de trabalho...');
      const historySnap = await getDocs(collection(sourceTerrRef, 'activityHistory'));
      for (const hDoc of historySnap.docs) {
        await setDoc(doc(targetTerrRef, 'activityHistory', hDoc.id), hDoc.data());
      }

      // 5. Atualizar estatísticas da congregação
      const congRef = doc(targetDb, 'congregations', congregationId);
      const congSnap = await getDoc(congRef);
      if (congSnap.exists()) {
          const cData = congSnap.data();
          await setDoc(congRef, {
              territoryCount: (cData.territoryCount || 0) + (territoryData.type === 'rural' ? 0 : 1),
              ruralTerritoryCount: (cData.ruralTerritoryCount || 0) + (territoryData.type === 'rural' ? 1 : 0),
              totalHouses: (cData.totalHouses || 0) + (territoryData.stats?.totalHouses || 0),
              totalHousesDone: (cData.totalHousesDone || 0) + (territoryData.stats?.housesDone || 0)
          }, { merge: true });
      }

      logEvent(congregationId, user.uid, user.name, 'BACKUP_RESTORED', `Restaurou o território ${territoryData.number} a partir do banco ${sourceDbId}.`);

      toast({ title: "Sucesso!", description: `Território ${territoryData.number} restaurado com ${housesRestored} casas.` });
      setStatus('Concluído com sucesso!');
      setTerritoryId('');

    } catch (error: any) {
      console.error("Erro na restauração:", error);
      toast({ title: "Falha na Restauração", description: error.message, variant: "destructive" });
      setStatus('Erro: ' + error.message);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="bg-card p-6 rounded-lg shadow-md border border-border/40 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <DatabaseBackup className="text-primary h-6 w-6" />
        <h2 className="text-2xl font-bold">Recuperação de Território</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        Esta ferramenta permite trazer de volta um território que foi apagado, copiando os dados de um banco de backup do seu projeto.
      </p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="sourceDb">ID do Banco de Dados de Origem</Label>
          <Input 
            id="sourceDb" 
            placeholder="Ex: recuperar-terr-4" 
            value={sourceDbId} 
            onChange={e => setSourceDbId(e.target.value)}
            disabled={isRestoring}
          />
          <p className="text-[10px] text-muted-foreground mt-1">Nome do banco de dados no painel do Google Cloud/Firestore.</p>
        </div>

        <div>
          <Label htmlFor="terrId">ID do Documento do Território</Label>
          <Input 
            id="terrId" 
            placeholder="Ex: wMz3CzZeekCzYeFsx5RY" 
            value={territoryId} 
            onChange={e => setTerritoryId(e.target.value)}
            disabled={isRestoring}
          />
          <p className="text-[10px] text-muted-foreground mt-1">O código alfanumérico que identifica o território no banco.</p>
        </div>

        {status && (
          <div className={cn(
            "p-3 rounded-md text-xs flex items-center gap-2",
            status.includes('Erro') ? "bg-red-500/10 text-red-400" : "bg-primary/10 text-primary"
          )}>
            {isRestoring ? <Loader className="animate-spin h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
            {status}
          </div>
        )}

        <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-md mb-4">
            <div className="flex gap-2">
                <AlertTriangle className="text-yellow-500 h-4 w-4 shrink-0" />
                <p className="text-[11px] text-yellow-600 dark:text-yellow-400 leading-tight">
                    <b>Atenção:</b> Esta ação criará um novo documento. Se o território já existir com o mesmo ID, ele será sobrescrito.
                </p>
            </div>
        </div>

        <Button 
          onClick={handleRestore} 
          disabled={isRestoring || !sourceDbId || !territoryId}
          className="w-full font-bold"
        >
          {isRestoring ? "Restaurando..." : "Iniciar Recuperação"}
        </Button>
      </div>
    </div>
  );
}
