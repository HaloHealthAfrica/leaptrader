import { usePortfolio } from "@/hooks/usePortfolio";
import { formatCurrency, formatPercentage } from "@/utils/formatters";

interface RiskMetric {
  label: string;
  value: string;
  status: 'good' | 'moderate' | 'warning';
  color: string;
}

export default function RiskAnalytics() {
  const { data: portfolios = [] } = usePortfolio();
  
  const mainPortfolio = portfolios[0];
  
  // Mock risk metrics - in production this would come from risk API
  const riskMetrics: RiskMetric[] = [
    {
      label: "Portfolio Beta",
      value: "1.15",
      status: "good",
      color: "success-green",
    },
    {
      label: "Max Drawdown",
      value: "-8.2%",
      status: "good", 
      color: "success-green",
    },
    {
      label: "Sharpe Ratio",
      value: "2.34",
      status: "good",
      color: "success-green",
    },
    {
      label: "VaR (95%)",
      value: "-$47,850",
      status: "moderate",
      color: "warning-orange",
    },
    {
      label: "Greeks Exposure",
      value: "Balanced",
      status: "good",
      color: "success-green",
    },
  ];

  const overallRiskScore = mainPortfolio?.risk?.beta ? 
    Math.min(10, Math.max(1, mainPortfolio.risk.beta * 5)) : 6.2;

  const getRiskLevel = (score: number) => {
    if (score <= 3) return { level: "Low", color: "success-green" };
    if (score <= 6) return { level: "Low to Moderate", color: "success-green" };
    if (score <= 8) return { level: "Moderate", color: "warning-orange" };
    return { level: "High", color: "danger-red" };
  };

  const riskLevel = getRiskLevel(overallRiskScore);

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold">Risk Analytics</h3>
          <p className="text-sm text-gray-400 mt-1">Portfolio risk assessment</p>
        </div>
      </div>
      
      <div className="space-y-6">
        {riskMetrics.map((metric, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 bg-${metric.color} rounded-full`}></div>
              <span className="font-medium">{metric.label}</span>
            </div>
            <div className="text-right">
              <div className="font-bold">{metric.value}</div>
              <div className={`text-xs text-${metric.color} capitalize`}>
                {metric.status}
              </div>
            </div>
          </div>
        ))}
        
        <div className="pt-4 border-t border-trading-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Risk Score</span>
            <span className={`text-2xl font-bold text-${riskLevel.color}`}>
              {overallRiskScore.toFixed(1)}/10
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className={`bg-gradient-to-r from-${riskLevel.color} to-accent-blue h-2 rounded-full`}
              style={{ width: `${(overallRiskScore / 10) * 100}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Risk level: {riskLevel.level}
          </p>
        </div>
      </div>
    </div>
  );
}
