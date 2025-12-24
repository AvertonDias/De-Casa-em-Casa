
"use client";

import { Territory } from "@/types/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "../ui/dialog";
import { Button } from "../ui/button";
import Link from "next/link";
import { Map, Trees } from "lucide-react";

interface TerritoryListModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    territories: Territory[];
}

export default function TerritoryListModal({ isOpen, onClose, title, territories }: TerritoryListModalProps) {
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Lista de territórios correspondentes a esta estatística.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto pr-4 -mr-4 mt-4 space-y-2">
                    {territories.length > 0 ? (
                        territories.map(t => (
                            <Link 
                                key={t.id} 
                                href={t.type === 'rural' ? `/dashboard/rural/${t.id}` : `/dashboard/territorios/${t.id}`}
                                className="block p-3 rounded-md bg-muted/50 hover:bg-muted"
                                onClick={onClose}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        {t.type === 'rural' ? <Trees className="h-4 w-4 mr-2 text-green-500"/> : <Map className="h-4 w-4 mr-2 text-blue-500"/>}
                                        <p className="font-semibold">{t.number} - {t.name}</p>
                                    </div>
                                    <p className={`text-xs font-medium px-2 py-1 rounded-full ${
                                        t.status === 'designado' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'
                                    }`}>
                                        {t.assignment?.name || 'Disponível'}
                                    </p>
                                </div>
                            </Link>
                        ))
                    ) : (
                        <p className="text-muted-foreground text-center py-8">Nenhum território encontrado para esta categoria.</p>
                    )}
                </div>
                <div className="flex justify-end mt-6">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            Fechar
                        </Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}

