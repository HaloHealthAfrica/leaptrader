import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export default function MetricsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  className = ""
}: MetricsCardProps) {
  return (
    <div className={`metric-card ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {trend && (
            <div className="flex items-center mt-2 text-sm">
              <span className={trend.isPositive ? "text-success-green" : "text-danger-red"}>
                {trend.value}
              </span>
              {subtitle && (
                <span className="text-muted-foreground ml-2">{subtitle}</span>
              )}
            </div>
          )}
          {subtitle && !trend && (
            <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
          )}
        </div>
        <div className="w-14 h-14 bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 rounded-2xl flex items-center justify-center">
          <Icon className="h-6 w-6 text-accent-blue" />
        </div>
      </div>
    </div>
  );
}
