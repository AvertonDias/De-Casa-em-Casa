
"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import withAuth from '@/components/withAuth';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Campaign } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Loader, FileText, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function NotificacoesPage() {
  const { user } = useUser();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('campaigns');

  useEffect(() => {
    if (!user?.congregationId) {
      if(user) setLoading(false);
      return;
    }
    const campaignsRef = collection(db, 'congregations', user.congregationId, 'campaigns');
    const q = query(campaignsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
      setCampaigns(data);
      setLoading(false);
    }, (error) => {
        console.error("Erro ao buscar campanhas: ", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredCampaigns = campaigns.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.body.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const getStatusVariant = (status: Campaign['status']) => {
    switch(status) {
        case 'ativa': return 'default';
        case 'concluída': return 'secondary';
        case 'agendada': return 'outline';
        default: return 'secondary';
    }
  }

  const TabButton = ({ id, label, icon: Icon }: { id: string, label: string, icon: React.ElementType }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`whitespace-nowrap px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
        <div>
            <h1 className="text-3xl font-bold">Notificações e Campanhas</h1>
            <p className="text-muted-foreground">Envie mensagens e avisos para os publicadores.</p>
        </div>

        <div className="border-b border-border overflow-x-auto">
            <div className="flex items-center">
                <TabButton id="campaigns" label="Campanhas" icon={FileText} />
                <TabButton id="reports" label="Relatórios" icon={BarChart2} />
            </div>
        </div>

        {activeTab === 'campaigns' && (
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                        <Input 
                            type="text" 
                            placeholder="Pesquisar pelo nome da campanha..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline">Novo experimento</Button>
                        <Button><PlusCircle size={16} className="mr-2"/> Nova campanha</Button>
                    </div>
                </div>

                <div className="bg-card rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">Campanha</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Início</TableHead>
                                <TableHead>Envios/Impressões</TableHead>
                                <TableHead>Cliques/Aberturas</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="text-center"><Loader className="mx-auto animate-spin"/></TableCell></TableRow>
                            ) : filteredCampaigns.length > 0 ? (
                                filteredCampaigns.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell>
                                            <p className="font-semibold">{c.title}</p>
                                            <p className="text-muted-foreground text-sm">{c.body}</p>
                                        </TableCell>
                                        <TableCell><Badge variant={getStatusVariant(c.status)}>{c.status.charAt(0).toUpperCase() + c.status.slice(1)}</Badge></TableCell>
                                        <TableCell>{format(c.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                                        <TableCell>{c.stats.sends.toLocaleString()}</TableCell>
                                        <TableCell>{((c.stats.clicks / c.stats.sends) * 100 || 0).toFixed(2)}%</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma campanha encontrada.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        )}
        
        {activeTab === 'reports' && (
            <div className="text-center p-10 bg-card rounded-lg">
                <BarChart2 size={48} className="mx-auto text-muted-foreground mb-4"/>
                <h2 className="text-xl font-semibold">Relatórios em Breve</h2>
                <p className="text-muted-foreground mt-2">
                  A área de relatórios de campanha está em desenvolvimento.
                </p>
            </div>
        )}
    </div>
  );
}

export default withAuth(NotificacoesPage);
