import { logger } from './logger';

/**
 * Symbol validation
 */
export function validateSymbol(symbol: string): {
  isValid: boolean;
  errors: string[];
  type: 'stock' | 'option' | 'etf' | 'unknown';
} {
  const errors: string[] = [];
  
  if (!symbol || typeof symbol !== 'string') {
    errors.push('Symbol is required and must be a string');
    return { isValid: false, errors, type: 'unknown' };
  }
  
  const trimmedSymbol = symbol.trim().toUpperCase();
  
  // Check for empty symbol
  if (trimmedSymbol.length === 0) {
    errors.push('Symbol cannot be empty');
    return { isValid: false, errors, type: 'unknown' };
  }
  
  // Check for invalid characters
  if (!/^[A-Z0-9CP]+$/.test(trimmedSymbol)) {
    errors.push('Symbol contains invalid characters');
  }
  
  // Determine symbol type and validate accordingly
  let type: 'stock' | 'option' | 'etf' | 'unknown' = 'unknown';
  
  // Option symbol pattern: AAPL220121C00150000
  if (/^[A-Z]{1,5}\d{6}[CP]\d{8}$/.test(trimmedSymbol)) {
    type = 'option';
    
    // Validate option symbol components
    const match = trimmedSymbol.match(/^([A-Z]{1,5})(\d{6})([CP])(\d{8})$/);
    if (match) {
      const [, underlying, dateStr, optionType, strikeStr] = match;
      
      // Validate date
      const year = 2000 + parseInt(dateStr.substring(0, 2));
      const month = parseInt(dateStr.substring(2, 4));
      const day = parseInt(dateStr.substring(4, 6));
      
      if (month < 1 || month > 12) {
        errors.push('Invalid expiration month');
      }
      
      if (day < 1 || day > 31) {
        errors.push('Invalid expiration day');
      }
      
      // Check if date is in the past
      const expDate = new Date(year, month - 1, day);
      if (expDate < new Date()) {
        errors.push('Option has already expired');
      }
      
      // Validate strike price
      const strike = parseInt(strikeStr) / 1000;
      if (strike <= 0 || strike > 10000) {
        errors.push('Invalid strike price');
      }
    }
  }
  // Stock symbol pattern: 1-5 letters
  else if (/^[A-Z]{1,5}$/.test(trimmedSymbol)) {
    type = 'stock';
    
    if (trimmedSymbol.length > 5) {
      errors.push('Stock symbol too long (max 5 characters)');
    }
  }
  // ETF or other pattern: 2-5 letters (often 3-4)
  else if (/^[A-Z]{2,5}$/.test(trimmedSymbol)) {
    type = 'etf';
  }
  else {
    errors.push('Unrecognized symbol format');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    type
  };
}

/**
 * Price validation
 */
export function validatePrice(
  price: number,
  type: 'stock' | 'option' = 'stock'
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof price !== 'number' || isNaN(price)) {
    errors.push('Price must be a valid number');
    return { isValid: false, errors };
  }
  
  if (price <= 0) {
    errors.push('Price must be greater than 0');
  }
  
  if (type === 'option') {
    if (price < 0.01) {
      errors.push('Option price must be at least $0.01');
    }
    if (price > 999.99) {
      errors.push('Option price cannot exceed $999.99');
    }
  } else {
    if (price < 0.0001) {
      errors.push('Stock price must be at least $0.0001');
    }
    if (price > 100000) {
      errors.push('Stock price cannot exceed $100,000');
    }
  }
  
  // Check for reasonable decimal places
  const decimalPlaces = (price.toString().split('.')[1] || '').length;
  if (decimalPlaces > 4) {
    errors.push('Price has too many decimal places (max 4)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Quantity validation
 */
export function validateQuantity(quantity: number): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (typeof quantity !== 'number' || isNaN(quantity)) {
    errors.push('Quantity must be a valid number');
    return { isValid: false, errors };
  }
  
  if (quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  }
  
  if (quantity !== Math.floor(quantity)) {
    errors.push('Quantity must be a whole number');
  }
  
  if (quantity > 1000000) {
    errors.push('Quantity cannot exceed 1,000,000');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Email validation
 */
export function validateEmail(email: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
    return { isValid: false, errors };
  }
  
  const trimmedEmail = email.trim().toLowerCase();
  
  if (trimmedEmail.length === 0) {
    errors.push('Email cannot be empty');
    return { isValid: false, errors };
  }
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    errors.push('Invalid email format');
  }
  
  if (trimmedEmail.length > 254) {
    errors.push('Email too long (max 254 characters)');
  }
  
  // Check for common issues
  if (trimmedEmail.includes('..')) {
    errors.push('Email cannot contain consecutive dots');
  }
  
  if (trimmedEmail.startsWith('.') || trimmedEmail.endsWith('.')) {
    errors.push('Email cannot start or end with a dot');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Password validation
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
} {
  const errors: string[] = [];
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { isValid: false, errors, strength };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password too long (max 128 characters)');
  }
  
  // Strength checks
  let strengthScore = 0;
  
  if (/[a-z]/.test(password)) strengthScore++;
  if (/[A-Z]/.test(password)) strengthScore++;
  if (/[0-9]/.test(password)) strengthScore++;
  if (/[^a-zA-Z0-9]/.test(password)) strengthScore++;
  if (password.length >= 12) strengthScore++;
  
  if (strengthScore >= 4) {
    strength = 'strong';
  } else if (strengthScore >= 2) {
    strength = 'medium';
  }
  
  // Required criteria for validity
  if (!/[a-zA-Z]/.test(password)) {
    errors.push('Password must contain at least one letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength
  };
}

/**
 * Date validation
 */
export function validateDate(
  date: Date | string,
  options: {
    allowPast?: boolean;
    allowFuture?: boolean;
    minDate?: Date;
    maxDate?: Date;
  } = {}
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { allowPast = true, allowFuture = true, minDate, maxDate } = options;
  
  let dateObj: Date;
  
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    errors.push('Invalid date format');
    return { isValid: false, errors };
  }
  
  if (isNaN(dateObj.getTime())) {
    errors.push('Invalid date');
    return { isValid: false, errors };
  }
  
  const now = new Date();
  
  if (!allowPast && dateObj < now) {
    errors.push('Date cannot be in the past');
  }
  
  if (!allowFuture && dateObj > now) {
    errors.push('Date cannot be in the future');
  }
  
  if (minDate && dateObj < minDate) {
    errors.push(`Date cannot be before ${minDate.toISOString().split('T')[0]}`);
  }
  
  if (maxDate && dateObj > maxDate) {
    errors.push(`Date cannot be after ${maxDate.toISOString().split('T')[0]}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Percentage validation
 */
export function validatePercentage(
  value: number,
  options: {
    min?: number;
    max?: number;
    allowNegative?: boolean;
  } = {}
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { min = 0, max = 100, allowNegative = false } = options;
  
  if (typeof value !== 'number' || isNaN(value)) {
    errors.push('Percentage must be a valid number');
    return { isValid: false, errors };
  }
  
  if (!allowNegative && value < 0) {
    errors.push('Percentage cannot be negative');
  }
  
  if (value < min) {
    errors.push(`Percentage cannot be less than ${min}%`);
  }
  
  if (value > max) {
    errors.push(`Percentage cannot be greater than ${max}%`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Portfolio allocation validation
 */
export function validatePortfolioAllocation(
  allocations: { symbol: string; percentage: number }[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!Array.isArray(allocations)) {
    errors.push('Allocations must be an array');
    return { isValid: false, errors };
  }
  
  if (allocations.length === 0) {
    errors.push('At least one allocation is required');
    return { isValid: false, errors };
  }
  
  let totalPercentage = 0;
  const symbols = new Set<string>();
  
  for (const allocation of allocations) {
    // Validate symbol
    const symbolValidation = validateSymbol(allocation.symbol);
    if (!symbolValidation.isValid) {
      errors.push(`Invalid symbol ${allocation.symbol}: ${symbolValidation.errors.join(', ')}`);
    }
    
    // Check for duplicates
    if (symbols.has(allocation.symbol)) {
      errors.push(`Duplicate symbol: ${allocation.symbol}`);
    }
    symbols.add(allocation.symbol);
    
    // Validate percentage
    const percentageValidation = validatePercentage(allocation.percentage, {
      min: 0,
      max: 100
    });
    if (!percentageValidation.isValid) {
      errors.push(`Invalid percentage for ${allocation.symbol}: ${percentageValidation.errors.join(', ')}`);
    }
    
    totalPercentage += allocation.percentage;
  }
  
  // Check total allocation
  if (Math.abs(totalPercentage - 100) > 0.01) { // Allow small floating point errors
    errors.push(`Total allocation must equal 100% (current: ${totalPercentage.toFixed(2)}%)`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Risk parameters validation
 */
export function validateRiskParameters(params: {
  maxPositionSize?: number;
  stopLoss?: number;
  profitTarget?: number;
  maxDrawdown?: number;
  beta?: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (params.maxPositionSize !== undefined) {
    const validation = validatePercentage(params.maxPositionSize * 100, {
      min: 0.1,
      max: 50
    });
    if (!validation.isValid) {
      errors.push(`Max position size: ${validation.errors.join(', ')}`);
    }
  }
  
  if (params.stopLoss !== undefined) {
    const validation = validatePercentage(params.stopLoss * 100, {
      min: 1,
      max: 50
    });
    if (!validation.isValid) {
      errors.push(`Stop loss: ${validation.errors.join(', ')}`);
    }
  }
  
  if (params.profitTarget !== undefined) {
    const validation = validatePercentage(params.profitTarget * 100, {
      min: 5,
      max: 500
    });
    if (!validation.isValid) {
      errors.push(`Profit target: ${validation.errors.join(', ')}`);
    }
  }
  
  if (params.maxDrawdown !== undefined) {
    const validation = validatePercentage(params.maxDrawdown * 100, {
      min: 1,
      max: 50
    });
    if (!validation.isValid) {
      errors.push(`Max drawdown: ${validation.errors.join(', ')}`);
    }
  }
  
  if (params.beta !== undefined) {
    if (typeof params.beta !== 'number' || isNaN(params.beta)) {
      errors.push('Beta must be a valid number');
    } else if (params.beta < -3 || params.beta > 3) {
      errors.push('Beta must be between -3 and 3');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * API key validation
 */
export function validateApiKey(apiKey: string, provider: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!apiKey || typeof apiKey !== 'string') {
    errors.push('API key is required');
    return { isValid: false, errors };
  }
  
  const trimmedKey = apiKey.trim();
  
  if (trimmedKey.length === 0) {
    errors.push('API key cannot be empty');
    return { isValid: false, errors };
  }
  
  // Provider-specific validation
  switch (provider.toLowerCase()) {
    case 'alpaca':
      if (!/^[A-Z0-9]{20}$/.test(trimmedKey)) {
        errors.push('Alpaca API key must be 20 alphanumeric characters');
      }
      break;
    case 'twelvedata':
      if (!/^[a-f0-9]{32}$/.test(trimmedKey)) {
        errors.push('Twelvedata API key must be 32 hexadecimal characters');
      }
      break;
    case 'tradier':
      if (!/^[A-Za-z0-9]{32,64}$/.test(trimmedKey)) {
        errors.push('Tradier API key must be 32-64 alphanumeric characters');
      }
      break;
    default:
      // Generic validation
      if (trimmedKey.length < 16) {
        errors.push('API key too short (minimum 16 characters)');
      }
      if (trimmedKey.length > 128) {
        errors.push('API key too long (maximum 128 characters)');
      }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Comprehensive validation helper
 */
export function validateAll(
  validations: Array<{ name: string; validation: { isValid: boolean; errors: string[] } }>
): { isValid: boolean; errors: { [field: string]: string[] }; allErrors: string[] } {
  const fieldErrors: { [field: string]: string[] } = {};
  const allErrors: string[] = [];
  let isValid = true;
  
  for (const { name, validation } of validations) {
    if (!validation.isValid) {
      isValid = false;
      fieldErrors[name] = validation.errors;
      allErrors.push(...validation.errors.map(error => `${name}: ${error}`));
    }
  }
  
  return {
    isValid,
    errors: fieldErrors,
    allErrors
  };
}
