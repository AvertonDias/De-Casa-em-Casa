"use client";

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';

interface ClientDateTimeProps {
  date?: any;
  formatStr?: string;
  formatString?: string;
  fallback?: string;
  className?: string;
}

export default function ClientDateTime({
  date,
  formatStr,
  formatString,
  fallback = "—",
  className,
}: ClientDateTimeProps) {
  const activeFormat = formatString || formatStr || "dd/MM/yyyy 'às' hh:mm a";
  const [formatted, setFormatted] = useState<string>('');

  useEffect(() => {
    if (!date) {
      setFormatted(fallback);
      return;
    }

    try {
      let d: Date;
      if (date instanceof Timestamp) {
        d = date.toDate();
      } else if (date && typeof date === 'object' && 'seconds' in date && typeof (date as any).seconds === 'number') {
        d = new Date((date as any).seconds * 1000);
      } else if (date instanceof Date) {
        d = date;
      } else {
        d = new Date(date);
      }

      if (isNaN(d.getTime())) {
        setFormatted(fallback);
      } else {
        setFormatted(format(d, activeFormat, { locale: ptBR }));
      }
    } catch {
      setFormatted(fallback);
    }
  }, [date, activeFormat, fallback]);

  if (!formatted) {
    return <span className={className}>{fallback}</span>;
  }

  return <span className={className}>{formatted}</span>;
}
