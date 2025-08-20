import { useState } from "react";
import { useSignals } from "@/hooks/useSignals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Pause, Eye, MoreVertical, RefreshCw, Filter } from "lucide-react";
import { formatCurrency, formatPercentage, getSymbolAvatar, getStrategyBadge, getStatusBadge } from "@/utils/formatters";

export default function Signals() {
  const [selectedTab, setSelectedTab] = useState("active");
  
  const { data: activeSignals = [], isLoading: loadingActive } = useSignals({ status: 'active' });
  const { data: allSignals = [], isLoading: loadingAll } = useSignals();

  const executedSignals = allSignals.filter(s => s.status === 'executed');
  const cancelledSignals = allSignals.filter(s => s.status === 'cancelled');

  const SignalCard = ({ signal }: { signal: any }) => (
    <Card className="glass-card hover:bg-white/10 transition-colors">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className={getSymbolAvatar(signal.symbol)}>
              {signal.symbol.substring(0, 4)}
            </div>
            <div>
              <CardTitle className="text-lg">{signal.symbol}</CardTitle>
              <CardDescription>
                <Badge className={getStrategyBadge(signal.strategy)}>
                  {signal.strategy.replace('_', ' ').toUpperCase()}
                </Badge>
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400">Target Price</p>
            <p className="font-semibold">{formatCurrency(signal.targetPrice || 0)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Stop Price</p>
            <p className="font-semibold">{formatCurrency(signal.stopPrice || 0)}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400">Expected Return</p>
            <p className={`font-semibold ${
              (signal.expectedReturn || 0) > 0 ? 'text-success-green' : 'text-danger-red'
            }`}>
              {formatPercentage(signal.expectedReturn || 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Confidence</p>
            <div className="flex items-center space-x-2">
              <span className="font-semibold">{signal.confidence.toFixed(1)}/10</span>
              <div className="flex-1 bg-gray-700 rounded-full h-1">
                <div 
                  className="bg-accent-blue h-1 rounded-full" 
                  style={{ width: `${(signal.confidence / 10) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Risk Score</p>
            <p className={`font-medium ${
              signal.riskScore <= 3 ? 'text-success-green' : 
              signal.riskScore <= 6 ? 'text-warning-orange' : 'text-danger-red'
            }`}>
              {signal.riskScore.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Time Horizon</p>
            <p className="font-medium">{signal.timeHorizon || 'N/A'}d</p>
          </div>
          <div>
            <p className="text-gray-400">Status</p>
            <Badge className={getStatusBadge(signal.status || 'active')}>
              {(signal.status || 'active').toUpperCase()}
            </Badge>
          </div>
        </div>
        
        {signal.reasoning && (
          <div className="pt-3 border-t border-gray-700">
            <p className="text-sm text-gray-400 mb-2">Reasoning</p>
            <p className="text-sm">{signal.reasoning}</p>
          </div>
        )}
        
        <div className="flex space-x-2 pt-2">
          <Button size="sm" className="flex-1">
            <Play className="w-4 h-4 mr-2" />
            Execute
          </Button>
          <Button variant="outline" size="sm">
            <Eye className="w-4 h-4 mr-2" />
            Monitor
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Trading Signals</h2>
            <p className="text-gray-400">
              AI-generated LEAP options trading opportunities with comprehensive analysis
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button size="sm" className="bg-accent-blue hover:bg-accent-blue/80">
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate Signals
            </Button>
          </div>
        </div>
        
        {/* Signal Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-accent-blue">{activeSignals.length}</div>
            <div className="text-sm text-gray-400">Active Signals</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-success-green">{executedSignals.length}</div>
            <div className="text-sm text-gray-400">Executed</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold text-warning-orange">
              {activeSignals.filter(s => (s.expectedReturn || 0) > 0).length}
            </div>
            <div className="text-sm text-gray-400">Profitable</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <div className="text-2xl font-bold">
              {activeSignals.length > 0 ? 
                (activeSignals.reduce((acc, s) => acc + s.confidence, 0) / activeSignals.length).toFixed(1) 
                : '0'}
            </div>
            <div className="text-sm text-gray-400">Avg Confidence</div>
          </div>
        </div>
      </div>

      {/* Signal Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4 bg-trading-card">
          <TabsTrigger value="active">Active ({activeSignals.length})</TabsTrigger>
          <TabsTrigger value="executed">Executed ({executedSignals.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({cancelledSignals.length})</TabsTrigger>
          <TabsTrigger value="all">All Signals ({allSignals.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-6">
          {loadingActive ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="glass-card animate-pulse">
                  <CardContent className="h-64 bg-gray-700 rounded"></CardContent>
                </Card>
              ))}
            </div>
          ) : activeSignals.length === 0 ? (
            <div className="glass-card text-center py-12">
              <div className="text-gray-400 mb-4">No active signals found</div>
              <Button className="bg-accent-blue hover:bg-accent-blue/80">
                <RefreshCw className="w-4 h-4 mr-2" />
                Generate New Signals
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeSignals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="executed" className="mt-6">
          <div className="glass-card text-center py-12">
            <div className="text-gray-400 mb-2">Executed Signals</div>
            <div className="text-sm text-gray-500">Coming soon - executed signal history</div>
          </div>
        </TabsContent>
        
        <TabsContent value="cancelled" className="mt-6">
          <div className="glass-card text-center py-12">
            <div className="text-gray-400 mb-2">Cancelled Signals</div>
            <div className="text-sm text-gray-500">Coming soon - cancelled signal history</div>
          </div>
        </TabsContent>
        
        <TabsContent value="all" className="mt-6">
          {loadingAll ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card animate-pulse h-24"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allSignals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
