"use client";

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader, Edit, MessageSquare, ArrowRight, RotateCcw, CalendarClock } from 'lucide-react';
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

  const [selectedAssignmentTag, setSelectedAssignmentTag] = useState<string>('');
  const [selectedPendingTag, setSelectedPendingTag] = useState<string>('');
  const [selectedOverdueTag, setSelectedOverdueTag] = useState<string>('');


  const defaultAssignmentTemplate = "Olá, o território *{{territorio}}* foi designado para você! Devolva até {{data}}. Acesse o app para ver os detalhes.";
  const defaultPendingTemplate = "Olá, sou {{nomeUsuario}}. Acabei de solicitar acesso ao aplicativo De Casa em Casa para a congregação {{congregacao}}. Você poderia aprovar meu acesso, por favor?";
  const defaultOverdueTemplate = "Olá, este é um lembrete de que o território *{{territorio}}* está com a devolução atrasada. Por favor, atualize o quanto antes. Acesse o app: {{link}}";


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
                assignment: templateAssignment,
                pendingApproval: templatePending,
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

  const handleInsertTag = (templateType: 'assignment' | 'pending' | 'overdue') => {
    let tagToInsert = '';
    let textareaRef: React.RefObject<HTMLTextAreaElement> | null = null;
    let setTemplate: React.Dispatch<React.SetStateAction<string>> | null = null;

    if (templateType === 'assignment') {
        tagToInsert = selectedAssignmentTag;
        textareaRef = assignmentTextareaRef;
        setTemplate = setTemplateAssignment;
    } else if (templateType === 'pending') {
        tagToInsert = selectedPendingTag;
        textareaRef = pendingTextareaRef;
        setTemplate = setTemplatePending;
    } else if (templateType === 'overdue') {
        tagToInsert = selectedOverdueTag;
        textareaRef = overdueTextareaRef;
        setTemplate = setTemplateOverdue;
    }


    if (tagToInsert && textareaRef?.current && setTemplate) {
        const { selectionStart, selectionEnd, value } = textareaRef.current;
        const newText = value.substring(0, selectionStart) + tagToInsert + value.substring(selectionEnd);
        setTemplate(newText);

        setTimeout(() => {
            textareaRef.current?.focus();
            const newCursorPosition = selectionStart + tagToInsert.length;
            textareaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
        }, 0);
    }
  };

  const isDisabled = user?.role !== 'Administrador';
  const hasChanges = 
    congregationName.trim() !== (originalData.name || '').trim() || 
    congregationNumber.trim() !== (originalData.number || '').trim() ||
    templateAssignment !== (originalData.whatsappTemplates?.assignment || defaultAssignmentTemplate) ||
    templatePending !== (originalData.whatsappTemplates?.pendingApproval || defaultPendingTemplate) ||
    templateOverdue !== (originalData.whatsappTemplates?.overdueReminder || defaultOverdueTemplate) ||
    Number(defaultAssignmentMonths) !== (originalData.defaultAssignmentMonths || 2);

  const assignmentTags = [
    { tag: "{{territorio}}", description: "Nome e número do território." },
    { tag: "{{data}}", description: "Data de devolução." },
  ];

  const pendingApprovalTags = [
    { tag: "{{nomeUsuario}}", description: "Nome do novo usuário." },
    { tag: "{{congregacao}}", description: "Nome da congregação." },
  ];

  const overdueTags = [
      { tag: "{{territorio}}", description: "Nome e número do território." },
      { tag: "{{nomePublicador}}", description: "Nome de quem designou."},
      { tag: "{{link}}", description: "Link para Meus Territórios." },
  ];


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
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3"><CalendarClock/> Designações</h3>
           <div>
              <Label htmlFor="defaultAssignmentMonths">Prazo Padrão de Devolução</Label>
              <Select value={String(defaultAssignmentMonths)} onValueChange={(val) => setDefaultAssignmentMonths(Number(val))} disabled={isDisabled}>
                  <SelectTrigger id="defaultAssignmentMonths" className="w-full mt-1">
                      <SelectValue placeholder="Selecione um prazo..." />
                  </SelectTrigger>
                  <SelectContent>
                      {[...Array(12).keys()].map(i => (
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
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-3"><MessageSquare/>Modelos de Mensagem do WhatsApp</h3>
            
            <div className="space-y-6">
                <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label htmlFor="template-assignment" className="text-sm font-medium">Ao designar um território:</Label>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setTemplateAssignment(defaultAssignmentTemplate)} disabled={isDisabled} className="text-xs h-auto py-0.5 px-1.5">
                        <RotateCcw className="mr-1" size={12}/> Restaurar Padrão
                      </Button>
                    </div>
                     <div className="flex items-center gap-2 mb-2">
                        <Select onValueChange={setSelectedAssignmentTag} value={selectedAssignmentTag}>
                            <SelectTrigger className="flex-grow">
                                <SelectValue placeholder="Selecionar tag..." />
                            </SelectTrigger>
                            <SelectContent>
                                {assignmentTags.map(t => <SelectItem key={t.tag} value={t.tag}>{t.tag} - {t.description}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button type="button" size="icon" variant="outline" onClick={() => handleInsertTag('assignment')} disabled={!selectedAssignmentTag || isDisabled}>
                            <ArrowRight />
                        </Button>
                    </div>
                    <Textarea ref={assignmentTextareaRef} id="template-assignment" value={templateAssignment} onChange={e => setTemplateAssignment(e.target.value)} rows={3} className="mt-1" disabled={isDisabled}/>
                </div>
                <div>
                     <div className="flex justify-between items-center mb-1">
                        <Label htmlFor="template-pending" className="text-sm font-medium">Ao solicitar acesso (para avisar um admin):</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setTemplatePending(defaultPendingTemplate)} disabled={isDisabled} className="text-xs h-auto py-0.5 px-1.5">
                            <RotateCcw className="mr-1" size={12}/> Restaurar Padrão
                        </Button>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                         <Select onValueChange={setSelectedPendingTag} value={selectedPendingTag}>
                            <SelectTrigger className="flex-grow">
                                <SelectValue placeholder="Selecionar tag..." />
                            </SelectTrigger>
                            <SelectContent>
                                {pendingApprovalTags.map(t => <SelectItem key={t.tag} value={t.tag}>{t.tag} - {t.description}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button type="button" size="icon" variant="outline" onClick={() => handleInsertTag('pending')} disabled={!selectedPendingTag || isDisabled}>
                            <ArrowRight />
                        </Button>
                    </div>
                    <Textarea ref={pendingTextareaRef} id="template-pending" value={templatePending} onChange={e => setTemplatePending(e.target.value)} rows={4} className="mt-1" disabled={isDisabled}/>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                      <Label htmlFor="template-overdue" className="text-sm font-medium">Ao cobrar um território vencido:</Label>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setTemplateOverdue(defaultOverdueTemplate)} disabled={isDisabled} className="text-xs h-auto py-0.5 px-1.5">
                        <RotateCcw className="mr-1" size={12}/> Restaurar Padrão
                      </Button>
                    </div>
                     <div className="flex items-center gap-2 mb-2">
                        <Select onValueChange={setSelectedOverdueTag} value={selectedOverdueTag}>
                            <SelectTrigger className="flex-grow">
                                <SelectValue placeholder="Selecionar tag..." />
                            </SelectTrigger>
                            <SelectContent>
                                {overdueTags.map(t => <SelectItem key={t.tag} value={t.tag}>{t.tag} - {t.description}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button type="button" size="icon" variant="outline" onClick={() => handleInsertTag('overdue')} disabled={!selectedOverdueTag || isDisabled}>
                            <ArrowRight />
                        </Button>
                    </div>
                    <Textarea ref={overdueTextareaRef} id="template-overdue" value={templateOverdue} onChange={e => setTemplateOverdue(e.target.value)} rows={3} className="mt-1" disabled={isDisabled}/>
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
