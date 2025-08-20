# Overview

LEAP Trading Engine is a comprehensive options trading platform designed specifically for LEAP (Long-term Equity AnticiPation Securities) strategies. The system provides automated signal generation, risk management, portfolio optimization, and order execution capabilities with real-time market data integration from multiple providers including Twelvedata, Alpaca, and Tradier.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build system
- **UI Components**: Shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom glassmorphism design system
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: React Router for client-side navigation
- **Design Philosophy**: Modern professional interface with dark theme and gradient glass effects

## Backend Architecture
- **Runtime**: Node.js with Express.js REST API server
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **API Design**: RESTful endpoints with comprehensive error handling and logging
- **Background Jobs**: Scheduled tasks for market data collection, signal generation, and portfolio monitoring
- **Services Layer**: Modular service architecture with separate concerns for market data, portfolio management, risk calculation, signal generation, and order execution

## Data Storage Solutions
- **Primary Database**: PostgreSQL for persistent data storage
- **ORM**: Drizzle with schema definitions in TypeScript
- **Caching**: In-memory caching for frequently accessed market data and API responses
- **Database Schema**: Comprehensive schema covering market data, option data, portfolios, positions, trading signals, orders, risk metrics, and strategy configurations

## Authentication and Authorization
- **Session Management**: PostgreSQL-backed session storage using connect-pg-simple
- **Security**: CORS configuration and request validation middleware
- **API Protection**: Rate limiting and request timeout configurations

## External Dependencies

### Market Data Providers
- **Twelvedata API**: Primary source for stock market data and historical information
- **Alpaca Markets**: Real-time market data and paper trading capabilities for order execution
- **Tradier API**: Comprehensive options chain data and Greeks calculations

### Development and Build Tools
- **TypeScript**: Full type safety across frontend and backend
- **ESBuild**: Fast bundling for production builds
- **Drizzle Kit**: Database migration and schema management
- **Winston**: Structured logging for system monitoring and debugging

### UI and Styling
- **Tailwind CSS**: Utility-first CSS framework with custom trading-specific color palette
- **Lucide React**: Professional icon library for financial interfaces
- **Recharts**: Data visualization library for portfolio performance charts

### Database and Infrastructure
- **Neon Database**: Serverless PostgreSQL for scalable data storage
- **Node Cache**: In-memory caching layer for performance optimization

The system is designed with modularity and scalability in mind, using a service-oriented architecture that separates concerns and allows for easy extension of trading strategies and data sources.