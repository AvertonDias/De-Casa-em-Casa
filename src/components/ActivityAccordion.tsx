
"use client";

import { Disclosure, Transition } from '@headlessui/react';
import { ChevronUp, History } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ActivityLog {
  id: string;
  userName: string;
  details: { quadraName: string; houseNumber: string; };
  timestamp: Timestamp;
}

interface ActivityAccordionProps {
  congregationId: string;
  territoryId: string;
}

export function ActivityAccordion({ congregationId, territoryId }: ActivityAccordionProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!congregationId || !territoryId) return;

    setLoading(true);
    const logsRef = collection(db, `congregations/${congregationId}/territories/${territoryId}/activity_logs`);
    const q = query(logsRef, orderBy("timestamp", "desc"), limit(25));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ActivityLog));
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar logs de atividade:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [congregationId, territoryId]);

  return (
    <div className="w-full">
      <div className="w-full rounded-2xl bg-white dark:bg-[#2f2b3a] p-2 shadow-lg">
        <Disclosure>
          {({ open }) => (
            <>
              <Disclosure.Button className="flex w-full justify-between items-center rounded-lg bg-purple-100 dark:bg-purple-900/50 px-4 py-3 text-left text-sm font-medium text-purple-900 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-900/70 focus:outline-none focus-visible:ring focus-visible:ring-purple-500/75">
                <div className="flex items-center">
                  <History className="mr-2" size={18}/>
                  <span>Ver Histórico de Atividade ({logs.length})</span>
                </div>
                <ChevronUp className={`${open ? 'rotate-180 transform' : ''} h-5 w-5 text-purple-500 transition-transform`} />
              </Disclosure.Button>
              <Transition
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
              >
                <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-gray-600 dark:text-gray-300 max-h-72 overflow-y-auto">
                   {loading ? (
                     <p>Carregando histórico...</p>
                   ) : logs.length > 0 ? (
                        <ul className="space-y-3 border-l-2 border-purple-200 dark:border-purple-800/50 pl-4">
                            {logs.map(log => (
                                <li key={log.id} className="relative">
                                  <div className="absolute -left-[22px] top-1 h-3 w-3 rounded-full bg-purple-400 dark:bg-purple-600 ring-4 ring-white dark:ring-[#2f2b3a]"></div>
                                   <p className="leading-tight">
                                      <span className="font-semibold text-purple-700 dark:text-purple-300">{log.userName}</span> concluiu a casa <span className="font-bold text-gray-800 dark:text-gray-100">{log.details.houseNumber}</span> na {log.details.quadraName}.
                                   </p>
                                   <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                    {log.timestamp ? formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true, locale: ptBR }) : 'agora mesmo'}
                                   </span>
                                </li>
                            ))}
                        </ul>
                   ) : (
                        <p className="text-center py-4">Nenhuma atividade registrada para este território ainda.</p>
                   )}
                </Disclosure.Panel>
              </Transition>
            </>
          )}
        </Disclosure>
      </div>
    </div>
  );
}
