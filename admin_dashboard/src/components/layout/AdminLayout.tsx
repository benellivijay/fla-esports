'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

interface LayoutContextType {
  isMobileSidebarOpen: boolean;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
}

const LayoutContext = createContext<LayoutContextType>({
  isMobileSidebarOpen: false,
  toggleMobileSidebar: () => {},
  closeMobileSidebar: () => {},
});

export const useLayout = () => useContext(LayoutContext);

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Auto-close mobile sidebar whenever page changes
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [pathname]);

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

  const toggleMobileSidebar = () => setIsMobileSidebarOpen((prev) => !prev);
  const closeMobileSidebar = () => setIsMobileSidebarOpen(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <LayoutContext.Provider value={{ isMobileSidebarOpen, toggleMobileSidebar, closeMobileSidebar }}>
      <div className="min-h-screen bg-[#F8FAFC]">
        {/* Backdrop overlay for mobile drawer */}
        {isMobileSidebarOpen && (
          <div
            onClick={closeMobileSidebar}
            className="fixed inset-0 bg-slate-950/60 z-40 backdrop-blur-xs transition-opacity lg:hidden"
            aria-hidden="true"
          />
        )}

        {/* Sidebar (Permanent on desktop lg:, sliding drawer on mobile) */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="lg:pl-64 flex flex-col min-h-screen transition-all duration-200">
          <main className="flex-1 p-3 sm:p-5 lg:p-8 max-w-full overflow-x-hidden">{children}</main>
        </div>
      </div>
    </LayoutContext.Provider>
  );
};
