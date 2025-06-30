"use client";
import { useEffect, useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { AlertTriangle, MessageSquare, Loader } from 'lucide-react';

interface AdminContact {
  name: string;
  phone: string;
}

export default function PendingAccessBanner() {
  const { user } = useUser();
  const [admins, setAdmins] = useState<AdminContact[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);

  useEffect(() => {
    if (user && user.status === 'pendente') {
      const getAdmins = httpsCallable(functions, 'getCongregationAdmins');
      
      getAdmins()
        .then((result) => {
          const data = result.data as { admins: AdminContact[] };
          setAdmins(data.admins);
        })
        .catch((error) => {
          console.error("Erro ao chamar a Cloud Function 'getCongregationAdmins':", error);
        })
        .finally(() => {
          setLoadingAdmins(false);
        });
    }
  }, [user]);

  if (!user || user.status !== 'pendente') {
    return null;
  }
  
  const handleWhatsAppClick = (phone: string) => {
      const message = encodeURIComponent(`Olá! Sou ${user.name} e gostaria de solicitar a aprovação do meu acesso no painel "De Casa em Casa".`);
      const cleanPhone = phone.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  return (
    <div className="bg-yellow-500/20 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 p-4 mb-6 rounded-md shadow-lg" role="alert">
      <div className="flex items-start">
        <AlertTriangle className="h-6 w-6 text-yellow-500 mr-3" />
        <div className="flex-1">
          <p className="font-bold">Seu acesso está pendente de aprovação!</p>
          <p className="text-sm">Para usar todas as funcionalidades, incluindo o acesso aos territórios, por favor, envie uma mensagem para um dos administradores da sua congregação pedindo a liberação:</p>
          
          {loadingAdmins ? (
            <div className="flex items-center mt-2"><Loader className="animate-spin mr-2" size={16}/><span>Carregando contatos...</span></div>
          ) : (
            admins.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                {admins.map((admin, index) => (
                    <button key={index} onClick={() => handleWhatsAppClick(admin.phone)} className="flex items-center px-3 py-1 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors text-sm"><MessageSquare size={16} className="mr-2"/>Enviar WhatsApp para {admin.name}</button>
                ))}
                </div>
            ) : (
                <p className="text-sm font-semibold mt-2">Nenhum contato de administrador encontrado.</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}