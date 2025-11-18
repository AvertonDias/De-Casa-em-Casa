
"use client";

import React, { useState, useEffect, FormEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { AppUser } from '@/types/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { maskPhone } from '@/lib/utils';

interface EditUserByAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    userToEdit: AppUser | null;
    onSave: (userId: string, dataToUpdate: Partial<AppUser>) => Promise<void>;
}

export function EditUserByAdminModal({ isOpen, onClose, userToEdit, onSave }: EditUserByAdminModalProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [role, setRole] = useState<AppUser['role']>('Publicador');
    const [status, setStatus] = useState<AppUser['status']>('ativo');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (userToEdit) {
            setName(userToEdit.name || '');
            setEmail(userToEdit.email || '');
            setWhatsapp(userToEdit.whatsapp || '');
            setRole(userToEdit.role || 'Publicador');
            setStatus(userToEdit.status || 'ativo');
        }
    }, [userToEdit]);

    const handleSaveSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!userToEdit?.uid) return;

        setIsSaving(true);
        try {
            const dataToUpdate: Partial<AppUser> = {};
            if(name !== userToEdit.name) dataToUpdate.name = name;
            if(email !== userToEdit.email) dataToUpdate.email = email;
            if(whatsapp !== userToEdit.whatsapp) dataToUpdate.whatsapp = whatsapp;
            if(role !== userToEdit.role) dataToUpdate.role = role;
            if(status !== userToEdit.status) dataToUpdate.status = status;

            if (Object.keys(dataToUpdate).length > 0) {
              await onSave(userToEdit.uid, dataToUpdate);
            }
            onClose();
        } catch (error) {
            console.error("Erro ao salvar edições do usuário:", error);
        } finally {
            setIsSaving(false);
        }
    };
    
    if (!userToEdit) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Editar Usuário: {userToEdit.name}</DialogTitle>
                    <DialogDescription>
                        Ajuste os dados e permissões do usuário.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSaveSubmit} className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="edit-name">Nome</Label>
                        <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div>
                        <Label htmlFor="edit-email">Email</Label>
                        <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                     <div>
                        <Label htmlFor="edit-whatsapp">WhatsApp</Label>
                        <Input id="edit-whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(maskPhone(e.target.value))} placeholder="(XX) XXXXX-XXXX"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="edit-role">Perfil</Label>
                            <Select value={role} onValueChange={(value: AppUser['role']) => setRole(value)}>
                                <SelectTrigger id="edit-role">
                                    <SelectValue placeholder="Selecione o perfil" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Publicador">Publicador</SelectItem>
                                    <SelectItem value="Servo de Territórios">Servo de Territórios</SelectItem>
                                    <SelectItem value="Dirigente">Dirigente</SelectItem>
                                    <SelectItem value="Administrador">Administrador</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div>
                            <Label htmlFor="edit-status">Status</Label>
                             <Select value={status} onValueChange={(value: AppUser['status']) => setStatus(value)}>
                                <SelectTrigger id="edit-status">
                                    <SelectValue placeholder="Selecione o status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ativo">Ativo</SelectItem>
                                    <SelectItem value="pendente">Pendente</SelectItem>
                                    <SelectItem value="inativo">Inativo</SelectItem>
                                    <SelectItem value="rejeitado">Rejeitado</SelectItem>
                                    <SelectItem value="bloqueado">Bloqueado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
