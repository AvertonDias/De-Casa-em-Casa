// /home/user/studio/components/users/EditUserByAdminModal.tsx
import React, { useState, useEffect, FormEvent } from 'react'; // Adicionado useState, useEffect, FormEvent
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Adicionado para o formulário
import { Label } from '@/components/ui/label'; // Adicionado para o formulário
import { Loader2 } from 'lucide-react'; // Adicionado para o spinner de loading

// IMPORTAÇÃO CRUCIAL PARA O TIPO APPUSER
import type { AppUser, Congregation } from '@/types/types'; // <<< IMPORTE AppUser AQUI
// Ajuste o caminho '@/types/types' se necessário para que o EditUserByAdminModal.tsx o encontre.
// Ex: Se o path mapping não estiver funcionando ou você precisa de um caminho relativo.

interface EditUserByAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    userToEdit: AppUser | null; // <<< ADICIONADO ESTA PROPRIEDADE
    onSave: (userId: string, dataToUpdate: Partial<AppUser>) => Promise<void>; // <<< ADICIONADO ESTA PROPRIEDADE
}

export function EditUserByAdminModal({ isOpen, onClose, userToEdit, onSave }: EditUserByAdminModalProps) {
    // Estado para o formulário de edição dentro do modal
    const [editedUser, setEditedUser] = useState<Partial<AppUser>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Preenche o formulário com os dados do usuário a ser editado quando o modal é aberto
    useEffect(() => {
        if (userToEdit) {
            setEditedUser({ ...userToEdit });
        }
    }, [userToEdit]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditedUser(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!userToEdit?.uid) return;

        setIsSaving(true);
        try {
            await onSave(userToEdit.uid, editedUser);
            onClose(); // Fecha o modal após salvar com sucesso
        } catch (error) {
            console.error("Erro ao salvar edições do usuário:", error);
            // TODO: Adicionar um toast ou mensagem de erro para o usuário
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Editar Usuário: {userToEdit?.name || userToEdit?.email || 'N/A'}</DialogTitle>
                    <DialogDescription>
                        Faça as alterações necessárias no perfil do usuário.
                    </DialogDescription>
                </DialogHeader>
                {userToEdit && (
                    <form onSubmit={handleSaveSubmit} className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="edit-name">Nome</Label>
                            <Input
                                id="edit-name"
                                name="name"
                                value={editedUser.name || ''}
                                onChange={handleFormChange}
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-email">Email</Label>
                            <Input
                                id="edit-email"
                                name="email"
                                type="email"
                                value={editedUser.email || ''}
                                onChange={handleFormChange}
                                required
                            />
                        </div>
                        {/* Adicione outros campos que você deseja editar aqui (role, congregationId, etc.) */}
                        {/* Exemplo para WhatsApp: */}
                        <div>
                            <Label htmlFor="edit-whatsapp">WhatsApp</Label>
                            <Input
                                id="edit-whatsapp"
                                name="whatsapp"
                                value={editedUser.whatsapp || ''}
                                onChange={handleFormChange}
                            />
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
                )}
            </DialogContent>
        </Dialog>
    );
}
    