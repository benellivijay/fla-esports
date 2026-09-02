'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('admin_access_token');
      if (!token) {
        window.location.replace('/login/');
      } else {
        setIsAuthenticated(true);
        setLoading(false);
      }
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
};
