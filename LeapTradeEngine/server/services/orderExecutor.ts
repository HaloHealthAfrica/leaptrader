import { Order, InsertOrder, TradingSignal, Position } from "@shared/schema";
import { storage } from "../storage";
import { AlpacaClient } from "./dataProviders/alpaca";
import { MarketDataService } from "./marketData";

export class OrderExecutorService {
  private alpacaClient: AlpacaClient;
  private marketDataService: MarketDataService;

  constructor() {
    this.alpacaClient = new AlpacaClient();
    this.marketDataService = new MarketDataService();
  }

  async executeSignal(signalId: string, portfolioId: string, quantity: number): Promise<Order> {
    const signal = await storage.getTradingSignal(signalId);
    if (!signal) {
      throw new Error('Signal not found');
    }

    const orderData: InsertOrder = {
      portfolioId,
      symbol: signal.symbol,
      type: 'market',
      side: signal.action === 'buy' ? 'buy' : 'sell',
      quantity,
      timeInForce: 'day',
      status: 'pending',
      createdAt: new Date(),
      filledQuantity: 0,
      strategyId: signal.id,
    };

    const order = await storage.createOrder(orderData);

    // Execute the order
    try {
      await this.processOrder(order.id);
    } catch (error) {
      console.error(`Error executing order ${order.id}:`, error);
      await storage.updateOrder(order.id, { status: 'rejected' });
      throw error;
    }

    return order;
  }

  async processOrder(orderId: string): Promise<Order | null> {
    const order = await storage.getOrder(orderId);
    if (!order || order.status !== 'pending') {
      return order;
    }

    try {
      // Validate order
      const validation = await this.validateOrder(order);
      if (!validation.isValid) {
        await storage.updateOrder(orderId, { status: 'rejected' });
        throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
      }

      // Execute through broker
      const executionResult = await this.executeThroughBroker(order);
      
      if (executionResult.success) {
        // Update order status
        await storage.updateOrder(orderId, {
          status: 'filled',
          filledAt: new Date(),
          filledQuantity: order.quantity,
          filledPrice: executionResult.fillPrice,
        });

        // Create position
        await this.createPositionFromOrder(order, executionResult.fillPrice);

        // Update signal status
        if (order.strategyId) {
          await storage.updateTradingSignal(order.strategyId, { status: 'executed' });
        }
      } else {
        await storage.updateOrder(orderId, { status: 'rejected' });
      }

      return await storage.getOrder(orderId);
    } catch (error) {
      console.error(`Error processing order ${orderId}:`, error);
      await storage.updateOrder(orderId, { status: 'rejected' });
      throw error;
    }
  }

  private async validateOrder(order: Order): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check portfolio exists
    const portfolio = await storage.getPortfolio(order.portfolioId);
    if (!portfolio) {
      errors.push('Portfolio not found');
      return { isValid: false, errors };
    }

    // Check market data availability
    const marketData = await this.marketDataService.getQuote(order.symbol);
    if (!marketData) {
      errors.push('Market data not available');
    }

    // Check sufficient buying power
    if (order.side === 'buy') {
      const estimatedCost = order.quantity * (marketData?.price || 0);
      if (estimatedCost > portfolio.cashBalance) {
        errors.push('Insufficient buying power');
      }
    }

    // Check position exists for sell orders
    if (order.side === 'sell') {
      const positions = await storage.getPositionsByPortfolio(order.portfolioId);
      const position = positions.find(pos => 
        pos.symbol === order.symbol && 
        pos.quantity >= order.quantity &&
        !pos.closeDate
      );
      if (!position) {
        errors.push('Insufficient position to sell');
      }
    }

    // Check market hours
    const marketStatus = await this.marketDataService.getMarketStatus();
    if (!marketStatus.isOpen && order.type === 'market') {
      errors.push('Market is closed for market orders');
    }

    // Validate order size
    if (order.quantity <= 0) {
      errors.push('Invalid order quantity');
    }

    if (order.quantity > 10000) {
      errors.push('Order size too large');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async executeThroughBroker(order: Order): Promise<{ success: boolean; fillPrice?: number; error?: string }> {
    try {
      // For demo purposes, simulate execution
      // In production, would use actual broker API
      if (process.env.NODE_ENV === 'development') {
        return this.simulateExecution(order);
      }

      // Execute through Alpaca
      const orderRequest = {
        symbol: order.symbol,
        qty: order.quantity,
        side: order.side,
        type: order.type,
        time_in_force: order.timeInForce,
      };

      if (order.type === 'limit' && order.price) {
        orderRequest.limit_price = order.price;
      }

      const result = await this.alpacaClient.createOrder(orderRequest);
      
      return {
        success: true,
        fillPrice: result.filled_avg_price || order.price,
      };
    } catch (error) {
      console.error('Broker execution error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async simulateExecution(order: Order): Promise<{ success: boolean; fillPrice?: number }> {
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get current market price
    const marketData = await this.marketDataService.getQuote(order.symbol);
    if (!marketData) {
      return { success: false };
    }

    // Simulate slippage
    const slippagePercent = Math.random() * 0.002; // 0-0.2% slippage
    const slippage = order.side === 'buy' ? 1 + slippagePercent : 1 - slippagePercent;
    const fillPrice = marketData.price * slippage;

    // 95% fill rate simulation
    const success = Math.random() > 0.05;

    return {
      success,
      fillPrice: success ? fillPrice : undefined,
    };
  }

  private async createPositionFromOrder(order: Order, fillPrice: number): Promise<Position> {
    // Check if position already exists for this symbol
    const existingPositions = await storage.getPositionsByPortfolio(order.portfolioId);
    const existingPosition = existingPositions.find(pos => 
      pos.symbol === order.symbol && 
      pos.side === order.side &&
      !pos.closeDate
    );

    if (existingPosition) {
      // Update existing position
      const newQuantity = existingPosition.quantity + order.quantity;
      const newEntryPrice = (existingPosition.entryPrice * existingPosition.quantity + fillPrice * order.quantity) / newQuantity;
      const newMarketValue = newQuantity * fillPrice;

      return await storage.updatePosition(existingPosition.id, {
        quantity: newQuantity,
        entryPrice: newEntryPrice,
        currentPrice: fillPrice,
        marketValue: newMarketValue,
        unrealizedPnL: 0, // Reset unrealized P&L
      });
    } else {
      // Create new position
      return await storage.createPosition({
        portfolioId: order.portfolioId,
        symbol: order.symbol,
        type: order.symbol.length > 5 ? 'option' : 'stock', // Simple heuristic
        side: order.side === 'buy' ? 'long' : 'short',
        quantity: order.quantity,
        entryPrice: fillPrice,
        currentPrice: fillPrice,
        marketValue: order.quantity * fillPrice,
        unrealizedPnL: 0,
        realizedPnL: 0,
        openDate: new Date(),
        strategyId: order.strategyId,
      });
    }
  }

  async cancelOrder(orderId: string): Promise<Order | null> {
    const order = await storage.getOrder(orderId);
    if (!order || order.status !== 'pending') {
      return order;
    }

    return await storage.updateOrder(orderId, { status: 'cancelled' });
  }

  async getOrderHistory(portfolioId: string): Promise<Order[]> {
    return await storage.getOrdersByPortfolio(portfolioId);
  }

  async getPendingOrders(): Promise<Order[]> {
    return await storage.getOrdersByStatus('pending');
  }

  async processAllPendingOrders(): Promise<void> {
    const pendingOrders = await this.getPendingOrders();
    
    for (const order of pendingOrders) {
      try {
        await this.processOrder(order.id);
      } catch (error) {
        console.error(`Error processing order ${order.id}:`, error);
      }
    }
  }
}
