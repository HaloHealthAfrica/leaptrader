import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  PieChart, 
  Brain, 
  Zap, 
  Briefcase, 
  Shield, 
  Play, 
  Search, 
  Monitor, 
  Settings, 
  HelpCircle,
  LogOut,
  TrendingUp
} from "lucide-react";

interface NavigationSidebarProps {
  onPageChange: (page: string) => void;
}

const navigationItems = [
  { path: "/", icon: PieChart, label: "Dashboard", section: "dashboard" },
  { path: "/strategies", icon: Brain, label: "Strategies", section: "strategies" },
  { path: "/signals", icon: Zap, label: "Active Signals", section: "signals" },
  { path: "/portfolio", icon: Briefcase, label: "Portfolio", section: "portfolio" },
  { path: "/risk", icon: Shield, label: "Risk Management", section: "risk" },
  { path: "/execution", icon: Play, label: "Order Execution", section: "execution" },
  { path: "/screening", icon: Search, label: "Market Screening", section: "screening" },
  { path: "/monitoring", icon: Monitor, label: "System Monitor", section: "monitoring" },
];

const secondaryItems = [
  { path: "/settings", icon: Settings, label: "Settings" },
  { path: "/help", icon: HelpCircle, label: "Help & Docs" },
];

export default function NavigationSidebar({ onPageChange }: NavigationSidebarProps) {
  const location = useLocation();

  const handlePageChange = (label: string) => {
    onPageChange(label);
  };

  return (
    <nav className="fixed left-0 top-0 h-full w-72 bg-trading-card/80 backdrop-blur-xl border-r border-trading-border z-40">
      {/* Logo Header */}
      <div className="p-6 border-b border-trading-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-accent-blue to-accent-purple rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">
              LEAP Engine
            </h1>
            <p className="text-xs text-gray-400">Options Trading Platform</p>
          </div>
        </div>
      </div>
      
      {/* Main Navigation */}
      <div className="px-4 py-6">
        <div className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handlePageChange(item.label)}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
        
        {/* Secondary Navigation */}
        <div className="pt-6 mt-6 border-t border-trading-border">
          <div className="space-y-2">
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="nav-item"
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* User Profile */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-trading-border bg-trading-card/60">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-success-green to-accent-blue rounded-full flex items-center justify-center">
            <span className="text-sm font-bold">JD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">John Doe</p>
            <p className="text-xs text-gray-400">Senior Trader</p>
          </div>
          <button className="text-gray-400 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
