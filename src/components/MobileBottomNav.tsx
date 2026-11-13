import React from 'react';
import { Home, Compass, Library, Heart, ShieldCheck, Mic2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';

interface MobileBottomNavProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  onOpenMobileDrawer?: () => void;
}

interface NavTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  setCurrentView,
  onOpenMobileDrawer
}) => {
  const { likedTrackIds } = usePlayer();
  const { isAdmin } = useAuth();

  const baseTabs: NavTab[] = [
    { id: 'home', label: 'Trang chủ', icon: Home },
    { id: 'artists', label: 'Nghệ sĩ', icon: Mic2 },
    { id: 'explore', label: 'Khám phá', icon: Compass },
    { id: 'library', label: 'Thư viện', icon: Library },
  ];

  const tabs: NavTab[] = isAdmin
    ? [
        ...baseTabs,
        { id: 'admin', label: 'Quản trị', icon: ShieldCheck }
      ]
    : [
        ...baseTabs,
        { id: 'liked', label: 'Đã thích', icon: Heart, badge: likedTrackIds.length }
      ];

  const handleTabClick = (tabId: string) => {
    if (tabId === 'library' && onOpenMobileDrawer) {
      onOpenMobileDrawer();
    } else {
      setCurrentView(tabId);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#070b1a]/95 backdrop-blur-md border-t border-[#1e2a54] h-16 flex items-center justify-around px-1 md:hidden select-none shadow-2xl">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive =
          currentView === tab.id ||
          (tab.id === 'artists' && currentView === 'artist-detail');

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center relative transition-colors ${
              isActive ? 'text-[#f7f5f0]' : 'text-[#6e7ba8] hover:text-[#a3aed0]'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#f47b64]' : ''} ${tab.id === 'admin' ? 'text-[#f47b64]' : ''}`} />
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -top-1 -right-2 px-1 text-[9px] font-black bg-[#f47b64] text-[#070b1a] rounded-full min-w-3.5 h-3.5 flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] tracking-tight mt-1 ${isActive ? 'font-bold text-[#f7f5f0]' : 'font-medium'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
