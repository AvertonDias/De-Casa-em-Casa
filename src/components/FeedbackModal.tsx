"use client";

import { useState, useRef, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { Mail, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import emailjs from '@emailjs/browser';

const functionsInstance = getFunctions(app, 'southamerica-east1');


export function FeedbackModal() {
  const { user, congregation } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const subjectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        subjectInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setSubject('');
      setMessage('');
    }
    setIsOpen(open);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Erro de Autenticação",
        description: "Você precisa estar logado para enviar feedback.",
        variant: "destructive",
      });
      return;
    }
    setIsSending(true);

    const templateParams = {
      from_name: user.name,
      from_email: user.email,
      subject: subject,
      message: message,
      congregation_name: congregation?.name || 'Não informado',
      congregation_number: congregation?.number || 'N/A',
    };

    try {
        await emailjs.send(
            'service_w3xe95d', // Seu Service ID
            'template_jco2e6b', // Seu Template ID
            templateParams,
            'JdR2XKNICKcHc1jny' // Sua Public Key
        );

        toast({
            title: "Feedback Enviado!",
            description: "Agradecemos a sua mensagem.",
            variant: "default",
        });
        setIsOpen(false);
    } catch (error: any) {
        console.error("Erro ao enviar feedback com EmailJS:", error);
        toast({
            title: "Erro ao enviar feedback",
            description: error.message || "Não foi possível enviar sua mensagem no momento.",
            variant: "destructive",
        });
    } finally {
        setIsSending(false);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        className="w-full justify-center text-yellow-600 border-yellow-500/50 hover:bg-yellow-500/10 hover:text-yellow-600 dark:text-yellow-400 dark:border-yellow-400/50 dark:hover:bg-yellow-400/10 dark:hover:text-yellow-400" 
        onClick={() => setIsOpen(true)}
      >
        <Mail className="mr-2" size={20} />
        Enviar Feedback
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Feedback</DialogTitle>
            <DialogDescription>
              Use este formulário para nos enviar sua sugestão, relatar um problema ou fazer um elogio. Seu nome e e-mail serão enviados automaticamente.
            </DialogDescription>
            <DialogClose />
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <label htmlFor="subject" className="block text-sm font-medium">Assunto</label>
              <input 
                id="subject" 
                ref={subjectInputRef}
                type="text" 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)} 
                required 
                placeholder="Ex: Sugestão para a tela de usuários" 
                className="mt-1 block w-full border rounded-md p-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary" 
              />
               <p className="text-xs text-muted-foreground mt-1">Um breve resumo da sua mensagem.</p>
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium">Mensagem</label>
              <textarea 
                id="message" 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
                required 
                rows={5} 
                placeholder="Descreva sua sugestão ou o problema que encontrou..." 
                className="mt-1 block w-full border rounded-md p-2 bg-input focus:outline-none focus:ring-2 focus:ring-primary"
              ></textarea>
            </div>
            <Button type="submit" className="w-full" disabled={isSending || !subject.trim() || !message.trim()}>
              {isSending ? <Loader className="animate-spin" size={20}/> : 'Enviar Mensagem'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
