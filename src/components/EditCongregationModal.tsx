
"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { House, Loader, MessageSquare } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Congregation } from '@/types/types';
import { Textarea } from './ui/textarea';

interface EditCongregationModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function EditCongregationModal({ isOpen, onOpenChange }: EditCongregationModalProps) {
  const { user } = useUser();
  
  const [congregationName, setCongregationName] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');
  const [templateAssignment, setTemplateAssignment] = useState('');
  const [templatePending, setTemplatePending] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const defaultAssignmentTemplate = "Olá, o território *{{territorio}}* foi designado para você! Devolva até {{data}}. Acesse o app para ver os detalhes.";
  const defaultPendingTemplate = "Olá, sou {{nomeUsuario}}. Acabei de solicitar acesso ao aplicativo De Casa em Casa para a congregação {{congregacao}}. Você poderia aprovar meu acesso, por favor?";


  useEffect(() => {
    if (isOpen && user?.congregationId) {
        setError(''); 
        setSuccess('');
        
        const congRef = doc(db, 'congregations', user.congregationId);
        getDoc(congRef).then(snap => {
            if(snap.exists()){
              const data = snap.data() as Partial<Congregation>;
              setCongregationName(data.name || '');
              setCongregationNumber(data.number || '');
              setTemplateAssignment(data.whatsappTemplates?.assignment || defaultAssignmentTemplate);
              setTemplatePending(data.whatsappTemplates?.pendingApproval || defaultPendingTemplate);
            }
        });
    }
  }, [user, isOpen, defaultAssignmentTemplate, defaultPendingTemplate]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(''); setSuccess('');

    if (!user || !user.congregationId) {
        setError("Congregação não encontrada.");
        setIsLoading(false);
        return;
    }

    try {
      if(user.role === 'Administrador') {
        const congRef = doc(db, "congregations", user.congregationId);
        await updateDoc(congRef, { 
            name: congregationName, 
            number: congregationNumber,
            whatsappTemplates: {
                assignment: templateAssignment,
                pendingApproval: templatePending,
            }
        });
      } else {
        throw new Error("Você não tem permissão para editar a congregação.");
      }
      
      setSuccess("Congregação atualizada com sucesso!");
      setTimeout(() => onOpenChange(false), 2000);

    } catch (err: any) {
      setError(err.message || "Falha ao salvar as configurações.");
    } finally { 
        setIsLoading(false); 
    }
  };

  const inputClasses = "w-full mt-1 bg-input text-foreground rounded px-3 py-2 border border-border";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><House />Editar Congregação</DialogTitle>
          <DialogDescription>
            Edite os dados e modelos de mensagem da sua congregação.
          </DialogDescription>
        </DialogHeader>
          
        <form id="edit-congregation-form" onSubmit={handleUpdate} className="mt-4 space-y-6">
          <div className="space-y-4">
            <input value={congregationName} onChange={e => setCongregationName(e.target.value)} placeholder="Nome da Congregação" className={inputClasses} />
            <input type="tel" inputMode="numeric" value={congregationNumber} onChange={e => setCongregationNumber(e.target.value.replace(/\D/g, ''))} placeholder="Número" className={inputClasses} />
          </div>

           <div className="border-t border-border pt-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-3"><MessageSquare/>Modelos de Mensagem do WhatsApp</h3>
              
              <div className="space-y-4">
                  <div>
                      <label className="text-sm font-medium text-muted-foreground">Ao designar um território:</label>
                      <Textarea value={templateAssignment} onChange={e => setTemplateAssignment(e.target.value)} rows={3} className={inputClasses} />
                      <p className="text-xs text-muted-foreground mt-1">Variáveis: {`{{territorio}}`}, {`{{data}}`}</p>
                  </div>
                  <div>
                      <label className="text-sm font-medium text-muted-foreground">Ao solicitar acesso:</label>
                      <Textarea value={templatePending} onChange={e => setTemplatePending(e.target.value)} rows={4} className={inputClasses} />
                      <p className="text-xs text-muted-foreground mt-1">Variáveis: {`{{nomeUsuario}}`}, {`{{congregacao}}`}</p>
                  </div>
              </div>
          </div>

          {error && <p className="text-sm text-center text-destructive">{error}</p>}
          {success && <p className="text-sm text-center text-green-500">{success}</p>}
        </form>
        <DialogFooter className="pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form="edit-congregation-form" disabled={isLoading}>
            {isLoading ? <><Loader className="mr-2 h-4 w-4 animate-spin"/>Salvando...</> : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
