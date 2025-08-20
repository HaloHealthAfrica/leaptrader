# 🚀 LeapTrader - LEAPS Options Trading System

A comprehensive LEAPS (Long-term Equity Anticipation Securities) options trading system focused on **Long Calls** and **Protective Puts** strategies.

## 🎯 Features

- **Simplified Strategy Focus**: Long Call LEAPS and Protective Put strategies only
- **Real-time Market Data**: Integration with TwelveData, Alpaca, and Tradier APIs
- **Advanced Options Screening**: Multi-factor option selection with sophisticated scoring
- **Risk Management**: Comprehensive risk assessment and confidence calculations
- **Web Dashboard**: Modern React-based interface with real-time updates
- **Production Ready**: Complete deployment automation for VPS hosting

## 🏗️ Architecture

```
LeapTrader/
├── LeapTradeEngine/           # Main application
│   ├── client/               # React frontend
│   ├── server/              # Express.js backend
│   ├── src/                 # Shared TypeScript code
│   └── deployment/          # Deployment scripts & configs
├── tsconfig.json            # TypeScript configuration
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL
- Redis
- Trading API keys (TwelveData, Alpaca, Tradier)

### Local Development

```bash
# Clone the repository
git clone https://github.com/HaloHealthAfrica/leaptrader.git
cd leaptrader

# Install dependencies
cd LeapTradeEngine
npm install
cd client && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Build and start
npm run build
npm start
```

### Production Deployment to VPS

For Hostinger VPS deployment with Claude Code:

```bash
# Using Git-based deployment (recommended)
cd LeapTradeEngine/deployment/scripts
chmod +x git-deploy.sh
./git-deploy.sh -h YOUR_VPS_IP -r https://github.com/HaloHealthAfrica/leaptrader.git

# Using zip-based deployment (alternative)
chmod +x create-zip.sh zip-deploy.sh
./create-zip.sh
./zip-deploy.sh -h YOUR_VPS_IP -f leaptrader-deployment.zip
```

## 📊 Trading Strategies

### Long Call LEAPS
- **Objective**: Profit from upward price movements
- **Selection Criteria**: Delta 0.70-0.90, 1-2 years to expiration
- **Risk Profile**: Limited risk (premium paid), unlimited upside potential

### Protective Put
- **Objective**: Hedge existing stock positions against downside risk
- **Selection Criteria**: Delta -0.20 to -0.40, matches stock position size
- **Risk Profile**: Limited downside protection, maintains upside participation

## 🔧 Configuration

### Environment Variables

```env
# Server
NODE_ENV=production
PORT=3000
DOMAIN=your-domain.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/leaptrader

# Redis
REDIS_URL=redis://localhost:6379

# Trading APIs
TWELVEDATA_API_KEY=your_key
ALPACA_API_KEY=your_key
ALPACA_SECRET_KEY=your_secret
TRADIER_API_KEY=your_key

# Security
JWT_SECRET=your-32-char-secret
CORS_ORIGIN=https://your-domain.com
```

### API Keys Required

1. **TwelveData**: Real-time market data and options chains
2. **Alpaca**: Options trading execution and portfolio management  
3. **Tradier**: Additional market data and backup trading interface

## 📈 Deployment Options

### 1. Automated VPS Deployment
- Complete environment setup
- SSL certificate configuration
- Database and Redis setup
- Process management with systemd
- Monitoring and health checks

### 2. Docker Deployment
```bash
docker-compose up -d
```

### 3. Manual Installation
See [deployment documentation](LeapTradeEngine/deployment/README.md) for detailed instructions.

## 🔍 Monitoring & Management

### Health Check
```bash
curl http://your-server:3000/api/health
```

### Application Management
```bash
# View status
sudo systemctl status leaptrader

# View logs  
sudo journalctl -u leaptrader -f

# Restart application
sudo systemctl restart leaptrader
```

### Performance Monitoring
```bash
# System resources
htop
df -h
free -m

# Application metrics
./LeapTradeEngine/deployment/scripts/monitor.sh
```

## 🛠️ Development

### Project Structure

```
LeapTradeEngine/
├── client/                   # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/          # Application pages  
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
├── server/                  # Express.js backend
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   ├── middleware/         # Express middleware
│   └── models/            # Database models
├── src/                    # Shared code
│   └── strategy/          # Trading strategy implementations
└── deployment/            # Deployment automation
    ├── scripts/           # Deployment scripts
    └── configs/          # Configuration templates
```

### Key Components

- **Strategy Engine**: `src/strategy/LeapsStrategy.ts`
- **Options Screening**: `server/services/strategies/`
- **Frontend Dashboard**: `client/src/pages/Dashboard.tsx`
- **API Routes**: `server/routes/`

## 🔒 Security

- JWT-based authentication
- CORS protection
- Rate limiting on API endpoints
- Environment variable protection
- SSL/TLS encryption in production

## 📝 API Documentation

### Strategy Endpoints
- `GET /api/strategies` - List available strategies
- `POST /api/strategies/scan` - Run strategy scan
- `GET /api/strategies/signals` - Get trading signals

### Market Data Endpoints  
- `GET /api/market/options/:symbol` - Get options chain
- `GET /api/market/quote/:symbol` - Get stock quote
- `GET /api/market/history/:symbol` - Get historical data

### Health & Status
- `GET /api/health` - Application health check
- `GET /api/status` - Detailed system status

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For deployment issues:
```bash
# Check application logs
sudo journalctl -u leaptrader -f

# Run health diagnostics  
node LeapTradeEngine/deployment/scripts/healthcheck.js --comprehensive
```

For questions or issues, please open a GitHub issue.

## 🎯 Roadmap

- [ ] Paper trading mode
- [ ] Advanced backtesting
- [ ] Mobile app interface  
- [ ] Additional LEAPS strategies
- [ ] Machine learning price predictions
- [ ] Integration with more brokers

---

**Happy Trading!** 📈💰

*Built for serious LEAPS options traders who want sophisticated analysis with simplified strategy focus.*