
"use client";

import React, { useState, useEffect } from 'react';
import { Skeleton } from './ui/skeleton';
import { useUser } from '@/contexts/UserContext';
import { Congregation } from '@/types/types';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface StatCardProps {
  icon: React.ElementType;
  title: string;
  statKey: keyof Congregation;
}

export function StatCard({ icon: Icon, title, statKey }: StatCardProps) {
  const { user } = useUser();
  const [value, setValue] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.congregationId) {
      setLoading(false);
      return;
    }

    const congRef = doc(db, 'congregations', user.congregationId);
    
    const unsubscribe = onSnapshot(congRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Congregation;
        const statValue = (data[statKey] as number) || 0;
        setValue(statValue);
      } else {
        setValue(0);
      }
      setLoading(false);
    }, (error) => {
      console.error(`Erro ao buscar stat ${statKey}:`, error);
      setLoading(false);
    });

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, [user, statKey]);

  return (
    <div className="bg-card p-6 rounded-lg shadow-md flex items-center">
      <div className="bg-primary/20 text-primary p-3 rounded-full mr-4">
        <Icon size={24} />
      </div>
      <div>
        <h3 className="text-muted-foreground text-base font-medium">{title}</h3>
        {loading ? (
          <Skeleton className="h-8 w-16 mt-1" />
        ) : (
          <p className="text-3xl font-bold text-foreground">{value}</p>
        )}
      </div>
    </div>
  );
}
