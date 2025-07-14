"use client";

import { useState } from 'react';
import { Quadra } from '@/types/types';
import { LayoutGrid, Plus } from 'lucide-react';
import AddQuadraModal from '@/components/AddQuadraModal';
// ▼▼▼ CORREÇÃO APLICADA AQUI: Importamos com chaves, como o erro sugeriu ▼▼▼
import { EditQuadraModal } from '@/components/EditQuadraModal';
import QuadraCard from '@/components/QuadraCard';

interface QuadrasSectionProps {
  quadras: Quadra[];
  isManagerView: boolean;
  onAddQuadra: (data: { name: string, description: string }) => Promise<void>;
  onEditQuadra: (quadraId: string, data: { name: string, description: string }) => void;
  onNavigateToQuadra: (quadraId: string) => void;
  // Adicionamos a prop para a função de deletar, para passar ao EditQuadraModal
  onDeleteQuadra: (quadraId: string) => void; 
}

export default function QuadrasSection({ quadras, isManagerView, onAddQuadra, onEditQuadra, onNavigateToQuadra, onDeleteQuadra }: QuadrasSectionProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedQuadra, setSelectedQuadra] = useState<Quadra | null>(null);

  const getNextQuadraName = (): string => {
    const nextNumber = (quadras.length + 1).toString().padStart(2, '0');
    return `Quadra ${nextNumber}`;
  };
  
  const handleOpenEditModal = (quadra: Quadra) => {
      setSelectedQuadra(quadra);
  };
  
  const handleCloseModals = () => {
      setIsAddModalOpen(false);
      setSelectedQuadra(null);
  };
  
  const handleSaveEdit = (quadraId: string, data: { name: string, description: string }) => {
    if(!selectedQuadra) return;
    onEditQuadra(quadraId, data);
    handleCloseModals();
  };

  return (
    <>
      <div className="bg-card p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center"><LayoutGrid className="mr-3 text-primary" />Quadras</h2>
          {isManagerView && (
            <button onClick={() => setIsAddModalOpen(true)} className="bg-primary hover:bg-primary/80 text-white font-semibold py-2 px-4 rounded-md flex items-center">
                <Plus className="mr-2 h-4 w-4" /> Adicionar Quadra
            </button>
          )}
        </div>
        
        {quadras.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma quadra adicionada.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {quadras.map((quadra) => (
              <div key={quadra.id} onClick={() => onNavigateToQuadra(quadra.id)} className="cursor-pointer">
                <QuadraCard 
                    quadra={quadra} 
                    isManagerView={isManagerView}
                    onEdit={(e) => { e.stopPropagation(); handleOpenEditModal(quadra); }}
                 />
              </div>
            ))}
          </div>
        )}
      </div>

      <AddQuadraModal 
        isOpen={isAddModalOpen}
        onClose={handleCloseModals}
        onSave={onAddQuadra}
        existingQuadrasCount={quadras.length}
      />
      
      <EditQuadraModal 
        isOpen={!!selectedQuadra}
        onClose={handleCloseModals}
        quadra={selectedQuadra}
        onSave={handleSaveEdit}
        onDelete={onDeleteQuadra} // Passando a prop de exclusão
      />
    </>
  );
}
