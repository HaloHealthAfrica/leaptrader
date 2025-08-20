import { OrderRequest, OrderExecutionError } from '../types';
import { logger } from '../utils/logger';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExecutionConfig {
  defaultOrderType: 'market' | 'limit' | 'stop';
  maxSlippage: number;
  orderTimeout: number;
  retryAttempts: number;
  marketHoursOnly: boolean;
}

export class OrderValidator {
  private config: ExecutionConfig;

  // Market-specific validation rules
  private readonly VALIDATION_RULES = {
    MIN_OPTION_PRICE: 0.05,     // Minimum option price
    MAX_OPTION_PRICE: 999.99,   // Maximum option price  
    MIN_QUANTITY: 1,            // Minimum order quantity
    MAX_QUANTITY: 1000,         // Maximum order quantity
    MAX_ORDER_VALUE: 500000,    // Maximum order value ($500k)
    MIN_STOCK_PRICE: 0.01,      // Minimum stock price
    MAX_STOCK_PRICE: 10000      // Maximum stock price
  };

  // Symbol validation patterns
  private readonly SYMBOL_PATTERNS = {
    STOCK: /^[A-Z]{1,5}$/,                    // 1-5 letter stock symbols
    OPTION: /^[A-Z]{1,5}\d{6}[CP]\d{8}$/,    // Standard option symbol format
    ETF: /^[A-Z]{2,5}$/                      // 2-5 letter ETF symbols
  };

  constructor(config: ExecutionConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing order validator...');
    logger.info('Order validator initialized');
  }

  async validateOrder(orderRequest: OrderRequest): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic validation
      this.validateBasicFields(orderRequest, errors);
      
      // Symbol validation
      this.validateSymbol(orderRequest.symbol, errors, warnings);
      
      // Quantity validation
      this.validateQuantity(orderRequest.quantity, errors, warnings);
      
      // Price validation
      this.validatePrice(orderRequest, errors, warnings);
      
      // Order type validation
      this.validateOrderType(orderRequest, errors, warnings);
      
      // Time in force validation
      this.validateTimeInForce(orderRequest, errors, warnings);
      
      // Market hours validation
      this.validateMarketHours(orderRequest, errors, warnings);
      
      // Risk validation
      await this.validateRiskLimits(orderRequest, errors, warnings);
      
      // Option-specific validation
      if (this.isOptionSymbol(orderRequest.symbol)) {
        this.validateOptionOrder(orderRequest, errors, warnings);
      }

      const isValid = errors.length === 0;
      
      if (!isValid) {
        logger.warn(`Order validation failed for ${orderRequest.symbol}: ${errors.join(', ')}`);
      } else if (warnings.length > 0) {
        logger.info(`Order validation passed with warnings for ${orderRequest.symbol}: ${warnings.join(', ')}`);
      }

      return {
        isValid,
        errors,
        warnings
      };
    } catch (error) {
      logger.error('Error during order validation:', error);
      return {
        isValid: false,
        errors: ['Order validation system error'],
        warnings: []
      };
    }
  }

  private validateBasicFields(orderRequest: OrderRequest, errors: string[]): void {
    if (!orderRequest.symbol) {
      errors.push('Symbol is required');
    }
    
    if (!orderRequest.side) {
      errors.push('Order side (buy/sell) is required');
    }
    
    if (!['buy', 'sell'].includes(orderRequest.side)) {
      errors.push('Order side must be "buy" or "sell"');
    }
    
    if (!orderRequest.quantity) {
      errors.push('Quantity is required');
    }
    
    if (!orderRequest.orderType) {
      errors.push('Order type is required');
    }
  }

  private validateSymbol(symbol: string, errors: string[], warnings: string[]): void {
    if (!symbol) return;
    
    // Check if symbol matches known patterns
    const isValidStock = this.SYMBOL_PATTERNS.STOCK.test(symbol);
    const isValidOption = this.SYMBOL_PATTERNS.OPTION.test(symbol);
    const isValidETF = this.SYMBOL_PATTERNS.ETF.test(symbol);
    
    if (!isValidStock && !isValidOption && !isValidETF) {
      warnings.push('Symbol format may not be standard');
    }
    
    // Check for common symbol issues
    if (symbol.length > 10) {
      warnings.push('Unusually long symbol');
    }
    
    if (!/^[A-Z0-9CP]+$/.test(symbol)) {
      errors.push('Symbol contains invalid characters');
    }
  }

  private validateQuantity(quantity: number, errors: string[], warnings: string[]): void {
    if (!quantity || quantity <= 0) {
      errors.push('Quantity must be greater than 0');
      return;
    }
    
    if (quantity < this.VALIDATION_RULES.MIN_QUANTITY) {
      errors.push(`Quantity must be at least ${this.VALIDATION_RULES.MIN_QUANTITY}`);
    }
    
    if (quantity > this.VALIDATION_RULES.MAX_QUANTITY) {
      errors.push(`Quantity cannot exceed ${this.VALIDATION_RULES.MAX_QUANTITY}`);
    }
    
    // Check for unusual quantities
    if (quantity > 100) {
      warnings.push('Large quantity order - consider breaking into smaller orders');
    }
    
    // Ensure quantity is whole number
    if (quantity !== Math.floor(quantity)) {
      errors.push('Quantity must be a whole number');
    }
  }

  private validatePrice(orderRequest: OrderRequest, errors: string[], warnings: string[]): void {
    const { orderType, price, stopPrice } = orderRequest;
    
    // Price validation for limit orders
    if (orderType === 'limit') {
      if (!price || price <= 0) {
        errors.push('Limit price must be greater than 0');
        return;
      }
      
      if (this.isOptionSymbol(orderRequest.symbol)) {
        if (price < this.VALIDATION_RULES.MIN_OPTION_PRICE) {
          errors.push(`Option price must be at least $${this.VALIDATION_RULES.MIN_OPTION_PRICE}`);
        }
        
        if (price > this.VALIDATION_RULES.MAX_OPTION_PRICE) {
          errors.push(`Option price cannot exceed $${this.VALIDATION_RULES.MAX_OPTION_PRICE}`);
        }
      } else {
        if (price < this.VALIDATION_RULES.MIN_STOCK_PRICE) {
          errors.push(`Stock price must be at least $${this.VALIDATION_RULES.MIN_STOCK_PRICE}`);
        }
        
        if (price > this.VALIDATION_RULES.MAX_STOCK_PRICE) {
          errors.push(`Stock price cannot exceed $${this.VALIDATION_RULES.MAX_STOCK_PRICE}`);
        }
      }
      
      // Check for unusual prices
      if (price > 1000 && !this.isOptionSymbol(orderRequest.symbol)) {
        warnings.push('Very high stock price - please verify');
      }
    }
    
    // Stop price validation
    if (orderType === 'stop' || orderType === 'stop_limit') {
      if (!stopPrice || stopPrice <= 0) {
        errors.push('Stop price must be greater than 0');
      }
      
      if (price && stopPrice) {
        if (orderRequest.side === 'buy' && stopPrice <= price) {
          errors.push('For buy stop orders, stop price must be above limit price');
        }
        
        if (orderRequest.side === 'sell' && stopPrice >= price) {
          errors.push('For sell stop orders, stop price must be below limit price');
        }
      }
    }
    
    // Order value validation
    if (price && orderRequest.quantity) {
      const orderValue = price * orderRequest.quantity;
      if (orderValue > this.VALIDATION_RULES.MAX_ORDER_VALUE) {
        errors.push(`Order value ($${orderValue.toLocaleString()}) exceeds maximum allowed`);
      }
    }
  }

  private validateOrderType(orderRequest: OrderRequest, errors: string[], warnings: string[]): void {
    const validOrderTypes = ['market', 'limit', 'stop', 'stop_limit'];
    
    if (!validOrderTypes.includes(orderRequest.orderType)) {
      errors.push(`Invalid order type. Must be one of: ${validOrderTypes.join(', ')}`);
    }
    
    // Market order warnings for options
    if (orderRequest.orderType === 'market' && this.isOptionSymbol(orderRequest.symbol)) {
      warnings.push('Market orders for options may result in poor fills - consider using limit orders');
    }
    
    // Stop order warnings
    if (orderRequest.orderType.includes('stop')) {
      warnings.push('Stop orders are not guaranteed to fill at the stop price');
    }
  }

  private validateTimeInForce(orderRequest: OrderRequest, errors: string[], warnings: string[]): void {
    const validTIF = ['day', 'gtc', 'ioc', 'fok'];
    const timeInForce = orderRequest.timeInForce || 'day';
    
    if (!validTIF.includes(timeInForce)) {
      errors.push(`Invalid time in force. Must be one of: ${validTIF.join(', ')}`);
    }
    
    // Specific validations
    if (timeInForce === 'ioc' && orderRequest.orderType === 'market') {
      warnings.push('IOC market orders may have very low fill rates');
    }
    
    if (timeInForce === 'fok' && orderRequest.quantity > 10) {
      warnings.push('FOK orders with large quantities have lower fill probability');
    }
  }

  private validateMarketHours(orderRequest: OrderRequest, errors: string[], warnings: string[]): void {
    if (!this.config.marketHoursOnly) return;
    
    const isMarketOpen = this.isMarketHours();
    const isExtendedHours = this.isExtendedHours();
    
    if (!isMarketOpen && !isExtendedHours) {
      if (orderRequest.timeInForce === 'day') {
        warnings.push('Market is closed - day orders will be queued until market opens');
      }
    }
    
    if (!isMarketOpen && this.isOptionSymbol(orderRequest.symbol)) {
      warnings.push('Options trading may have limited liquidity outside market hours');
    }
  }

  private async validateRiskLimits(orderRequest: OrderRequest, errors: string[], warnings: string[]): Promise<void> {
    // Basic risk validations
    const orderValue = (orderRequest.price || 0) * orderRequest.quantity;
    
    // Very large order warning
    if (orderValue > 100000) { // $100k
      warnings.push('Large order value - ensure adequate risk management');
    }
    
    // Option expiration check
    if (this.isOptionSymbol(orderRequest.symbol)) {
      const expirationWarning = this.checkOptionExpiration(orderRequest.symbol);
      if (expirationWarning) {
        warnings.push(expirationWarning);
      }
    }
  }

  private validateOptionOrder(orderRequest: OrderRequest, errors: string[], warnings: string[]): void {
    const symbol = orderRequest.symbol;
    
    // Parse option symbol components
    const optionComponents = this.parseOptionSymbol(symbol);
    if (!optionComponents) {
      errors.push('Invalid option symbol format');
      return;
    }
    
    const { strike, expiration, optionType } = optionComponents;
    
    // Strike price validation
    if (strike <= 0) {
      errors.push('Invalid strike price');
    }
    
    if (strike > 10000) {
      warnings.push('Very high strike price - please verify');
    }
    
    // Expiration validation
    const daysToExpiration = Math.ceil((expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    
    if (daysToExpiration < 0) {
      errors.push('Option has already expired');
    }
    
    if (daysToExpiration < 1) {
      warnings.push('Option expires very soon - high time decay risk');
    }
    
    if (daysToExpiration > 1000) {
      warnings.push('Very long-term option - high time premium');
    }
    
    // Option type validation
    if (!['C', 'P'].includes(optionType)) {
      errors.push('Invalid option type - must be Call (C) or Put (P)');
    }
  }

  private isOptionSymbol(symbol: string): boolean {
    return this.SYMBOL_PATTERNS.OPTION.test(symbol);
  }

  private parseOptionSymbol(symbol: string): {
    underlying: string;
    expiration: Date;
    optionType: string;
    strike: number;
  } | null {
    const match = symbol.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);
    if (!match) return null;
    
    const [, underlying, dateStr, optionType, strikeStr] = match;
    
    // Parse expiration date (YYMMDD format)
    const year = 2000 + parseInt(dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4)) - 1; // Month is 0-indexed
    const day = parseInt(dateStr.substring(4, 6));
    const expiration = new Date(year, month, day);
    
    // Parse strike price (multiply by 1000 and divide by 1000 to handle decimals)
    const strike = parseInt(strikeStr) / 1000;
    
    return {
      underlying,
      expiration,
      optionType,
      strike
    };
  }

  private checkOptionExpiration(symbol: string): string | null {
    const components = this.parseOptionSymbol(symbol);
    if (!components) return null;
    
    const daysToExpiration = Math.ceil((components.expiration.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    
    if (daysToExpiration <= 5) {
      return `Option expires in ${daysToExpiration} day(s) - high time decay risk`;
    }
    
    if (daysToExpiration <= 30) {
      return `Option expires in ${daysToExpiration} days - monitor time decay`;
    }
    
    return null;
  }

  private isMarketHours(): boolean {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    
    // US market hours: 9:30 AM - 4:00 PM EST (14:30 - 21:00 UTC)
    const marketOpenUTC = 14.5; // 14:30 UTC
    const marketCloseUTC = 21.0; // 21:00 UTC
    
    const currentTimeUTC = utcHours + (utcMinutes / 60);
    
    return currentTimeUTC >= marketOpenUTC && currentTimeUTC <= marketCloseUTC;
  }

  private isExtendedHours(): boolean {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    
    // Extended hours: 8:00 AM - 9:30 AM and 4:00 PM - 8:00 PM EST
    const preMarketStart = 13.0;  // 8:00 AM EST
    const preMarketEnd = 14.5;    // 9:30 AM EST
    const afterHoursStart = 21.0; // 4:00 PM EST
    const afterHoursEnd = 1.0;    // 8:00 PM EST (next day UTC)
    
    const currentTimeUTC = utcHours + (utcMinutes / 60);
    
    return (currentTimeUTC >= preMarketStart && currentTimeUTC < preMarketEnd) ||
           (currentTimeUTC >= afterHoursStart) ||
           (currentTimeUTC < afterHoursEnd);
  }

  // Additional validation methods for specific order scenarios

  validateSpreadOrder(legs: OrderRequest[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (legs.length < 2) {
      errors.push('Spread orders must have at least 2 legs');
    }
    
    if (legs.length > 4) {
      warnings.push('Complex spread with more than 4 legs - ensure proper understanding');
    }
    
    // Validate each leg
    for (let i = 0; i < legs.length; i++) {
      const legValidation = this.validateOrder(legs[i]);
      if (!legValidation.isValid) {
        errors.push(`Leg ${i + 1}: ${legValidation.errors.join(', ')}`);
      }
    }
    
    // Check for balanced quantities
    const buyQuantity = legs.filter(leg => leg.side === 'buy')
      .reduce((sum, leg) => sum + leg.quantity, 0);
    const sellQuantity = legs.filter(leg => leg.side === 'sell')
      .reduce((sum, leg) => sum + leg.quantity, 0);
    
    if (buyQuantity !== sellQuantity) {
      warnings.push('Unbalanced spread - buy and sell quantities differ');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateOrderModification(originalOrder: OrderRequest, modification: Partial<OrderRequest>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Create modified order for validation
    const modifiedOrder: OrderRequest = { ...originalOrder, ...modification };
    
    // Validate the modified order
    const validation = this.validateOrder(modifiedOrder);
    errors.push(...validation.errors);
    warnings.push(...validation.warnings);
    
    // Additional modification-specific checks
    if (modification.quantity && modification.quantity !== originalOrder.quantity) {
      warnings.push('Quantity modification may affect fill probability');
    }
    
    if (modification.price && modification.price !== originalOrder.price) {
      const priceDiff = Math.abs((modification.price - (originalOrder.price || 0)) / (originalOrder.price || 1));
      if (priceDiff > 0.1) { // More than 10% price change
        warnings.push('Significant price modification detected');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
