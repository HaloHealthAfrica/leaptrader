import { Order, OrderRequest, OrderExecutionError, DataProvider } from '../types';
import { OrderValidator } from './OrderValidator';
import { logger } from '../utils/logger';
import { generateId } from '../utils/helpers';

export interface ExecutionConfig {
  defaultOrderType: 'market' | 'limit' | 'stop';
  maxSlippage: number;
  orderTimeout: number;
  retryAttempts: number;
  marketHoursOnly: boolean;
}

export interface BrokerClients {
  alpaca: any;
  tradier: any;
}

export class OrderExecutor {
  private brokerClients: BrokerClients;
  private orderValidator: OrderValidator;
  private config: ExecutionConfig;
  private activeOrders: Map<string, Order> = new Map();
  private executionQueue: OrderRequest[] = [];
  private isProcessing = false;

  constructor(params: { brokerClients: BrokerClients; config: ExecutionConfig }) {
    this.brokerClients = params.brokerClients;
    this.config = params.config;
    this.orderValidator = new OrderValidator(params.config);
  }

  async initialize(): Promise<void> {
    logger.info('Initializing order executor...');
    await this.orderValidator.initialize();
    this.startExecutionLoop();
    logger.info('Order executor initialized');
  }

  async submitOrder(orderRequest: OrderRequest): Promise<Order> {
    try {
      logger.info(`Submitting order: ${orderRequest.side} ${orderRequest.quantity} ${orderRequest.symbol}`);

      // Validate order
      const validationResult = await this.orderValidator.validateOrder(orderRequest);
      if (!validationResult.isValid) {
        throw new OrderExecutionError(`Order validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Choose primary broker (prefer Tradier for options, Alpaca for stocks)
      const primaryBroker = this.choosePrimaryBroker(orderRequest);
      
      // Submit to primary broker
      const order = await this.executeOrderWithBroker(orderRequest, primaryBroker);
      
      // Store in active orders
      this.activeOrders.set(order.id, order);

      // Start monitoring the order
      this.monitorOrder(order.id);

      logger.info(`Order submitted successfully: ${order.id}`);
      return order;
    } catch (error) {
      logger.error(`Error submitting order:`, error);
      throw error;
    }
  }

  private choosePrimaryBroker(orderRequest: OrderRequest): 'alpaca' | 'tradier' {
    // Choose broker based on symbol type and capabilities
    if (this.isOptionSymbol(orderRequest.symbol)) {
      return 'tradier'; // Tradier is better for options
    } else {
      return 'alpaca'; // Alpaca for stocks
    }
  }

  private isOptionSymbol(symbol: string): boolean {
    // Simple heuristic - options symbols are typically longer and contain expiration info
    return symbol.length > 6 || /\d{6}[CP]\d{8}/.test(symbol);
  }

  private async executeOrderWithBroker(orderRequest: OrderRequest, brokerName: 'alpaca' | 'tradier'): Promise<Order> {
    const broker = this.brokerClients[brokerName];
    
    try {
      // Apply execution optimizations
      const optimizedRequest = await this.optimizeOrderExecution(orderRequest);
      
      if (brokerName === 'alpaca') {
        return await broker.submitOrder(optimizedRequest);
      } else {
        // Tradier requires account ID - use default for sandbox
        const accountId = 'default-account'; // In production, get from config
        return await broker.submitOrder(accountId, optimizedRequest);
      }
    } catch (error) {
      logger.error(`Error executing order with ${brokerName}:`, error);
      
      // Try fallback broker if available
      const fallbackBroker = brokerName === 'alpaca' ? 'tradier' : 'alpaca';
      logger.info(`Attempting fallback execution with ${fallbackBroker}`);
      
      try {
        const fallbackOrder = this.brokerClients[fallbackBroker];
        if (fallbackBroker === 'alpaca') {
          return await fallbackOrder.submitOrder(optimizedRequest);
        } else {
          return await fallbackOrder.submitOrder('default-account', optimizedRequest);
        }
      } catch (fallbackError) {
        logger.error(`Fallback execution also failed:`, fallbackError);
        throw new OrderExecutionError(`All brokers failed to execute order: ${error.message}`);
      }
    }
  }

  private async optimizeOrderExecution(orderRequest: OrderRequest): Promise<OrderRequest> {
    const optimized = { ...orderRequest };

    // Apply market hours check
    if (this.config.marketHoursOnly && !this.isMarketHours()) {
      optimized.timeInForce = 'gtc'; // Good till cancelled for after-hours orders
      logger.info('Market closed - setting order to GTC');
    }

    // Smart order routing for better fills
    if (optimized.orderType === 'market' && this.isOptionSymbol(optimized.symbol)) {
      // Convert market orders to limit orders for options to avoid bad fills
      const estimatedPrice = await this.getEstimatedFillPrice(optimized.symbol, optimized.side);
      if (estimatedPrice) {
        optimized.orderType = 'limit';
        optimized.price = this.applySlippageTolerance(estimatedPrice, optimized.side);
        logger.info(`Converted market order to limit order at ${optimized.price}`);
      }
    }

    // Size optimization for large orders
    if (optimized.quantity > 10) {
      logger.info(`Large order detected (${optimized.quantity} contracts) - consider breaking into smaller lots`);
    }

    return optimized;
  }

  private async getEstimatedFillPrice(symbol: string, side: 'buy' | 'sell'): Promise<number | null> {
    try {
      // Get current quote to estimate fill price
      const quote = await this.brokerClients.tradier.getQuote(symbol);
      
      if (side === 'buy') {
        return quote.ask || quote.price;
      } else {
        return quote.bid || quote.price;
      }
    } catch (error) {
      logger.warn(`Could not get estimated fill price for ${symbol}:`, error);
      return null;
    }
  }

  private applySlippageTolerance(price: number, side: 'buy' | 'sell'): number {
    const slippageAmount = price * this.config.maxSlippage;
    
    if (side === 'buy') {
      return Math.round((price + slippageAmount) * 100) / 100; // Round to penny
    } else {
      return Math.round((price - slippageAmount) * 100) / 100;
    }
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

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.activeOrders.get(orderId);
    if (!order) {
      throw new OrderExecutionError(`Order ${orderId} not found`);
    }

    try {
      let success = false;
      
      // Try to cancel with appropriate broker
      if (this.isOptionSymbol(order.symbol)) {
        success = await this.brokerClients.tradier.cancelOrder('default-account', orderId);
      } else {
        success = await this.brokerClients.alpaca.cancelOrder(orderId);
      }

      if (success) {
        order.status = 'cancelled';
        order.updatedAt = new Date();
        logger.info(`Order ${orderId} cancelled successfully`);
      }

      return success;
    } catch (error) {
      logger.error(`Error cancelling order ${orderId}:`, error);
      throw new OrderExecutionError(`Failed to cancel order: ${error.message}`);
    }
  }

  async getOrderStatus(orderId: string): Promise<Order> {
    const order = this.activeOrders.get(orderId);
    if (!order) {
      throw new OrderExecutionError(`Order ${orderId} not found`);
    }

    try {
      let updatedOrder: Order;
      
      if (this.isOptionSymbol(order.symbol)) {
        updatedOrder = await this.brokerClients.tradier.getOrder('default-account', orderId);
      } else {
        updatedOrder = await this.brokerClients.alpaca.getOrder(orderId);
      }

      // Update local order
      this.activeOrders.set(orderId, updatedOrder);
      return updatedOrder;
    } catch (error) {
      logger.error(`Error getting order status for ${orderId}:`, error);
      throw error;
    }
  }

  private async monitorOrder(orderId: string): Promise<void> {
    const maxMonitoringTime = this.config.orderTimeout * 60 * 1000; // Convert to milliseconds
    const startTime = Date.now();
    const checkInterval = 5000; // Check every 5 seconds

    const monitor = async () => {
      try {
        const order = await this.getOrderStatus(orderId);
        
        if (order.status === 'filled' || order.status === 'cancelled' || order.status === 'rejected') {
          logger.info(`Order ${orderId} monitoring complete. Status: ${order.status}`);
          return;
        }

        if (Date.now() - startTime > maxMonitoringTime) {
          logger.warn(`Order ${orderId} monitoring timeout - attempting to cancel`);
          await this.cancelOrder(orderId);
          return;
        }

        // Schedule next check
        setTimeout(monitor, checkInterval);
      } catch (error) {
        logger.error(`Error monitoring order ${orderId}:`, error);
      }
    };

    // Start monitoring
    setTimeout(monitor, checkInterval);
  }

  private startExecutionLoop(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    
    const processQueue = async () => {
      while (this.executionQueue.length > 0) {
        const orderRequest = this.executionQueue.shift();
        if (orderRequest) {
          try {
            await this.submitOrder(orderRequest);
          } catch (error) {
            logger.error('Error processing queued order:', error);
          }
        }
      }
      
      // Continue processing
      setTimeout(processQueue, 1000);
    };

    processQueue();
  }

  async queueOrder(orderRequest: OrderRequest): Promise<void> {
    this.executionQueue.push(orderRequest);
    logger.info(`Order queued: ${orderRequest.side} ${orderRequest.quantity} ${orderRequest.symbol}`);
  }

  // Advanced execution methods

  async executeSpreadOrder(legs: OrderRequest[]): Promise<Order[]> {
    // Execute multi-leg spread orders
    logger.info(`Executing spread order with ${legs.length} legs`);
    
    const orders: Order[] = [];
    
    try {
      // Submit all legs simultaneously for better fills
      const orderPromises = legs.map(leg => this.submitOrder(leg));
      const results = await Promise.all(orderPromises);
      
      orders.push(...results);
      logger.info(`Spread order executed successfully with ${orders.length} legs`);
      
      return orders;
    } catch (error) {
      logger.error('Error executing spread order:', error);
      
      // Cancel any filled legs if spread execution fails
      for (const order of orders) {
        if (order.status === 'pending' || order.status === 'partially_filled') {
          await this.cancelOrder(order.id);
        }
      }
      
      throw new OrderExecutionError(`Spread execution failed: ${error.message}`);
    }
  }

  async executeConditionalOrder(
    orderRequest: OrderRequest,
    condition: {
      symbol: string;
      operator: 'above' | 'below';
      price: number;
    }
  ): Promise<Order> {
    // Execute order only when condition is met
    logger.info(`Setting up conditional order: ${orderRequest.symbol} when ${condition.symbol} ${condition.operator} ${condition.price}`);
    
    return new Promise((resolve, reject) => {
      const checkCondition = async () => {
        try {
          const quote = await this.brokerClients.tradier.getQuote(condition.symbol);
          const currentPrice = quote.price;
          
          const conditionMet = condition.operator === 'above' ? 
            currentPrice > condition.price : 
            currentPrice < condition.price;
          
          if (conditionMet) {
            logger.info(`Condition met for ${orderRequest.symbol} - executing order`);
            const order = await this.submitOrder(orderRequest);
            resolve(order);
          } else {
            // Check again in 10 seconds
            setTimeout(checkCondition, 10000);
          }
        } catch (error) {
          reject(new OrderExecutionError(`Conditional order failed: ${error.message}`));
        }
      };
      
      checkCondition();
    });
  }

  getActiveOrders(): Order[] {
    return Array.from(this.activeOrders.values());
  }

  getExecutionStats(): {
    totalOrders: number;
    filledOrders: number;
    cancelledOrders: number;
    avgFillTime: number;
    fillRate: number;
  } {
    const orders = this.getActiveOrders();
    const totalOrders = orders.length;
    const filledOrders = orders.filter(o => o.status === 'filled').length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
    
    // Calculate average fill time (simplified)
    const fillTimes = orders
      .filter(o => o.status === 'filled')
      .map(o => o.updatedAt.getTime() - o.createdAt.getTime());
    
    const avgFillTime = fillTimes.length > 0 ? 
      fillTimes.reduce((sum, time) => sum + time, 0) / fillTimes.length : 0;
    
    const fillRate = totalOrders > 0 ? (filledOrders / totalOrders) * 100 : 0;
    
    return {
      totalOrders,
      filledOrders,
      cancelledOrders,
      avgFillTime,
      fillRate
    };
  }
}
