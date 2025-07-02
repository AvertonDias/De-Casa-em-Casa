
"use client";

import { useState } from 'react';
import { MessageSquare, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function FeedbackModal() {
  const [isOpen, setIsOpen] = useState(false);

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
          <DialogTitle className="flex items-center">
            <Construction className="mr-2 h-5 w-5 text-yellow-500" />
            Em Desenvolvimento
          </DialogTitle>
          <DialogDescription className="pt-4">
            A funcionalidade de feedback ainda está sendo construída. Agradecemos a sua paciência! Em breve, você poderá nos enviar suas sugestões diretamente por aqui.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
