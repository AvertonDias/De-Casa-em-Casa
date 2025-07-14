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
    <div className="bg-white dark:bg-[#2a2736] p-6 rounded-lg shadow-md flex items-center">
      <div className="bg-purple-600/20 text-purple-500 p-3 rounded-full mr-4">
        <Icon size={24} />
      </div>
      <div>
        <h3 className="text-gray-500 dark:text-gray-400 text-base font-medium">{title}</h3>
        {loading ? (
          <div className="h-8 w-16 bg-gray-300 dark:bg-gray-600 rounded-md animate-pulse mt-1"></div>
        ) : (
          <p className="text-3xl font-bold text-gray-800 dark:text-white">{value}</p>
        )}
      </div>
    </div>
  );
}
