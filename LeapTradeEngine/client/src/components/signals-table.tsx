import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Signal } from "@shared/schema";
import { Filter, MoreVertical } from "lucide-react";

interface SignalsTableProps {
  signals: Signal[];
}

export default function SignalsTable({ signals }: SignalsTableProps) {
  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(numValue);
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffTime = dateObj.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      formatted: dateObj.toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      }),
      daysRemaining: `${diffDays}d`
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-600/20 text-green-400 border-green-500/30";
      case "monitoring":
        return "bg-orange-600/20 text-orange-400 border-orange-500/30";
      case "closed":
        return "bg-gray-600/20 text-gray-400 border-gray-500/30";
      default:
        return "bg-blue-600/20 text-blue-400 border-blue-500/30";
    }
  };

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case "Stock Replacement":
        return "bg-blue-600/20 text-blue-400 border-blue-500/30";
      case "Covered Call":
        return "bg-purple-600/20 text-purple-400 border-purple-500/30";
      case "Protective Put":
        return "bg-green-600/20 text-green-400 border-green-500/30";
      case "Iron Condor":
        return "bg-orange-600/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-gray-600/20 text-gray-400 border-gray-500/30";
    }
  };

  const getSymbolColor = (symbol: string) => {
    const colors = [
      "from-blue-500 to-purple-500",
      "from-red-500 to-orange-500",
      "from-green-500 to-blue-500",
      "from-purple-500 to-pink-500",
      "from-orange-500 to-red-500"
    ];
    const index = symbol.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <Card className="glass-card border-0">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
        <div>
          <CardTitle className="text-xl font-bold text-white">Active LEAPS Signals</CardTitle>
          <p className="text-sm text-gray-400 mt-1">Real-time trading opportunities and positions</p>
        </div>
        <Button className="bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600/30">
          <Filter className="h-4 w-4 mr-2" />
          Filter Signals
        </Button>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-400">Symbol</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-400">Strategy</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-400">Entry/Current</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-400">Target/Stop</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-400">P&L</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-400">Delta</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-400">Expiry</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-400">Status</th>
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {signals.map((signal) => {
                const pnl = parseFloat(signal.pnl || "0");
                const isProfitable = pnl > 0;
                const expiryInfo = formatDate(signal.expiryDate);

                return (
                  <tr key={signal.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 bg-gradient-to-br ${getSymbolColor(signal.symbol)} rounded-lg flex items-center justify-center text-xs font-bold text-white`}>
                          {signal.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-medium text-white">{signal.symbol}</div>
                          <div className="text-xs text-gray-400">NASDAQ</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 text-xs rounded-full border ${getStrategyColor(signal.strategy)}`}>
                        {signal.strategy}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className="font-medium text-white">{formatCurrency(signal.entryPrice)}</div>
                        <div className={isProfitable ? "text-green-400" : "text-red-400"}>
                          {signal.currentPrice ? formatCurrency(signal.currentPrice) : "N/A"}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className="text-green-400">{formatCurrency(signal.targetPrice)}</div>
                        <div className="text-red-400">{formatCurrency(signal.stopPrice)}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className={`font-medium ${isProfitable ? "text-green-400" : "text-red-400"}`}>
                        {isProfitable ? "+" : ""}{formatCurrency(pnl)}
                      </div>
                      <div className={`text-xs ${isProfitable ? "text-green-400" : "text-red-400"}`}>
                        {signal.entryPrice && pnl !== 0 ? 
                          `${isProfitable ? "+" : ""}${((pnl / parseFloat(signal.entryPrice)) * 100).toFixed(1)}%` 
                          : "0.0%"
                        }
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm font-medium text-white">
                        {signal.delta || "N/A"}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-white">{expiryInfo.formatted}</div>
                      <div className="text-xs text-gray-400">{expiryInfo.daysRemaining}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 text-xs rounded-full border capitalize ${getStatusColor(signal.status)}`}>
                        {signal.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button className="text-gray-400 hover:text-white transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {signals.length === 0 && (
            <div className="py-12 text-center">
              <div className="text-gray-400 text-lg font-medium">No active signals</div>
              <div className="text-gray-500 text-sm mt-1">Signals will appear here when generated</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
