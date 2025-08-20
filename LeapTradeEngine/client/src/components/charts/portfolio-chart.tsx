import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

const portfolioData = [
  { month: "Jan", value: 2400000 },
  { month: "Feb", value: 2450000 },
  { month: "Mar", value: 2380000 },
  { month: "Apr", value: 2520000 },
  { month: "May", value: 2680000 },
  { month: "Jun", value: 2750000 },
  { month: "Jul", value: 2720000 },
  { month: "Aug", value: 2847230 },
];

export default function PortfolioChart() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact'
    }).format(value);
  };

  return (
    <Card className="glass-card border-0">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-white">Portfolio Performance</CardTitle>
            <p className="text-sm text-gray-400 mt-1">LEAPS strategy returns over time</p>
          </div>
          <div className="flex items-center space-x-2">
            <button className="px-3 py-1 text-xs bg-blue-600/20 text-blue-400 rounded border border-blue-500/30">
              6M
            </button>
            <button className="px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors">
              1Y
            </button>
            <button className="px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors">
              ALL
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-80 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={portfolioData}>
            <defs>
              <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#007AFF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#007AFF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#9CA3AF' }} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: '#9CA3AF' }}
              tickFormatter={formatCurrency}
            />
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value), "Portfolio Value"]} 
              contentStyle={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.9)', 
                border: '1px solid rgba(255, 255, 255, 0.1)', 
                borderRadius: '12px',
                color: '#FFFFFF'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#007AFF" 
              strokeWidth={3} 
              fill="url(#portfolioGradient)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
