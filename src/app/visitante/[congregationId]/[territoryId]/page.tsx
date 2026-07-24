"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, collection, query, orderBy } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { Territory, Quadra } from "@/types/types";
import { LayoutGrid, Map, FileImage, BarChart, UserCheck, Edit2, Loader, ArrowLeft, Navigation } from "lucide-react";
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleMapEmbed } from "@/components/GoogleMapEmbed";
import { useToast } from "@/hooks/use-toast";
import ImagePreviewModal from "@/components/ImagePreviewModal";
import QuadraListItem from "@/components/QuadraListItem";

export default function VisitorTerritoryPage() {
  const params = useParams();
  const congregationId = params.congregationId as string;
  const territoryId = params.territoryId as string;

  const [territory, setTerritory] = useState<Territory | null>(null);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [visitorName, setVisitorName] = useState("");
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tempName, setTempName] = useState("");
  
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    if (auth.currentUser?.isAnonymous) {
      auth.currentUser.delete().catch(() => {});
    }

    const storedName = localStorage.getItem(`visitor_name_${congregationId}_${territoryId}`);
    if (storedName) {
      setVisitorName(storedName);
    } else {
      setIsNameModalOpen(true);
    }
  }, [congregationId, territoryId]);

  useEffect(() => {
    if (!congregationId || !territoryId) return;

    const territoryRef = doc(db, 'congregations', congregationId, 'territories', territoryId);
    
    const unsubTerritory = onSnapshot(territoryRef, (docSnap) => {
      if (docSnap.exists()) {
        setTerritory({ id: docSnap.id, ...docSnap.data() } as Territory);
      } else {
        setTerritory(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar território:", error);
      setLoading(false);
    });

    const quadrasQuery = query(collection(territoryRef, 'quadras'), orderBy('name', 'asc'));
    const unsubQuadras = onSnapshot(quadrasQuery, (snapshot) => {
      const qList = snapshot.docs.map(qDoc => ({ ...qDoc.data(), id: qDoc.id } as Quadra));
      setQuadras(qList);
    });

    return () => {
      unsubTerritory();
      unsubQuadras();
    };
  }, [congregationId, territoryId]);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim()) {
      toast({ title: "Nome obrigatório", description: "Por favor, digite seu nome para continuar.", variant: "destructive" });
      return;
    }
    const trimmed = tempName.trim();
    localStorage.setItem(`visitor_name_${congregationId}_${territoryId}`, trimmed);
    setVisitorName(trimmed);
    setIsNameModalOpen(false);
    toast({ title: `Bem-vindo(a), ${trimmed}!`, description: "Você já pode acessar e marcar as casas deste território." });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando território para visitante...</p>
        </div>
      </div>
    );
  }

  if (!territory) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Território não encontrado</h1>
          <p className="text-muted-foreground">O link pode estar incorreto ou o território foi removido.</p>
        </div>
      </div>
    );
  }

  const totalHouses = territory.stats?.totalHouses || 0;
  const housesDone = territory.stats?.housesDone || 0;
  const progressPercentage = territory.progress ? Math.round(territory.progress * 100) : 0;

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Top Visitor Banner */}
      <div className="bg-primary text-primary-foreground py-3 px-4 shadow-md sticky top-0 z-20 flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          <span className="text-sm font-medium">
            Modo Visitante — Território {territory.number}: <strong>{territory.name}</strong>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-primary-foreground/20 px-3 py-1 rounded-full font-semibold">
            Visitante: {visitorName || "Convidado"}
          </span>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => { setTempName(visitorName); setIsNameModalOpen(true); }}
            className="h-7 text-xs"
          >
            <Edit2 className="h-3 w-3 mr-1" /> Alterar Nome
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
        {/* Territory Header */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold">{territory.number} - {territory.name}</h1>
            <p className="text-muted-foreground mt-1">{territory.description || "Sem observações adicionais."}</p>
          </div>
        </div>

        {/* Quadras List Section */}
        <div className="bg-card p-6 rounded-lg shadow-md border border-border">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold flex items-center"><LayoutGrid className="mr-3 text-primary" />Quadras</h2>
          </div>
          <div className="divide-y divide-border -mx-6 px-6">
            {quadras.map(q => (
              <Link key={q.id} href={`/visitante/${congregationId}/${territoryId}/quadras/${q.id}`} className="block">
                <QuadraListItem quadra={q} />
              </Link>
            ))}
            {quadras.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma quadra cadastrada neste território.</p>
            )}
          </div>
        </div>

        {/* Territory Card Image */}
        {territory.cardUrl && (
          <div className="bg-card p-6 rounded-lg shadow-md border border-border">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-3">
              <FileImage className="text-primary" />
              Cartão do Território
            </h2>
            <div 
              className="cursor-pointer overflow-hidden rounded-lg border border-border/50 hover:opacity-90 transition-opacity"
              onClick={() => { setSelectedImageUrl(territory.cardUrl!); setIsPreviewModalOpen(true); }}
            >
              <img 
                src={territory.cardUrl} 
                alt="Cartão do Mapa" 
                className="w-full h-auto max-h-[400px] object-contain mx-auto"
              />
            </div>
          </div>
        )}

        {/* Territory Map */}
        {territory.mapLink && (
          <div className="bg-card p-6 rounded-lg shadow-md border border-border">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <Map className="text-primary" />
                Mapa do Território
              </h2>
              <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                <a href={territory.mapLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                  <Navigation size={14} className="text-blue-500" />
                  <span>Usar GPS (Abrir App)</span>
                </a>
              </Button>
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-border/50 bg-muted">
              <GoogleMapEmbed mapLink={territory.mapLink} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Dica: Para ver sua localização em tempo real sobre o mapa, clique no botão acima e use o app oficial do Google Maps.
            </p>
          </div>
        )}

        {/* Progress Card */}
        <div className="bg-card p-6 rounded-lg shadow-md border border-border">
          <h2 className="text-xl font-bold mb-4 flex items-center"><BarChart className="mr-3 text-primary" />Progresso Geral</h2>
          <div className="grid grid-cols-4 gap-1 sm:gap-4 text-center">
            <div><p className="text-xs sm:text-sm text-muted-foreground">Total</p><p className="font-bold text-lg sm:text-2xl">{totalHouses}</p></div>
            <div><p className="text-xs sm:text-sm text-muted-foreground">Feitas</p><p className="font-bold text-lg sm:text-2xl text-green-400">{housesDone}</p></div>
            <div><p className="text-xs sm:text-sm text-muted-foreground">Pendentes</p><p className="font-bold text-lg sm:text-2xl text-yellow-400">{totalHouses - housesDone}</p></div>
            <div><p className="text-xs sm:text-sm text-muted-foreground">Progresso</p><p className="font-bold text-lg sm:text-2xl text-blue-400">{progressPercentage}%</p></div>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5 mt-4">
            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progressPercentage}%` }}></div>
          </div>
        </div>
      </div>

      {/* Name Input Modal */}
      <Dialog open={isNameModalOpen} onOpenChange={(open) => { if (visitorName) setIsNameModalOpen(open); }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => { if (!visitorName) e.preventDefault(); }}>
          <form onSubmit={handleSaveName}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <UserCheck className="text-primary h-6 w-6" />
                Identificação do Visitante
              </DialogTitle>
              <DialogDescription>
                Para ajudar no registro das casas trabalhadas, por favor digite seu nome completo ou apelido. Não é necessário cadastro.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="visitor-name">Seu Nome</Label>
                <Input
                  id="visitor-name"
                  placeholder="Ex: João da Silva"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full">
                Entrar no Território
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImagePreviewModal 
        isOpen={isPreviewModalOpen} 
        onClose={() => setIsPreviewModalOpen(false)} 
        imageUrl={selectedImageUrl} 
      />
    </div>
  );
}

