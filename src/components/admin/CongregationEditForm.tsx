"use client";

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader, Edit, MessageSquare, RotateCcw, CalendarClock } from 'lucide-react';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import type { Congregation } from '@/types/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CongregationEditForm({ onSaveSuccess }: { onSaveSuccess: () => void }) {
  const { user } = useUser();
  const { toast } = useToast();

  const [congregationName, setCongregationName] = useState('');
  const [congregationNumber, setCongregationNumber] = useState('');
  const [templateAssignment, setTemplateAssignment] = useState('');
  const [templatePending, setTemplatePending] = useState('');
  const [templateOverdue, setTemplateOverdue] = useState('');
  const [defaultAssignmentMonths, setDefaultAssignmentMonths] = useState(2);
  
  const [originalData, setOriginalData] = useState<Partial<Congregation>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const assignmentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const overdueTextareaRef = useRef<HTMLTextAreaElement>(null);

  const defaultPendingTemplate = "Olá, sou [Nome do Usuário]. Acabei de solicitar acesso ao aplicativo De Casa em Casa para a congregação [Nome da Congregação]. Você poderia aprovar meu acesso, por favor?";
  const defaultAssignmentTemplate = "Olá, o território *[Território]* foi designado para você! Devolva até [Data de Devolução]. Acesse o app para ver os detalhes.";
  const defaultOverdueTemplate = "Olá, este é um lembrete de que o território *[Território]* está com a devolução atrasada. Por favor, atualize o quanto antes. Acesse o app: [Link]";


  useEffect(() => {
    if (user?.congregationId) {
      const congRef = doc(db, 'congregations', user.congregationId);
      getDoc(congRef).then(snap => {
        if (snap.exists()) {
          const data = snap.data() as Partial<Congregation>;
          setOriginalData(data);
          setCongregationName(data.name || '');
          setCongregationNumber(data.number || '');
          setTemplatePending(data.whatsappTemplates?.pendingApproval || defaultPendingTemplate);
          setTemplateAssignment(data.whatsappTemplates?.assignment || defaultAssignmentTemplate);
          setTemplateOverdue(data.whatsappTemplates?.overdueReminder || defaultOverdueTemplate);
          setDefaultAssignmentMonths(data.defaultAssignmentMonths || 2);
        }
      });
    }
  }, [user?.congregationId, defaultAssignmentTemplate, defaultPendingTemplate, defaultOverdueTemplate]);

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
        const dataToUpdate: Partial<Congregation> = { 
            name: congregationName.trim(), 
            number: congregationNumber.trim(),
            defaultAssignmentMonths: Number(defaultAssignmentMonths),
            whatsappTemplates: {
                pendingApproval: templatePending,
                assignment: templateAssignment,
                overdueReminder: templateOverdue,
            }
        };

        await updateDoc(congRef, dataToUpdate);

        setOriginalData(prev => ({
            ...prev,
            ...dataToUpdate
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

  const handleInsertTag = (
    tagToInsert: string,
    textareaRef: React.RefObject<HTMLTextAreaElement>,
    setTemplate: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (!textareaRef.current) return;

    const { selectionStart, selectionEnd, value } = textareaRef.current;
    const newText =
      value.substring(0, selectionStart) +
      tagToInsert +
      value.substring(selectionEnd);
    setTemplate(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPosition = selectionStart + tagToInsert.length;
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    }, 0);
  };


  const isDisabled = user?.role !== 'Administrador';
  const hasChanges = 
    congregationName.trim() !== (originalData.name || '').trim() || 
    congregationNumber.trim() !== (originalData.number || '').trim() ||
    templatePending !== (originalData.whatsappTemplates?.pendingApproval || defaultPendingTemplate) ||
    templateAssignment !== (originalData.whatsappTemplates?.assignment || defaultAssignmentTemplate) ||
    templateOverdue !== (originalData.whatsappTemplates?.overdueReminder || defaultOverdueTemplate) ||
    Number(defaultAssignmentMonths) !== (originalData.defaultAssignmentMonths || 2);

  const pendingApprovalTags = [
    { tag: "[Nome do Usuário]", label: "Nome do Usuário" },
    { tag: "[Nome da Congregação]", label: "Nome da Congregação" },
  ];
  
  const assignmentTags = [
    { tag: "[Território]", label: "Território" },
    { tag: "[Data de Devolução]", label: "Data de Devolução" },
  ];

  const overdueTags = [
      { tag: "[Território]", label: "Território" },
      { tag: "[Nome do Publicador]", label: "Nome do Publicador"},
      { tag: "[Link]", label: "Link" },
  ];


  return (
    <div className="bg-card p-6 rounded-lg shadow-md max-w-2xl mx-auto">
      <div className="flex items-center mb-4">
        <Edit className="h-6 w-6 mr-3 text-primary" />
        <h2 className="text-2xl font-bold">Configurações da Congregação</h2>
      </div>
      <p className="text-muted-foreground mb-6">
        Edite o nome, número e modelos de mensagem da sua congregação.
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
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3"><CalendarClock/> Designações</h3>
           <div>
              <Label htmlFor="defaultAssignmentMonths">Prazo Padrão de Devolução</Label>
              <Select value={String(defaultAssignmentMonths)} onValueChange={(val) => setDefaultAssignmentMonths(Number(val))} disabled={isDisabled}>
                  <SelectTrigger id="defaultAssignmentMonths" className="w-full mt-1">
                      <SelectValue placeholder="Selecione um prazo..." />
                  </SelectTrigger>
                  <SelectContent>
                      {Array.from(Array(12).keys()).map(i => (
                          <SelectItem key={i + 1} value={String(i + 1)}>
                              {i + 1} {i + 1 > 1 ? 'meses' : 'mês'}
                          </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
               <p className="text-xs text-muted-foreground mt-1">Este será o prazo padrão ao designar um novo território.</p>
           </div>
        </div>

        <div className="border-t border-border pt-4">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-3"><MessageSquare/>Modelos de Mensagem do WhatsApp</h3>
            
            <div className="space-y-6">
                <div>
                     <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="template-pending" className="text-md font-bold text-foreground">Ao solicitar acesso (para avisar um Dirigente):</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setTemplatePending(defaultPendingTemplate)} disabled={isDisabled} className="text-xs h-auto py-0.5 px-1.5">
                            <RotateCcw className="mr-1" size={12}/> Restaurar Padrão
                        </Button>
                    </div>
                    <Textarea ref={pendingTextareaRef} id="template-pending" value={templatePending} onChange={e => setTemplatePending(e.target.value)} rows={4} className="mt-1" disabled={isDisabled}/>
                    <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Tags disponíveis (clique para adicionar):</p>
                        <div className="flex flex-wrap gap-2">
                            {pendingApprovalTags.map(t => (
                                <Button
                                    key={t.tag}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-auto px-2 py-1 text-xs"
                                    onClick={() => handleInsertTag(t.tag, pendingTextareaRef, setTemplatePending)}
                                    disabled={isDisabled}
                                >
                                    {t.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label htmlFor="template-assignment" className="text-md font-bold text-foreground">Ao designar um território:</Label>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setTemplateAssignment(defaultAssignmentTemplate)} disabled={isDisabled} className="text-xs h-auto py-0.5 px-1.5">
                        <RotateCcw className="mr-1" size={12}/> Restaurar Padrão
                      </Button>
                    </div>
                    <Textarea ref={assignmentTextareaRef} id="template-assignment" value={templateAssignment} onChange={e => setTemplateAssignment(e.target.value)} rows={3} className="mt-1" disabled={isDisabled}/>
                    <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Tags disponíveis (clique para adicionar):</p>
                        <div className="flex flex-wrap gap-2">
                            {assignmentTags.map(t => (
                                <Button
                                    key={t.tag}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-auto px-2 py-1 text-xs"
                                    onClick={() => handleInsertTag(t.tag, assignmentTextareaRef, setTemplateAssignment)}
                                    disabled={isDisabled}
                                >
                                    {t.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label htmlFor="template-overdue" className="text-md font-bold text-foreground">Ao cobrar um território vencido:</Label>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setTemplateOverdue(defaultOverdueTemplate)} disabled={isDisabled} className="text-xs h-auto py-0.5 px-1.5">
                        <RotateCcw className="mr-1" size={12}/> Restaurar Padrão
                      </Button>
                    </div>
                    <Textarea ref={overdueTextareaRef} id="template-overdue" value={templateOverdue} onChange={e => setTemplateOverdue(e.target.value)} rows={3} className="mt-1" disabled={isDisabled}/>
                    <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Tags disponíveis (clique para adicionar):</p>
                        <div className="flex flex-wrap gap-2">
                            {overdueTags.map(t => (
                                <Button
                                    key={t.tag}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-auto px-2 py-1 text-xs"
                                    onClick={() => handleInsertTag(t.tag, overdueTextareaRef, setTemplateOverdue)}
                                    disabled={isDisabled}
                                >
                                    {t.label}
                                </Button>
                            ))}
                        </div>
                    </div>
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
