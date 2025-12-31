
"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader, Edit } from 'lucide-react';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import { MessageSquare } from 'lucide-react';
import type { Congregation } from '@/types/types';

export default function CongregationEditForm({ onSaveSuccess }: { onSaveSuccess: () => void }) {
  const { user } = useUser();
  const { toast } = useToast();

  const [congregationName, setCongregationName] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');
  const [templateAssignment, setTemplateAssignment] = useState('');
  const [templatePending, setTemplatePending] = useState('');
  
  const [originalData, setOriginalData] = useState<Partial<Congregation>>({});

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const defaultAssignmentTemplate = "Olá, o território *{{territorio}}* foi designado para você! Devolva até {{data}}. Acesse o app para ver os detalhes.";
  const defaultPendingTemplate = "Olá, sou {{nomeUsuario}}. Acabei de solicitar acesso ao aplicativo De Casa em Casa para a congregação {{congregacao}}. Você poderia aprovar meu acesso, por favor?";

  useEffect(() => {
    if (user?.congregationId) {
      const congRef = doc(db, 'congregations', user.congregationId);
      getDoc(congRef).then(snap => {
        if (snap.exists()) {
          const data = snap.data() as Partial<Congregation>;
          setOriginalData(data);
          setCongregationName(data.name || '');
          setCongregationNumber(data.number || '');
          setTemplateAssignment(data.whatsappTemplates?.assignment || defaultAssignmentTemplate);
          setTemplatePending(data.whatsappTemplates?.pendingApproval || defaultPendingTemplate);
        }
      });
    }
  }, [user?.congregationId, defaultAssignmentTemplate, defaultPendingTemplate]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!user || !user.congregationId) {
      setError("Congregação não encontrada.");
      setIsLoading(false);
      return;
    }

    try {
      if (user.role === 'Administrador') {
        const congRef = doc(db, "congregations", user.congregationId);
        await updateDoc(congRef, { 
            name: congregationName.trim(), 
            number: congregationNumber.trim(),
            whatsappTemplates: {
                assignment: templateAssignment,
                pendingApproval: templatePending,
            }
        });
        setOriginalData(prev => ({
            ...prev,
            name: congregationName.trim(),
            number: congregationNumber.trim(),
            whatsappTemplates: {
                assignment: templateAssignment,
                pendingApproval: templatePending,
            }
        }));
      } else {
        throw new Error("Você não tem permissão para editar a congregação.");
      }
      
      toast({
        title: "Sucesso!",
        description: "Os dados da congregação foram atualizados.",
      });

      onSaveSuccess();

    } catch (err: any) {
      setError(err.message || "Falha ao salvar as configurações.");
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled = user?.role !== 'Administrador';
  const hasChanges = 
    congregationName.trim() !== (originalData.name || '').trim() || 
    congregationNumber.trim() !== (originalData.number || '').trim() ||
    templateAssignment !== (originalData.whatsappTemplates?.assignment || defaultAssignmentTemplate) ||
    templatePending !== (originalData.whatsappTemplates?.pendingApproval || defaultPendingTemplate);

  return (
    <div className="bg-card p-6 rounded-lg shadow-md max-w-2xl mx-auto">
      <div className="flex items-center mb-4">
        <Edit className="h-6 w-6 mr-3 text-primary" />
        <h2 className="text-2xl font-bold">Configurações da Congregação</h2>
      </div>
      <p className="text-muted-foreground mb-6">
        Edite o nome, número e modelos de mensagem da sua congregação. Apenas administradores podem realizar esta ação.
      </p>
      <form onSubmit={handleUpdate} className="space-y-6">
        <div className='space-y-4'>
            <div>
              <Label htmlFor="congregationName">Nome da Congregação</Label>
              <Input 
                id="congregationName"
                value={congregationName} 
                onChange={e => setCongregationName(e.target.value)} 
                placeholder="Nome da Congregação" 
                disabled={isDisabled}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="congregationNumber">Número da Congregação</Label>
              <Input 
                id="congregationNumber"
                type="tel" 
                inputMode="numeric" 
                value={congregationNumber} 
                onChange={e => setCongregationNumber(e.target.value.replace(/\D/g, ''))} 
                placeholder="Apenas números" 
                disabled={isDisabled}
                className="mt-1"
              />
            </div>
        </div>

        <div className="border-t border-border pt-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-3"><MessageSquare/>Modelos de Mensagem do WhatsApp</h3>
            
            <div className="space-y-4">
                <div>
                    <Label htmlFor="template-assignment" className="text-sm font-medium">Ao designar um território:</Label>
                    <Textarea id="template-assignment" value={templateAssignment} onChange={e => setTemplateAssignment(e.target.value)} rows={3} className="mt-1" disabled={isDisabled}/>
                    <p className="text-xs text-muted-foreground mt-1">Variáveis disponíveis: {`{{territorio}}`}, {`{{data}}`}</p>
                </div>
                <div>
                    <Label htmlFor="template-pending" className="text-sm font-medium">Ao solicitar acesso (para avisar um admin):</Label>
                    <Textarea id="template-pending" value={templatePending} onChange={e => setTemplatePending(e.target.value)} rows={4} className="mt-1" disabled={isDisabled}/>
                    <p className="text-xs text-muted-foreground mt-1">Variáveis disponíveis: {`{{nomeUsuario}}`}, {`{{congregacao}}`}</p>
                </div>
            </div>
        </div>
        
        {error && <p className="text-sm text-center text-destructive">{error}</p>}
        
        <div className="flex justify-end">
            <Button type="submit" disabled={isDisabled || isLoading || !hasChanges} className="w-full sm:w-auto">
              {isLoading ? <Loader className="animate-spin" /> : "Salvar Alterações"}
            </Button>
        </div>
      </form>
    </div>
  );
};
