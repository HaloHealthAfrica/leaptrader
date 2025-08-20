import { 
  BarChart3, 
  Brain, 
  Zap, 
  Briefcase, 
  Shield, 
  Play, 
  Search, 
  Monitor,
  Settings,
  HelpCircle,
  LogOut
} from "lucide-react";

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navigationItems = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "strategies", label: "Strategies", icon: Brain },
  { id: "signals", label: "Active Signals", icon: Zap },
  { id: "portfolio", label: "Portfolio", icon: Briefcase },
  { id: "risk", label: "Risk Management", icon: Shield },
  { id: "execution", label: "Order Execution", icon: Play },
  { id: "screening", label: "Market Screening", icon: Search },
  { id: "monitoring", label: "System Monitor", icon: Monitor },
];

export default function Navigation({ activeSection, onSectionChange }: NavigationProps) {
  return (
    <nav className="fixed left-0 top-0 h-full w-72 bg-black/80 backdrop-blur-xl border-r border-white/10 z-40">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              LEAP Engine
            </h1>
            <p className="text-xs text-gray-400">Options Trading Platform</p>
          </div>
        </div>
      </div>
      
      <div className="px-4 py-6">
        <div className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                  isActive
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "text-gray-400 hover:bg-white/10 hover:text-white hover:translate-x-1"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-2 h-2 bg-blue-400 rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>
        
        <div className="pt-6 mt-6 border-t border-white/10">
          <div className="space-y-2">
            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left text-gray-400 hover:bg-white/10 hover:text-white transition-all duration-200">
              <Settings className="h-5 w-5" />
              <span className="font-medium">Settings</span>
            </button>
            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left text-gray-400 hover:bg-white/10 hover:text-white transition-all duration-200">
              <HelpCircle className="h-5 w-5" />
              <span className="font-medium">Help & Docs</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* User Profile */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-black/60">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-white">JD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">John Doe</p>
            <p className="text-xs text-gray-400">Senior Trader</p>
          </div>
          <button className="text-gray-400 hover:text-white transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
