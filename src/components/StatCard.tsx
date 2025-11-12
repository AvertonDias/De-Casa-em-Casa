
"use client";

import React from 'react';
import { Skeleton } from './ui/skeleton';
import { useUser } from '@/contexts/UserContext';
import { Congregation } from '@/types/types';

interface StatCardProps {
  icon: React.ElementType;
  title: string;
  statKey: keyof Congregation;
}

export function StatCard({ icon: Icon, title, statKey }: StatCardProps) {
  const { congregation, loading } = useUser();
  const value = congregation ? congregation[statKey] as number : 0;

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
          <p className="text-3xl font-bold text-foreground">{value ?? 0}</p>
        )}
      </div>
    </div>
  );
}
