"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUser } from "@/contexts/UserContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, ShieldCheck, User as UserIcon, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Dirigente' | 'Publicador';
  status: 'ativo' | 'pendente' | 'rejeitado';
}

export default function UsersPage() {
  const { user: currentUser } = useUser();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.congregationId) {
      setLoading(false);
      return;
    }

    const usersRef = collection(db, "users");
    const q = query(usersRef, where("congregationId", "==", currentUser.congregationId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData));
      // Ordena para mostrar pendentes primeiro
      fetchedUsers.sort((a, b) => {
        if (a.status === 'pendente' && b.status !== 'pendente') return -1;
        if (a.status !== 'pendente' && b.status === 'pendente') return 1;
        return a.name.localeCompare(b.name);
      });
      setUsers(fetchedUsers);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleUpdateUser = async (userId: string, data: Partial<UserData>) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ativo':
        return <Badge variant="secondary">Ativo</Badge>;
      case 'pendente':
        return <Badge variant="default" className="bg-yellow-500 text-white"><Clock className="mr-2 h-4 w-4" />Pendente</Badge>;
      case 'rejeitado':
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  if (loading) {
    return <div className="text-center py-10">Carregando usuários...</div>;
  }

  return (
    <div className="flex-1 space-y-4 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight font-headline">Gerenciamento de Usuários</h2>
        {/* Futuro botão de adicionar usuário manualmente */}
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Permissão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className={cn(user.status === 'pendente' && 'bg-yellow-500/10 hover:bg-yellow-500/20')}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-bold">{user.name}</span>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(user.role === 'Administrador' ? 'text-primary border-primary/40 bg-primary/10' : 'text-muted-foreground')}>
                    {user.role === 'Administrador' ? <ShieldCheck className="mr-2 h-4 w-4" /> : <UserIcon className="mr-2 h-4 w-4" />}
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>{getStatusBadge(user.status)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Menu de ações</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      {user.status === 'pendente' && (
                        <>
                          <DropdownMenuItem onSelect={() => handleUpdateUser(user.id, { status: 'ativo' })}>Aprovar Acesso</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleUpdateUser(user.id, { status: 'rejeitado' })}>Rejeitar Acesso</DropdownMenuItem>
                        </>
                      )}
                      {user.status === 'ativo' && user.id !== currentUser?.id && (
                         <>
                          <DropdownMenuItem onSelect={() => handleUpdateUser(user.id, { role: 'Dirigente' })} disabled={user.role === 'Dirigente'}>Promover a Dirigente</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleUpdateUser(user.id, { role: 'Publicador' })} disabled={user.role === 'Publicador'}>Remover como Dirigente</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-500" onSelect={() => handleUpdateUser(user.id, { status: 'rejeitado' })}>Revogar Acesso</DropdownMenuItem>
                         </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
