import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const allocationData = [
  { name: "Technology", value: 35.2, color: "#007AFF" },
  { name: "Healthcare", value: 24.8, color: "#5856D6" },
  { name: "Finance", value: 21.3, color: "#30D158" },
  { name: "Energy", value: 12.4, color: "#FF9500" },
  { name: "Cash", value: 6.3, color: "#8E8E93" },
];

export default function AllocationChart() {
  return (
    <Card className="glass-card border-0">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-white">Position Allocation</CardTitle>
        <p className="text-sm text-gray-400">Current sector distribution</p>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={allocationData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={100}
                dataKey="value"
                label={({ value }) => `${value}%`}
              >
                {allocationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value}%`, "Allocation"]}
                contentStyle={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.9)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)', 
                  borderRadius: '12px',
                  color: '#FFFFFF'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3 mt-6">
          {allocationData.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }} 
                />
                <span className="text-sm font-medium text-white">{item.name}</span>
              </div>
              <span className="text-sm text-gray-400">{item.value}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
