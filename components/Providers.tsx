'use client';
import { SessionProvider } from 'next-auth/react';
import { AdminProvider } from '@/context/AdminContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AdminProvider>
        {children}
      </AdminProvider>
    </SessionProvider>
  );
}