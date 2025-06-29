
"use client";

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function FeedbackModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback.length < 10) return;
    setIsSubmitting(true);
    // Simula um envio de feedback
    setTimeout(() => {
      console.log('Feedback enviado:', feedback);
      setIsSubmitting(false);
      setIsSubmitted(true);
      setFeedback('');
      setTimeout(() => {
        setIsOpen(false);
        // Reseta o estado após fechar o modal
        setTimeout(() => setIsSubmitted(false), 500); 
      }, 2000);
    }, 1000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-center bg-gray-200 text-gray-700 dark:text-gray-300 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700">
          <MessageSquare className="mr-2" size={20} />
          Enviar Feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Deixe seu Feedback</DialogTitle>
          <DialogDescription>
            Encontrou um bug ou tem uma sugestão? Adoraríamos ouvir!
          </DialogDescription>
        </DialogHeader>
        {isSubmitted ? (
          <div className="py-8 text-center flex flex-col items-center justify-center">
            <h3 className="text-lg font-semibold text-green-500">Obrigado!</h3>
            <p className="text-muted-foreground">Seu feedback foi enviado.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} id="feedback-form" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="feedback-text">Sua mensagem</Label>
              <Textarea
                id="feedback-text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Descreva o problema ou sua ideia. Mínimo de 10 caracteres."
                rows={5}
                required
              />
            </div>
          </form>
        )}
        <DialogFooter>
          {!isSubmitted && (
            <Button type="submit" form="feedback-form" disabled={isSubmitting || feedback.length < 10}>
              {isSubmitting ? "Enviando..." : "Enviar Feedback"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
