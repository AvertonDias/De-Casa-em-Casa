"use client";

import React from 'react';

interface StatCardProps {
  icon: React.ElementType;
  title: string;
  value: number | string;
  loading: boolean;
}

export function StatCard({ icon: Icon, title, value, loading }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-[#2a2736] p-4 rounded-lg shadow-md flex items-center">
      <div className="bg-purple-600/20 text-purple-500 p-2 rounded-full mr-3">
        <Icon size={20} />
      </div>
      <div>
        <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{title}</h3>
        {loading ? (
          <div className="h-6 w-12 bg-gray-300 dark:bg-gray-600 rounded-md animate-pulse mt-1"></div>
        ) : (
          <p className="text-xl font-bold text-gray-800 dark:text-white">{value}</p>
        )}
      </div>
    </div>
  );
}
