/**
 * Utility functions for formatting data in the trading application
 */

/**
 * Format currency values
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  if (isNaN(value)) return '$0.00';
  
  // Handle large numbers with abbreviations
  if (Math.abs(value) >= 1e12) {
    return `$${(value / 1e12).toFixed(1)}T`;
  } else if (Math.abs(value) >= 1e9) {
    return `$${(value / 1e9).toFixed(1)}B`;
  } else if (Math.abs(value) >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`;
  } else if (Math.abs(value) >= 1e3) {
    return `$${(value / 1e3).toFixed(1)}K`;
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format percentage values
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  if (isNaN(value)) return '0.0%';
  
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Format date values
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(dateObj);
}

/**
 * Format datetime values
 */
export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
}

/**
 * Format time values
 */
export function formatTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return 'Invalid Time';
  
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(dateObj);
}

/**
 * Format large numbers with abbreviations
 */
export function formatNumber(value: number, decimals: number = 1): string {
  if (isNaN(value)) return '0';
  
  if (Math.abs(value) >= 1e12) {
    return `${(value / 1e12).toFixed(decimals)}T`;
  } else if (Math.abs(value) >= 1e9) {
    return `${(value / 1e9).toFixed(decimals)}B`;
  } else if (Math.abs(value) >= 1e6) {
    return `${(value / 1e6).toFixed(decimals)}M`;
  } else if (Math.abs(value) >= 1e3) {
    return `${(value / 1e3).toFixed(decimals)}K`;
  }
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Get symbol avatar class based on symbol
 */
export function getSymbolAvatar(symbol: string): string {
  // Determine sector/category based on symbol for consistent styling
  const techSymbols = ['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'META', 'NVDA', 'AMZN', 'NFLX', 'TSLA'];
  const financeSymbols = ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'V', 'MA'];
  const energySymbols = ['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'OXY'];
  
  const baseClasses = 'symbol-avatar w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white';
  
  if (techSymbols.includes(symbol)) {
    return `${baseClasses} symbol-avatar-tech`;
  } else if (financeSymbols.includes(symbol)) {
    return `${baseClasses} symbol-avatar-finance`;
  } else if (energySymbols.includes(symbol)) {
    return `${baseClasses} symbol-avatar-energy`;
  } else {
    return `${baseClasses} symbol-avatar-other`;
  }
}

/**
 * Get strategy badge class based on strategy type
 */
export function getStrategyBadge(strategy: string): string {
  const baseClasses = 'px-2 py-1 text-xs rounded-full border';
  
  switch (strategy) {
    case 'long_call_leaps':
    case 'Long Call LEAPS':
      return `${baseClasses} bg-blue-500/20 text-blue-400 border-blue-500/30`;
    case 'protective_put':
    case 'Protective Put':
      return `${baseClasses} bg-green-500/20 text-green-400 border-green-500/30`;
    // Legacy support
    case 'stock_replacement':
      return `${baseClasses} bg-blue-500/20 text-blue-400 border-blue-500/30`;
    default:
      return `${baseClasses} bg-gray-500/20 text-gray-400 border-gray-500/30`;
  }
}

/**
 * Get status badge class based on status
 */
export function getStatusBadge(status: string): string {
  const baseClasses = 'px-2 py-1 text-xs rounded-full border';
  
  switch (status) {
    case 'active':
    case 'filled':
    case 'executed':
      return `${baseClasses} status-badge-active`;
    case 'monitoring':
    case 'pending':
    case 'partial':
      return `${baseClasses} status-badge-monitoring`;
    case 'cancelled':
    case 'rejected':
    case 'expired':
      return `${baseClasses} status-badge-cancelled`;
    default:
      return `${baseClasses} bg-gray-500/20 text-gray-400 border-gray-500/30`;
  }
}

/**
 * Get risk level styling
 */
export function getRiskLevel(score: number): { level: string; color: string; className: string } {
  if (score <= 3) {
    return { level: 'Low', color: 'success-green', className: 'risk-low' };
  } else if (score <= 6) {
    return { level: 'Moderate', color: 'warning-orange', className: 'risk-moderate' };
  } else {
    return { level: 'High', color: 'danger-red', className: 'risk-high' };
  }
}

/**
 * Get profit/loss styling
 */
export function getPnLClassName(value: number): string {
  if (value > 0) return 'text-profit';
  if (value < 0) return 'text-loss';
  return 'text-neutral';
}

/**
 * Format confidence score with visual indicator
 */
export function formatConfidence(confidence: number): { score: string; percentage: number; color: string } {
  const percentage = (confidence / 10) * 100;
  let color = 'text-danger-red';
  
  if (confidence >= 8) {
    color = 'text-success-green';
  } else if (confidence >= 6) {
    color = 'text-warning-orange';
  }
  
  return {
    score: `${confidence.toFixed(1)}/10`,
    percentage,
    color,
  };
}

/**
 * Format time remaining until expiration
 */
export function formatTimeToExpiration(expirationDate: Date | string): string {
  const expiration = typeof expirationDate === 'string' ? new Date(expirationDate) : expirationDate;
  const now = new Date();
  const diffMs = expiration.getTime() - now.getTime();
  
  if (diffMs < 0) return 'Expired';
  
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    return `${diffHours}h`;
  } else if (diffDays < 7) {
    return `${diffDays}d`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}w`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months}mo`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years}y`;
  }
}

/**
 * Format option type display
 */
export function formatOptionType(type: 'call' | 'put'): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Format trading action display
 */
export function formatAction(action: 'buy' | 'sell' | 'hold'): { text: string; className: string } {
  switch (action) {
    case 'buy':
      return { text: 'BUY', className: 'btn-buy' };
    case 'sell':
      return { text: 'SELL', className: 'btn-sell' };
    case 'hold':
      return { text: 'HOLD', className: 'btn-hold' };
    default:
      return { text: action.toUpperCase(), className: 'text-gray-400' };
  }
}

/**
 * Format volume with appropriate units
 */
export function formatVolume(volume: number): string {
  if (volume >= 1e6) {
    return `${(volume / 1e6).toFixed(1)}M`;
  } else if (volume >= 1e3) {
    return `${(volume / 1e3).toFixed(0)}K`;
  }
  return volume.toLocaleString();
}

/**
 * Calculate and format return percentage
 */
export function calculateReturn(entryPrice: number, currentPrice: number): { 
  value: number; 
  formatted: string; 
  className: string 
} {
  const returnPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
  
  return {
    value: returnPercent,
    formatted: formatPercentage(returnPercent),
    className: getPnLClassName(returnPercent),
  };
}

/**
 * Format market cap with appropriate units
 */
export function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1e12) {
    return `$${(marketCap / 1e12).toFixed(1)}T`;
  } else if (marketCap >= 1e9) {
    return `$${(marketCap / 1e9).toFixed(1)}B`;
  } else if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(1)}M`;
  }
  return formatCurrency(marketCap);
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Format Greeks values
 */
export function formatGreek(value: number, decimals: number = 2): string {
  if (isNaN(value)) return '0.00';
  return value.toFixed(decimals);
}

/**
 * Get time period display
 */
export function getTimePeriodDisplay(days: number): string {
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}
