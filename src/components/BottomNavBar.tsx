import React from 'react';
import { Home, Calculator, Users, Package, BarChart3, Lock } from 'lucide-react';
import { NavigationTarget } from './NavigationDrawer';
import { securityService } from '../services/securityService';

interface BottomNavBarProps {
  currentRoute: NavigationTarget;
  onSelectRoute: (target: NavigationTarget) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentRoute,
  onSelectRoute,
}) => {
  const primaryTabs = [
    { target: 'HOME' as NavigationTarget, label: 'Home', icon: Home },
    { target: 'BILLING' as NavigationTarget, label: 'Quick Bill', icon: Calculator },
    { target: 'CUSTOMERS' as NavigationTarget, label: 'Customers', icon: Users },
    { target: 'INVENTORY' as NavigationTarget, label: 'Inventory', icon: Package },
    { target: 'REPORTS' as NavigationTarget, label: 'Reports', icon: BarChart3 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#16161C] border-t border-[#2A2A36] px-2 py-1.5 shadow-lg">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {primaryTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentRoute === tab.target;
          const accessCheck = securityService.canAccessRoute(tab.target);
          const isRestricted = !accessCheck.allowed;

          return (
            <button
              key={tab.target}
              id={`tab-nav-${tab.target.toLowerCase()}`}
              onClick={() => onSelectRoute(tab.target)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
                isActive
                  ? 'text-orange-400 bg-orange-500/15 font-semibold'
                  : isRestricted
                  ? 'text-gray-400 hover:text-gray-200 opacity-60'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-orange-400 scale-105' : 'text-gray-400'}`} />
                {isRestricted && (
                  <div className="absolute -top-1 -right-1 bg-[#1A1A22] rounded-full p-0.5 border border-[#3E3E50]">
                    <Lock className="w-2.5 h-2.5 text-gray-400" />
                  </div>
                )}
              </div>
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

