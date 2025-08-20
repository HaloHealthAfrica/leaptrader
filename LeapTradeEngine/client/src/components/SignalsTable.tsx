import { Button } from "@/components/ui/button";
import { Eye, MoreVertical } from "lucide-react";

interface SignalData {
  id: string;
  symbol: string;
  strategy: string;
  entryPrice?: string;
  currentPrice?: string;
  targetPrice?: string;
  stopPrice?: string;
  expirationDate?: Date;
  delta?: string;
  impliedVolatility?: string;
  confidence?: string;
  status: string;
  pnl?: string;
  pnlPercent?: string;
}

interface SignalsTableProps {
  signals: SignalData[];
  title: string;
}

export default function SignalsTable({ signals, title }: SignalsTableProps) {
  const formatCurrency = (value: string | undefined) => {
    if (!value) return "-";
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(value));
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "status-active";
      case "monitoring":
        return "status-monitoring";
      case "closed":
        return "status-closed";
      default:
        return "bg-muted/20 text-muted-foreground border border-muted/30";
    }
  };

  const getPnLClass = (pnl: string | undefined) => {
    if (!pnl) return "";
    const value = parseFloat(pnl);
    return value >= 0 ? "text-success-green" : "text-danger-red";
  };

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">Real-time trading opportunities and positions</p>
        </div>
        <Button className="bg-accent-blue/20 text-accent-blue hover:bg-accent-blue/30 border border-accent-blue/30">
          Filter Signals
        </Button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="trading-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Strategy</th>
              <th>Entry/Current</th>
              <th>Target/Stop</th>
              <th>P&L</th>
              <th>Delta</th>
              <th>Expiry</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => (
              <tr key={signal.id}>
                <td>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-accent-blue to-accent-purple rounded-lg flex items-center justify-center text-xs font-bold">
                      {signal.symbol.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium">{signal.symbol}</div>
                      <div className="text-xs text-muted-foreground">NASDAQ</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="px-2 py-1 bg-accent-blue/20 text-accent-blue text-xs rounded-full border border-accent-blue/30">
                    {signal.strategy}
                  </span>
                </td>
                <td>
                  <div className="text-sm">
                    <div className="font-medium">{formatCurrency(signal.entryPrice)}</div>
                    <div className={getPnLClass(signal.currentPrice)}>{formatCurrency(signal.currentPrice)}</div>
                  </div>
                </td>
                <td>
                  <div className="text-sm">
                    <div className="text-success-green">{formatCurrency(signal.targetPrice)}</div>
                    <div className="text-danger-red">{formatCurrency(signal.stopPrice)}</div>
                  </div>
                </td>
                <td>
                  <div className={`font-medium ${getPnLClass(signal.pnl)}`}>
                    {formatCurrency(signal.pnl)}
                  </div>
                  <div className={`text-xs ${getPnLClass(signal.pnl)}`}>
                    {signal.pnlPercent ? `${signal.pnlPercent}%` : "-"}
                  </div>
                </td>
                <td>
                  <div className="text-sm font-medium">{signal.delta || "-"}</div>
                </td>
                <td>
                  <div className="text-sm">{formatDate(signal.expirationDate)}</div>
                  <div className="text-xs text-muted-foreground">
                    {signal.expirationDate ? 
                      `${Math.ceil((new Date(signal.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d` 
                      : "-"}
                  </div>
                </td>
                <td>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusClass(signal.status)}`}>
                    {signal.status}
                  </span>
                </td>
                <td>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
