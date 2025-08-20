import { useState } from "react";
import NavigationSidebar from "./NavigationSidebar";
import { Button } from "@/components/ui/button";
import { useMarketData } from "@/hooks/useMarketData";
import { Bell, RefreshCw, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TradingDashboardProps {
  children: React.ReactNode;
}

export default function TradingDashboard({ children }: TradingDashboardProps) {
  const [currentPage, setCurrentPage] = useState("Dashboard");
  const { data: marketStatus } = useMarketData();
  const { toast } = useToast();

  const handleSyncData = async () => {
    toast({
      title: "Syncing Data",
      description: "Updating market data and positions...",
    });
    // API call would be made here
    setTimeout(() => {
      toast({
        title: "Data Synced",
        description: "Market data has been updated successfully.",
      });
    }, 2000);
  };

  const handleNewSignal = () => {
    toast({
      title: "Signal Generation",
      description: "Starting new signal generation process...",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-trading-dark via-gray-900 to-trading-dark">
      <NavigationSidebar onPageChange={setCurrentPage} />
      
      <main className="ml-72 min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-trading-card/80 backdrop-blur-xl border-b border-trading-border">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <h2 className="text-2xl font-bold">{currentPage}</h2>
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${
                      marketStatus?.isOpen ? 'bg-success-green' : 'bg-danger-red'
                    }`}></div>
                    <span className={marketStatus?.isOpen ? 'text-success-green' : 'text-danger-red'}>
                      {marketStatus?.isOpen ? 'Market Open' : 'Market Closed'}
                    </span>
                  </div>
                  <div className="text-gray-400">|</div>
                  <div className="text-gray-300">
                    {new Date().toLocaleTimeString('en-US', {
                      timeZone: 'America/New_York',
                      hour12: false
                    })} EST
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSyncData}
                  className="bg-accent-blue/20 text-accent-blue border-accent-blue/30 hover:bg-accent-blue/30"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync Data
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleNewSignal}
                  className="bg-success-green/20 text-success-green border-success-green/30 hover:bg-success-green/30"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Signal
                </Button>
                
                <div className="flex items-center space-x-2 text-sm">
                  <Bell className="w-4 h-4 text-gray-400" />
                  <span className="bg-danger-red text-white text-xs px-2 py-1 rounded-full">3</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
