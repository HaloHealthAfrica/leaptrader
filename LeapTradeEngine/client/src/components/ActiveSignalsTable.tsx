import { useState } from "react";
import { useSignals } from "@/hooks/useSignals";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Filter, MoreVertical } from "lucide-react";
import { formatCurrency, formatPercentage, formatDate } from "@/utils/formatters";
import { getSymbolAvatar, getStrategyBadge, getStatusBadge } from "@/utils/formatters";

export default function ActiveSignalsTable() {
  const { data: signals = [], isLoading } = useSignals({ status: 'active' });
  const [filter, setFilter] = useState('all');

  if (isLoading) {
    return (
      <div className="glass-card">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const filteredSignals = filter === 'all' 
    ? signals 
    : signals.filter(signal => signal.strategy === filter);

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold">Active LEAPS Signals</h3>
          <p className="text-sm text-gray-400 mt-1">Real-time trading opportunities and positions</p>
        </div>
        <Button 
          variant="outline"
          size="sm"
          className="bg-accent-blue/20 text-accent-blue border-accent-blue/30 hover:bg-accent-blue/30"
        >
          <Filter className="w-4 h-4 mr-2" />
          Filter Signals
        </Button>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-trading-border hover:bg-transparent">
              <TableHead className="text-gray-400 font-medium">Symbol</TableHead>
              <TableHead className="text-gray-400 font-medium">Strategy</TableHead>
              <TableHead className="text-gray-400 font-medium">Entry/Target</TableHead>
              <TableHead className="text-gray-400 font-medium">Expected Return</TableHead>
              <TableHead className="text-gray-400 font-medium">Confidence</TableHead>
              <TableHead className="text-gray-400 font-medium">Risk Score</TableHead>
              <TableHead className="text-gray-400 font-medium">Time Horizon</TableHead>
              <TableHead className="text-gray-400 font-medium">Status</TableHead>
              <TableHead className="text-gray-400 font-medium">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSignals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-400">
                  No active signals found. <br />
                  <Button 
                    variant="link" 
                    className="text-accent-blue mt-2"
                    onClick={() => {/* Generate signals */}}
                  >
                    Generate New Signals
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filteredSignals.map((signal) => {
                const isProfit = signal.expectedReturn && signal.expectedReturn > 0;
                
                return (
                  <TableRow key={signal.id} className="border-trading-border hover:bg-white/5 transition-colors">
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className={getSymbolAvatar(signal.symbol)}>
                          {signal.symbol.substring(0, 4)}
                        </div>
                        <div>
                          <div className="font-medium">{signal.symbol}</div>
                          <div className="text-xs text-gray-400">Stock</div>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge className={getStrategyBadge(signal.strategy)}>
                        {signal.strategy.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className="font-medium">
                          {formatCurrency(signal.targetPrice || 0)}
                        </div>
                        <div className="text-gray-400">
                          Target: {formatCurrency(signal.targetPrice || 0)}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className={`font-medium ${isProfit ? 'text-success-green' : 'text-danger-red'}`}>
                        {signal.expectedReturn ? formatPercentage(signal.expectedReturn) : 'N/A'}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{signal.confidence.toFixed(1)}/10</div>
                        <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                          <div 
                            className="bg-accent-blue h-1 rounded-full" 
                            style={{ width: `${(signal.confidence / 10) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <span className={`font-medium ${
                          signal.riskScore <= 3 ? 'text-success-green' : 
                          signal.riskScore <= 6 ? 'text-warning-orange' : 
                          'text-danger-red'
                        }`}>
                          {signal.riskScore.toFixed(1)}
                        </span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        {signal.timeHorizon ? `${signal.timeHorizon}d` : 'N/A'}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge className={getStatusBadge(signal.status || 'active')}>
                        {(signal.status || 'active').toUpperCase()}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
