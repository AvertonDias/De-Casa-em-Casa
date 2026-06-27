
"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, Loader, Calendar } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, writeBatch, serverTimestamp, Timestamp, collection, getDocs, query, where, arrayUnion } from 'firebase/firestore';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { logEvent } from '@/lib/audit';

interface CampaignActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CampaignActivationModal({ isOpen, onClose }: CampaignActivationModalProps) {
  const { user, congregation } = useUser();
  const { toast } = useToast();
  const [step, setStage] = useState<'type' | 'return'>('type');
  const [isEndingWithReturn, setIsEndingWithReturn] = useState(false);
  const [type, setType] = useState<'congress' | 'memorial' | 'other'>('congress');
  const [customTitle, setCustomTitle] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartCampaign = async () => {
    if (!user?.congregationId) return;
    setIsLoading(true);

    try {
      const congregationId = user.congregationId;
      const batch = writeBatch(db);
      const title = type === 'congress' ? 'Convites do Congresso' : type === 'memorial' ? 'Convites da Celebração' : customTitle;

      // 1. Atualizar Congregação
      const congRef = doc(db, 'congregations', congregationId);
      batch.update(congRef, {
        activeCampaign: {
          title,
          type,
          activatedAt: serverTimestamp()
        }
      });

      // 2. Devolver todos os territórios designados
      const territoriesRef = collection(db, 'congregations', congregationId, 'territories');
      const q = query(territoriesRef, where('status', '==', 'designado'));
      const snapshot = await getDocs(q);

      const returnTimestamp = Timestamp.fromDate(new Date(returnDate + 'T12:00:00'));

      snapshot.docs.forEach(tDoc => {
        const tData = tDoc.data();
        if (tData.assignment) {
          const historyLog = {
            uid: tData.assignment.uid,
            name: tData.assignment.name,
            assignedAt: tData.assignment.assignedAt,
            completedAt: returnTimestamp,
            isCompletion: true,
            campaignName: tData.assignment.campaignName
          };
          batch.update(tDoc.ref, {
            status: 'disponivel',
            assignment: null,
            assignmentHistory: arrayUnion(historyLog)
          });
        }
      });

      await batch.commit();

      logEvent(
        congregationId,
        user.uid,
        user.name,
        'CAMPAIGN_STARTED',
        `Iniciou a campanha "${title}" e devolveu ${snapshot.size} territórios.`
      );

      toast({ title: "Campanha Ativada!", description: "Todos os territórios foram devolvidos e o modo de campanha está ativo." });
      handleClose();
    } catch (error: any) {
      console.error("Erro ao ativar campanha:", error);
      toast({ title: "Erro", description: "Falha ao ativar campanha.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopCampaign = async () => {
    if (!user?.congregationId) return;
    setIsLoading(true);
    try {
      const congregationId = user.congregationId;
      const batch = writeBatch(db);

      // 1. Encerrar Campanha na Congregação
      const congRef = doc(db, 'congregations', congregationId);
      batch.update(congRef, { activeCampaign: null });

      // 2. Devolver todos os territórios designados (igual ao ativar)
      const territoriesRef = collection(db, 'congregations', congregationId, 'territories');
      const q = query(territoriesRef, where('status', '==', 'designado'));
      const snapshot = await getDocs(q);

      const returnTimestamp = Timestamp.fromDate(new Date(returnDate + 'T12:00:00'));

      snapshot.docs.forEach(tDoc => {
        const tData = tDoc.data();
        if (tData.assignment) {
          const historyLog = {
            uid: tData.assignment.uid,
            name: tData.assignment.name,
            assignedAt: tData.assignment.assignedAt,
            completedAt: returnTimestamp,
            isCompletion: true,
            campaignName: tData.assignment.campaignName
          };
          batch.update(tDoc.ref, {
            status: 'disponivel',
            assignment: null,
            assignmentHistory: arrayUnion(historyLog)
          });
        }
      });

      await batch.commit();
      
      logEvent(user.congregationId, user.uid, user.name, 'CAMPAIGN_STOPPED', `Encerrou a campanha ativa e devolveu ${snapshot.size} territórios.`);
      toast({ title: "Campanha Encerrada", description: "Todos os territórios foram devolvidos e o sistema voltou ao normal." });
      handleClose();
    } catch (e) {
      console.error("Erro ao encerrar campanha:", e);
      toast({ title: "Erro ao encerrar", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStage('type');
    setIsEndingWithReturn(false);
    onClose();
  };

  if (congregation?.activeCampaign) {
    if (isEndingWithReturn) {
      return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Encerrar Campanha</DialogTitle>
              <DialogDescription>
                Ao encerrar, <strong>todos os territórios designados atualmente serão devolvidos</strong> para ficarem disponíveis novamente.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
               <div className="space-y-2">
                <Label className="flex items-center gap-2"><Calendar size={16} /> Data da Devolução Final</Label>
                <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Esta data será usada para fechar o ciclo de trabalho atual no histórico.</p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsEndingWithReturn(false)}>Voltar</Button>
              <Button variant="destructive" onClick={handleStopCampaign} disabled={isLoading} className="font-bold">
                {isLoading ? <Loader className="animate-spin" /> : "Confirmar e Encerrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }

    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Campanha Ativa</DialogTitle>
            <DialogDescription>
              A campanha <strong>{congregation.activeCampaign.title}</strong> está em andamento.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">Enquanto a campanha estiver ativa, os publicadores não poderão marcar casas como feitas individualmente.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
            <Button variant="destructive" onClick={() => setIsEndingWithReturn(true)} className="font-bold">
              Encerrar Campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Ativar Nova Campanha</DialogTitle>
          <DialogDescription>
            Escolha o objetivo da campanha especial da congregação.
          </DialogDescription>
        </DialogHeader>

        {step === 'type' ? (
          <div className="space-y-6 py-4">
            <RadioGroup value={type} onValueChange={(v: any) => setType(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="congress" id="r1" />
                <Label htmlFor="r1">Convites do Congresso</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="memorial" id="r2" />
                <Label htmlFor="r2">Convites da Celebração</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="r3" />
                <Label htmlFor="r3">Outros (Especificar)</Label>
              </div>
            </RadioGroup>

            {type === 'other' && (
              <Input 
                placeholder="Nome da campanha..." 
                value={customTitle} 
                onChange={e => setCustomTitle(e.target.value)}
                autoFocus
              />
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex gap-3 items-start">
              <AlertTriangle className="text-yellow-500 shrink-0" size={20} />
              <p className="text-sm">
                Ao ativar a campanha, <strong>todos os territórios designados atualmente serão devolvidos</strong> para ficarem disponíveis para todos os irmãos.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Calendar size={16} /> Data da Devolução em Massa</Label>
              <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Esta data ficará registrada no histórico dos territórios.</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'type' ? (
            <>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={() => setStage('return')} disabled={type === 'other' && !customTitle.trim()}>Continuar</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStage('type')}>Voltar</Button>
              <Button onClick={handleStartCampaign} disabled={isLoading} className="font-bold">
                {isLoading ? <Loader className="animate-spin" /> : "Ativar e Devolver Tudo"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
