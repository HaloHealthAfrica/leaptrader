import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Shield, TrendingDown, Activity, Settings, RefreshCw } from "lucide-react";

export default function RiskManagement() {
  const { data: riskMetrics, isLoading } = useQuery({
    queryKey: ["/api/risk-metrics/portfolio-1"],
  });

  const { data: portfolioData } = useQuery({
    queryKey: ["/api/portfolio/portfolio-1"],
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded-3xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const riskScore = parseFloat(portfolioData?.riskScore || "8.2");
  const portfolioValue = parseFloat(portfolioData?.totalValue || "2847230");

  const riskCategories = [
    {
      category: "Market Risk",
      level: "Medium",
      score: 6.5,
      description: "Portfolio beta exposure to market movements",
      metrics: [
        { name: "Portfolio Beta", value: "1.15", status: "normal" },
        { name: "Market Correlation", value: "0.82", status: "high" },
        { name: "Sector Concentration", value: "35.2%", status: "moderate" }
      ]
    },
    {
      category: "Liquidity Risk",
      level: "Low",
      score: 3.2,
      description: "Ability to exit positions without significant impact",
      metrics: [
        { name: "Avg Daily Volume", value: "2.8M", status: "good" },
        { name: "Bid-Ask Spread", value: "0.12%", status: "good" },
        { name: "Options OI", value: "High", status: "good" }
      ]
    },
    {
      category: "Greeks Risk",
      level: "Medium",
      score: 7.1,
      description: "Sensitivity to price, time, and volatility changes",
      metrics: [
        { name: "Total Delta", value: "0.85", status: "normal" },
        { name: "Daily Theta", value: "-$45", status: "moderate" },
        { name: "Vega Exposure", value: "$120/1%", status: "normal" }
      ]
    },
    {
      category: "Concentration Risk",
      level: "Medium",
      score: 6.8,
      description: "Risk from position size and correlation concentration",
      metrics: [
        { name: "Max Position", value: "15%", status: "normal" },
        { name: "Top 5 Holdings", value: "68%", status: "moderate" },
        { name: "Correlation Risk", value: "0.65", status: "moderate" }
      ]
    }
  ];

  const stressTestScenarios = [
    {
      name: "Market Crash (-20%)",
      portfolioImpact: "-$569,446",
      impactPercent: "-20.0%",
      recoveryDays: 45,
      severity: "high"
    },
    {
      name: "Volatility Spike (+50%)",
      portfolioImpact: "+$142,361",
      impactPercent: "+5.0%",
      recoveryDays: 12,
      severity: "low"
    },
    {
      name: "Interest Rate Rise (+200bp)",
      portfolioImpact: "-$85,417",
      impactPercent: "-3.0%",
      recoveryDays: 28,
      severity: "moderate"
    },
    {
      name: "Sector Rotation",
      portfolioImpact: "-$142,361",
      impactPercent: "-5.0%",
      recoveryDays: 21,
      severity: "moderate"
    }
  ];

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "low":
        return "text-success-green";
      case "medium":
        return "text-warning-orange";
      case "high":
        return "text-danger-red";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good":
        return "text-success-green";
      case "normal":
        return "text-accent-blue";
      case "moderate":
        return "text-warning-orange";
      case "high":
        return "text-danger-red";
      default:
        return "text-muted-foreground";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "low":
        return <Badge className="bg-success-green/20 text-success-green border border-success-green/30">Low Impact</Badge>;
      case "moderate":
        return <Badge className="bg-warning-orange/20 text-warning-orange border border-warning-orange/30">Moderate</Badge>;
      case "high":
        return <Badge className="bg-danger-red/20 text-danger-red border border-danger-red/30">High Impact</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Risk Management</h2>
          <p className="text-muted-foreground mt-1">Comprehensive portfolio risk analysis and monitoring</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" className="border-accent-blue/30 text-accent-blue hover:bg-accent-blue/10">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
          <Button className="bg-gradient-to-r from-accent-blue to-accent-purple hover:from-accent-blue/80 hover:to-accent-purple/80">
            <Settings className="h-4 w-4 mr-2" />
            Configure Limits
          </Button>
        </div>
      </div>

      {/* Risk Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="glass-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Risk Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success-green">{riskScore.toFixed(1)}/10</div>
            <p className="text-xs text-muted-foreground">Low to Moderate Risk</p>
            <Progress value={(riskScore / 10) * 100} className="mt-3" />
          </CardContent>
        </Card>

        <Card className="glass-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Value at Risk (95%)</CardTitle>
            <TrendingDown className="h-4 w-4 text-danger-red" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-danger-red">-$47,850</div>
            <p className="text-xs text-muted-foreground">1-day potential loss</p>
            <div className="text-xs text-muted-foreground mt-1">
              -{((47850 / portfolioValue) * 100).toFixed(1)}% of portfolio
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning-orange" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success-green">-8.2%</div>
            <p className="text-xs text-muted-foreground">Historical worst case</p>
            <div className="text-xs text-muted-foreground mt-1">
              Within acceptable limits
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Activity className="h-4 w-4 text-warning-orange" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning-orange">3</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
            <div className="text-xs text-warning-orange mt-1">
              2 moderate, 1 low priority
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {riskCategories.map((category, index) => (
          <Card key={index} className="glass-card border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">{category.category}</CardTitle>
                <Badge className={`${getRiskColor(category.level)} bg-opacity-20 border`}>
                  {category.level} Risk
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{category.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Risk Score</span>
                <span className={`text-lg font-bold ${getRiskColor(category.level)}`}>
                  {category.score.toFixed(1)}/10
                </span>
              </div>
              <Progress value={(category.score / 10) * 100} className="h-2" />
              
              <div className="space-y-3 pt-2">
                {category.metrics.map((metric, metricIndex) => (
                  <div key={metricIndex} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{metric.name}:</span>
                    <span className={`font-medium ${getStatusColor(metric.status)}`}>
                      {metric.value}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stress Testing */}
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Stress Test Scenarios</CardTitle>
          <p className="text-sm text-muted-foreground">Portfolio impact under adverse market conditions</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {stressTestScenarios.map((scenario, index) => (
              <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{scenario.name}</h4>
                  {getSeverityBadge(scenario.severity)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Portfolio Impact:</span>
                    <span className={`font-bold ${scenario.portfolioImpact.startsWith('+') ? 'text-success-green' : 'text-danger-red'}`}>
                      {scenario.portfolioImpact}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Percentage:</span>
                    <span className={`font-bold ${scenario.impactPercent.startsWith('+') ? 'text-success-green' : 'text-danger-red'}`}>
                      {scenario.impactPercent}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Est. Recovery:</span>
                    <span className="font-medium">{scenario.recoveryDays} days</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risk Limits and Alerts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Risk Limits</CardTitle>
            <p className="text-sm text-muted-foreground">Current position and exposure limits</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Maximum Position Size</span>
                <div className="text-right">
                  <div className="font-bold">15.0%</div>
                  <div className="text-xs text-success-green">Within limit</div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-medium">Portfolio Beta Limit</span>
                <div className="text-right">
                  <div className="font-bold">1.5</div>
                  <div className="text-xs text-success-green">Current: 1.15</div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-medium">Daily VaR Limit</span>
                <div className="text-right">
                  <div className="font-bold">-$100,000</div>
                  <div className="text-xs text-success-green">Current: -$47,850</div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-medium">Correlation Limit</span>
                <div className="text-right">
                  <div className="font-bold">0.8</div>
                  <div className="text-xs text-warning-orange">Current: 0.75</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Active Risk Alerts</CardTitle>
            <p className="text-sm text-muted-foreground">Current warnings and notifications</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-warning-orange/10 border border-warning-orange/30 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-warning-orange" />
                <span className="font-medium text-warning-orange">Moderate Risk</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Tech sector concentration at 35.2% - approaching 40% limit
              </p>
              <div className="text-xs text-muted-foreground mt-1">2 hours ago</div>
            </div>
            
            <div className="p-3 bg-warning-orange/10 border border-warning-orange/30 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-warning-orange" />
                <span className="font-medium text-warning-orange">Moderate Risk</span>
              </div>
              <p className="text-sm text-muted-foreground">
                TSLA position showing increased correlation with portfolio
              </p>
              <div className="text-xs text-muted-foreground mt-1">4 hours ago</div>
            </div>
            
            <div className="p-3 bg-accent-blue/10 border border-accent-blue/30 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="h-4 w-4 text-accent-blue" />
                <span className="font-medium text-accent-blue">Low Priority</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Weekly risk report generated and saved to dashboard
              </p>
              <div className="text-xs text-muted-foreground mt-1">1 day ago</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
