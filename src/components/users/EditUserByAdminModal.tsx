
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { maskPhone } from '@/lib/utils';
import type { AppUser } from '@/types/types';

interface EditUserByAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit: AppUser;
  onSave: (userId: string, data: Partial<AppUser>) => Promise<void>;
}

export function EditUserByAdminModal({ isOpen, onClose, userToEdit, onSave }: EditUserByAdminModalProps) {
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [role, setRole] = useState<AppUser['role']>('Publicador');
  const [status, setStatus] = useState<AppUser['status']>('ativo');
  const [loading, setLoading] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userToEdit && isOpen) {
      setName(userToEdit.name || '');
      setWhatsapp(userToEdit.whatsapp || '');
      setRole(userToEdit.role || 'Publicador');
      setStatus(userToEdit.status || 'inativo');
      
      setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 100);
    }
  }, [userToEdit, isOpen]);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const dataToUpdate: Partial<AppUser> = {};
    if (name.trim() !== userToEdit.name) dataToUpdate.name = name.trim();
    if (whatsapp !== (userToEdit.whatsapp || '')) dataToUpdate.whatsapp = whatsapp;
    if (role !== userToEdit.role) dataToUpdate.role = role;
    if (status !== userToEdit.status) dataToUpdate.status = status;
    
    if (Object.keys(dataToUpdate).length > 0) {
      try {
        await onSave(userToEdit.uid, dataToUpdate);
        toast({
          title: "Sucesso!",
          description: `Perfil de ${name.trim()} foi atualizado.`,
        });
        onClose();
      } catch (error) {
        toast({
          title: "Erro ao Salvar",
          description: "Não foi possível salvar as alterações.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Nenhuma alteração",
        description: "Nenhuma modificação foi feita.",
      });
      onClose();
    }
    setLoading(false);
  };
  
  const allRoles: AppUser['role'][] = ['Administrador', 'Dirigente', 'Servo de Territórios', 'Publicador'];
  const allStatuses: AppUser['status'][] = ['ativo', 'pendente', 'inativo', 'rejeitado'];

  const hasChanges = userToEdit && (
    name !== userToEdit.name ||
    whatsapp !== (userToEdit.whatsapp || '') ||
    role !== userToEdit.role ||
    status !== userToEdit.status
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-md p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Editar Perfil de Usuário</DialogTitle>
          <DialogDescription>
            Alterando perfil de <span className="font-semibold">{userToEdit?.name}</span>.
          </DialogDescription>
        </DialogHeader>
        
        <form id="edit-user-by-admin-form" onSubmit={handleSaveChanges} className="px-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
                <Label htmlFor="edit-name">Nome Completo</Label>
                <Input ref={nameInputRef} id="edit-name" type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1"/>
            </div>
            <div>
                <Label htmlFor="edit-whatsapp">WhatsApp</Label>
                <Input 
                  id="edit-whatsapp" 
                  type="tel" 
                  value={whatsapp} 
                  onChange={e => setWhatsapp(maskPhone(e.target.value))} 
                  placeholder="(XX) XXXXX-XXXX" 
                  className="mt-1"
                />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label htmlFor="edit-role">Perfil</Label>
                    <Select value={role} onValueChange={(value: AppUser['role']) => setRole(value)}>
                        <SelectTrigger id="edit-role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {allRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select value={status} onValueChange={(value: AppUser['status']) => setStatus(value)}>
                        <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {allStatuses.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </form>

        <DialogFooter className="p-6 pt-4 border-t">
          <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={loading}>Cancelar</Button>
          </DialogClose>
          <Button type="submit" form="edit-user-by-admin-form" disabled={loading || !hasChanges}>
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
