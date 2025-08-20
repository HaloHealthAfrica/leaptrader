import { useEffect, useRef } from "react";
import { usePortfolio } from "@/hooks/usePortfolio";

export default function PerformanceChart() {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const { data: portfolios = [] } = usePortfolio();
  
  useEffect(() => {
    if (!chartRef.current) return;
    
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;
    
    // Mock portfolio performance data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const portfolioValues = [
      2400000, 2450000, 2380000, 2520000, 2680000, 2750000, 
      2720000, 2780000, 2820000, 2790000, 2830000, 2847230
    ];
    
    // Clear canvas
    ctx.clearRect(0, 0, chartRef.current.width, chartRef.current.height);
    
    // Set up chart dimensions
    const padding = 40;
    const width = chartRef.current.width - padding * 2;
    const height = chartRef.current.height - padding * 2;
    
    // Calculate scaling
    const minValue = Math.min(...portfolioValues) * 0.95;
    const maxValue = Math.max(...portfolioValues) * 1.05;
    const valueRange = maxValue - minValue;
    
    // Draw grid
    ctx.strokeStyle = '#4B5563';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + width, y);
      ctx.stroke();
    }
    
    // Draw y-axis labels
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '12px Inter';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = maxValue - (valueRange / 5) * i;
      const y = padding + (height / 5) * i;
      ctx.fillText(`$${(value / 1000000).toFixed(1)}M`, padding - 10, y + 4);
    }
    
    // Draw x-axis labels
    ctx.textAlign = 'center';
    months.forEach((month, index) => {
      const x = padding + (width / (months.length - 1)) * index;
      ctx.fillText(month, x, padding + height + 20);
    });
    
    // Draw portfolio line
    ctx.strokeStyle = '#007AFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    portfolioValues.forEach((value, index) => {
      const x = padding + (width / (portfolioValues.length - 1)) * index;
      const y = padding + height - ((value - minValue) / valueRange) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw data points
    ctx.fillStyle = '#007AFF';
    portfolioValues.forEach((value, index) => {
      const x = padding + (width / (portfolioValues.length - 1)) * index;
      const y = padding + height - ((value - minValue) / valueRange) * height;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // Add gradient fill under the line
    const gradient = ctx.createLinearGradient(0, padding, 0, padding + height);
    gradient.addColorStop(0, 'rgba(0, 122, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 122, 255, 0.0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(padding, padding + height);
    
    portfolioValues.forEach((value, index) => {
      const x = padding + (width / (portfolioValues.length - 1)) * index;
      const y = padding + height - ((value - minValue) / valueRange) * height;
      ctx.lineTo(x, y);
    });
    
    ctx.lineTo(padding + width, padding + height);
    ctx.closePath();
    ctx.fill();
    
  }, [portfolios]);
  
  return (
    <div className="glass-card lg:col-span-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold">Portfolio Performance</h3>
          <p className="text-sm text-gray-400 mt-1">LEAPS strategy returns over time</p>
        </div>
        <div className="flex items-center space-x-2">
          <button className="px-3 py-1 text-xs bg-accent-blue/20 text-accent-blue rounded border border-accent-blue/30">
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
      
      <div className="h-80 flex items-center justify-center">
        <canvas
          ref={chartRef}
          width={800}
          height={320}
          className="max-w-full max-h-full"
        />
      </div>
    </div>
  );
}
