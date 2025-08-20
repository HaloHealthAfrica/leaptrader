import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Activity, 
  Server, 
  Database, 
  Wifi, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Zap
} from "lucide-react";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface SystemMetric {
  name: string;
  value: string;
  status: 'healthy' | 'warning' | 'error';
  description: string;
  icon: React.ComponentType<any>;
}

export default function Monitoring() {
  const [selectedTab, setSelectedTab] = useState("overview");

  const { data: systemStatus, isLoading } = useQuery({
    queryKey: ['/api/system/status'],
    queryFn: () => api.getSystemStatus(),
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Mock system metrics - in production would come from actual monitoring
  const systemMetrics: SystemMetric[] = [
    {
      name: "API Response Time",
      value: "87ms",
      status: "healthy",
      description: "Average API response time",
      icon: Clock
    },
    {
      name: "Database Connections",
      value: "12/100",
      status: "healthy", 
      description: "Active database connections",
      icon: Database
    },
    {
      name: "Memory Usage",
      value: "68%",
      status: "warning",
      description: "System memory utilization",
      icon: Server
    },
    {
      name: "Data Provider Status",
      value: "2/3 Online",
      status: "warning",
      description: "External data provider availability",
      icon: Wifi
    },
    {
      name: "Cache Hit Rate",
      value: "94.2%",
      status: "healthy",
      description: "Cache performance",
      icon: Zap
    },
    {
      name: "Error Rate",
      value: "0.03%",
      status: "healthy",
      description: "System error rate",
      icon: AlertTriangle
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-success-green" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning-orange" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-danger-red" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-success-green';
      case 'warning':
        return 'text-warning-orange';
      case 'error':
        return 'text-danger-red';
      default:
        return 'text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="glass-card animate-pulse h-64"></div>
        <div className="glass-card animate-pulse h-96"></div>
      </div>
    );
  }

  const overallHealth = systemMetrics.filter(m => m.status === 'healthy').length / systemMetrics.length * 100;

  return (
    <div className="space-y-8">
      {/* System Overview */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">System Monitoring</h2>
            <p className="text-gray-400">Real-time system health and performance metrics</p>
          </div>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* System Health Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="text-center p-6 bg-white/5 rounded-xl">
            <Activity className={`w-8 h-8 mx-auto mb-2 ${
              overallHealth >= 80 ? 'text-success-green' : 
              overallHealth >= 60 ? 'text-warning-orange' : 'text-danger-red'
            }`} />
            <div className="text-2xl font-bold">{overallHealth.toFixed(0)}%</div>
            <div className="text-sm text-gray-400">System Health</div>
            <div className={`text-sm mt-1 ${
              overallHealth >= 80 ? 'text-success-green' : 
              overallHealth >= 60 ? 'text-warning-orange' : 'text-danger-red'
            }`}>
              {overallHealth >= 80 ? 'Healthy' : overallHealth >= 60 ? 'Warning' : 'Critical'}
            </div>
          </div>

          <div className="text-center p-6 bg-white/5 rounded-xl">
            <Server className="w-8 h-8 text-accent-blue mx-auto mb-2" />
            <div className="text-2xl font-bold">{systemStatus?.portfolios || 0}</div>
            <div className="text-sm text-gray-400">Active Portfolios</div>
            <div className="text-sm text-gray-400 mt-1">
              {systemStatus?.activeSignals || 0} signals
            </div>
          </div>

          <div className="text-center p-6 bg-white/5 rounded-xl">
            <BarChart3 className="w-8 h-8 text-success-green mx-auto mb-2" />
            <div className="text-2xl font-bold">{systemStatus?.activeSignals || 0}</div>
            <div className="text-sm text-gray-400">Active Signals</div>
            <div className="text-sm text-gray-400 mt-1">
              {systemStatus?.pendingOrders || 0} pending orders
            </div>
          </div>

          <div className="text-center p-6 bg-white/5 rounded-xl">
            <TrendingUp className="w-8 h-8 text-accent-purple mx-auto mb-2" />
            <div className="text-2xl font-bold">99.8%</div>
            <div className="text-sm text-gray-400">Uptime</div>
            <div className="text-sm text-gray-400 mt-1">
              Last 30 days
            </div>
          </div>
        </div>

        {/* System Alerts */}
        <div className="space-y-3">
          {systemMetrics.filter(m => m.status === 'warning' || m.status === 'error').map((metric, index) => (
            <Alert key={index} className={`${
              metric.status === 'error' ? 'border-danger-red/30 bg-danger-red/10' : 
              'border-warning-orange/30 bg-warning-orange/10'
            }`}>
              <AlertTriangle className={`h-4 w-4 ${
                metric.status === 'error' ? 'text-danger-red' : 'text-warning-orange'
              }`} />
              <AlertDescription className={metric.status === 'error' ? 'text-danger-red' : 'text-warning-orange'}>
                <strong>{metric.name}:</strong> {metric.description} - Current value: {metric.value}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      </div>

      {/* Monitoring Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4 bg-trading-card">
          <TabsTrigger value="overview">System Metrics</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>System Metrics</CardTitle>
                <CardDescription>Real-time system performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {systemMetrics.map((metric, index) => {
                  const Icon = metric.icon;
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-5 h-5 ${getStatusColor(metric.status)}`} />
                        <div>
                          <div className="font-medium">{metric.name}</div>
                          <div className="text-xs text-gray-400">{metric.description}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${getStatusColor(metric.status)}`}>
                          {metric.value}
                        </div>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(metric.status)}
                          <span className={`text-xs ${getStatusColor(metric.status)}`}>
                            {metric.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Resource Utilization</CardTitle>
                <CardDescription>System resource usage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">CPU Usage</span>
                    <span className="text-sm text-gray-400">45%</span>
                  </div>
                  <Progress value={45} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Memory Usage</span>
                    <span className="text-sm text-gray-400">68%</span>
                  </div>
                  <Progress value={68} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Disk Usage</span>
                    <span className="text-sm text-gray-400">32%</span>
                  </div>
                  <Progress value={32} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Network I/O</span>
                    <span className="text-sm text-gray-400">23%</span>
                  </div>
                  <Progress value={23} className="h-2" />
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Requests (24h):</span>
                      <span>1,247,892</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Avg Response Time:</span>
                      <span>87ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Cache Hit Rate:</span>
                      <span className="text-success-green">94.2%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>System performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-lg mb-2">Performance Charts</p>
                  <p className="text-sm">Coming Soon - Response times, throughput, and latency metrics</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Activity Logs</CardTitle>
              <CardDescription>Recent system activity and operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  {
                    timestamp: new Date(Date.now() - 5 * 60 * 1000),
                    level: "INFO",
                    message: "Signal generation completed for 24 symbols",
                    component: "SignalGenerator"
                  },
                  {
                    timestamp: new Date(Date.now() - 12 * 60 * 1000),
                    level: "WARN",
                    message: "Market data update timeout for TSLA",
                    component: "MarketDataJob"
                  },
                  {
                    timestamp: new Date(Date.now() - 18 * 60 * 1000),
                    level: "INFO",
                    message: "Portfolio values updated successfully",
                    component: "PortfolioManager"
                  },
                  {
                    timestamp: new Date(Date.now() - 25 * 60 * 1000),
                    level: "ERROR",
                    message: "Tradier API rate limit exceeded",
                    component: "TradierClient"
                  },
                  {
                    timestamp: new Date(Date.now() - 35 * 60 * 1000),
                    level: "INFO",
                    message: "Risk metrics calculated for portfolio-1",
                    component: "RiskCalculator"
                  }
                ].map((log, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-white/5 rounded-lg">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      log.level === 'ERROR' ? 'bg-danger-red' :
                      log.level === 'WARN' ? 'bg-warning-orange' : 'bg-success-green'
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-400">{formatDate(log.timestamp)}</span>
                        <Badge variant="outline" className="text-xs">
                          {log.level}
                        </Badge>
                        <span className="text-xs text-gray-500">{log.component}</span>
                      </div>
                      <p className="text-sm mt-1">{log.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>System Alerts</CardTitle>
              <CardDescription>Active alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert className="border-warning-orange/30 bg-warning-orange/10">
                  <AlertTriangle className="h-4 w-4 text-warning-orange" />
                  <AlertDescription className="text-warning-orange">
                    <strong>Memory Usage High:</strong> System memory usage is at 68%. Consider optimizing or scaling resources.
                  </AlertDescription>
                </Alert>

                <Alert className="border-warning-orange/30 bg-warning-orange/10">
                  <Wifi className="h-4 w-4 text-warning-orange" />
                  <AlertDescription className="text-warning-orange">
                    <strong>Data Provider Issue:</strong> Tradier API experiencing intermittent connectivity issues.
                  </AlertDescription>
                </Alert>

                <Alert className="border-success-green/30 bg-success-green/10">
                  <CheckCircle className="h-4 w-4 text-success-green" />
                  <AlertDescription className="text-success-green">
                    <strong>System Healthy:</strong> All critical services are operational and performing within normal parameters.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
