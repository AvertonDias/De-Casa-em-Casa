"use client";

import { Lock } from 'lucide-react';

interface RestrictedContentProps {
  title: string;
  message: string;
}

export function RestrictedContent({ title, message }: RestrictedContentProps) {
  return (
    <div className="text-center mt-16 p-6 bg-white dark:bg-[#2a2736] rounded-lg">
      <Lock size={56} className="mx-auto text-purple-400" />
      <h2 className="mt-4 text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
