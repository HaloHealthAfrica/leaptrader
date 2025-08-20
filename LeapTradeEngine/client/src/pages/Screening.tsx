import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  BarChart3,
  Target,
  RefreshCw
} from "lucide-react";
import { formatCurrency, formatPercentage, getSymbolAvatar } from "@/utils/formatters";

interface ScreeningCriteria {
  minMarketCap?: number;
  maxMarketCap?: number;
  minVolume?: number;
  sector?: string;
  minPrice?: number;
  maxPrice?: number;
  strategy?: string;
}

export default function Screening() {
  const [selectedTab, setSelectedTab] = useState("fundamental");
  const [criteria, setCriteria] = useState<ScreeningCriteria>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Mock screening results - in production would come from API
  const mockScreeningResults = [
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      price: 194.25,
      marketCap: 3000000000000,
      volume: 89543210,
      pe: 28.5,
      beta: 1.2,
      sector: "Technology",
      fundamentalScore: 8.4,
      technicalScore: 7.8,
      optionVolume: 234567,
      impliedVolatility: 0.28,
      recommendation: "strong_buy" as const
    },
    {
      symbol: "MSFT",
      name: "Microsoft Corporation",
      price: 428.50,
      marketCap: 3200000000000,
      volume: 45678901,
      pe: 32.1,
      beta: 0.9,
      sector: "Technology",
      fundamentalScore: 8.8,
      technicalScore: 8.2,
      optionVolume: 189234,
      impliedVolatility: 0.24,
      recommendation: "strong_buy" as const
    },
    {
      symbol: "TSLA",
      name: "Tesla Inc.",
      price: 238.15,
      marketCap: 760000000000,
      volume: 123456789,
      pe: 45.2,
      beta: 2.0,
      sector: "Automotive",
      fundamentalScore: 6.9,
      technicalScore: 5.8,
      optionVolume: 456789,
      impliedVolatility: 0.45,
      recommendation: "hold" as const
    },
    {
      symbol: "GOOGL",
      name: "Alphabet Inc.",
      price: 178.32,
      marketCap: 2200000000000,
      volume: 34567890,
      pe: 26.8,
      beta: 1.1,
      sector: "Technology",
      fundamentalScore: 8.1,
      technicalScore: 7.5,
      optionVolume: 145623,
      impliedVolatility: 0.29,
      recommendation: "buy" as const
    },
  ];

  const getRecommendationBadge = (recommendation: string) => {
    switch (recommendation) {
      case 'strong_buy':
        return 'bg-success-green/20 text-success-green border-success-green/30';
      case 'buy':
        return 'bg-accent-blue/20 text-accent-blue border-accent-blue/30';
      case 'hold':
        return 'bg-warning-orange/20 text-warning-orange border-warning-orange/30';
      case 'sell':
        return 'bg-danger-red/20 text-danger-red border-danger-red/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-success-green';
    if (score >= 6) return 'text-warning-orange';
    return 'text-danger-red';
  };

  const filteredResults = mockScreeningResults.filter(result => {
    if (searchQuery && !result.symbol.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !result.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (criteria.minMarketCap && result.marketCap < criteria.minMarketCap) return false;
    if (criteria.maxMarketCap && result.marketCap > criteria.maxMarketCap) return false;
    if (criteria.minVolume && result.volume < criteria.minVolume) return false;
    if (criteria.sector && result.sector !== criteria.sector) return false;
    if (criteria.minPrice && result.price < criteria.minPrice) return false;
    if (criteria.maxPrice && result.price > criteria.maxPrice) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Screening Header */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Market Screening</h2>
            <p className="text-gray-400">Find optimal LEAP options trading opportunities</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Save Screen
            </Button>
            <Button size="sm" className="bg-accent-blue hover:bg-accent-blue/80">
              <RefreshCw className="w-4 h-4 mr-2" />
              Run Screen
            </Button>
          </div>
        </div>

        {/* Search and Quick Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="md:col-span-2">
            <Label htmlFor="search">Search Symbols</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search symbols or company names..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-trading-card border-trading-border"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="sector">Sector</Label>
            <Select value={criteria.sector || ""} onValueChange={(value) => setCriteria({...criteria, sector: value})}>
              <SelectTrigger className="bg-trading-card border-trading-border">
                <SelectValue placeholder="All Sectors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Sectors</SelectItem>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Healthcare">Healthcare</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
                <SelectItem value="Energy">Energy</SelectItem>
                <SelectItem value="Automotive">Automotive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="strategy">Strategy Focus</Label>
            <Select value={criteria.strategy || ""} onValueChange={(value) => setCriteria({...criteria, strategy: value})}>
              <SelectTrigger className="bg-trading-card border-trading-border">
                <SelectValue placeholder="All Strategies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Strategies</SelectItem>
                <SelectItem value="stock_replacement">Stock Replacement</SelectItem>
                <SelectItem value="covered_call">Covered Call</SelectItem>
                <SelectItem value="protective_put">Protective Put</SelectItem>
                <SelectItem value="iron_condor">Iron Condor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Screening Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <Search className="w-8 h-8 text-accent-blue mx-auto mb-2" />
            <div className="text-2xl font-bold">{filteredResults.length}</div>
            <div className="text-sm text-gray-400">Results Found</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <TrendingUp className="w-8 h-8 text-success-green mx-auto mb-2" />
            <div className="text-2xl font-bold">
              {filteredResults.filter(r => r.recommendation === 'strong_buy' || r.recommendation === 'buy').length}
            </div>
            <div className="text-sm text-gray-400">Buy Signals</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <Target className="w-8 h-8 text-accent-purple mx-auto mb-2" />
            <div className="text-2xl font-bold">
              {filteredResults.filter(r => r.fundamentalScore >= 8).length}
            </div>
            <div className="text-sm text-gray-400">High Quality</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <BarChart3 className="w-8 h-8 text-warning-orange mx-auto mb-2" />
            <div className="text-2xl font-bold">
              {Math.round(filteredResults.reduce((acc, r) => acc + r.fundamentalScore, 0) / filteredResults.length * 10) / 10 || 0}
            </div>
            <div className="text-sm text-gray-400">Avg Score</div>
          </div>
        </div>
      </div>

      {/* Screening Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4 bg-trading-card">
          <TabsTrigger value="fundamental">Fundamental</TabsTrigger>
          <TabsTrigger value="technical">Technical</TabsTrigger>
          <TabsTrigger value="options">Options</TabsTrigger>
          <TabsTrigger value="results">Results ({filteredResults.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="fundamental" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Fundamental Screening Criteria</CardTitle>
              <CardDescription>Set criteria based on financial fundamentals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="minMarketCap">Minimum Market Cap ($B)</Label>
                    <Input
                      id="minMarketCap"
                      type="number"
                      placeholder="e.g., 10"
                      value={criteria.minMarketCap ? criteria.minMarketCap / 1000000000 : ''}
                      onChange={(e) => setCriteria({...criteria, minMarketCap: parseFloat(e.target.value) * 1000000000})}
                      className="bg-trading-card border-trading-border"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxMarketCap">Maximum Market Cap ($B)</Label>
                    <Input
                      id="maxMarketCap"
                      type="number"
                      placeholder="e.g., 5000"
                      value={criteria.maxMarketCap ? criteria.maxMarketCap / 1000000000 : ''}
                      onChange={(e) => setCriteria({...criteria, maxMarketCap: parseFloat(e.target.value) * 1000000000})}
                      className="bg-trading-card border-trading-border"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="minVolume">Minimum Daily Volume (M)</Label>
                    <Input
                      id="minVolume"
                      type="number"
                      placeholder="e.g., 1"
                      value={criteria.minVolume ? criteria.minVolume / 1000000 : ''}
                      onChange={(e) => setCriteria({...criteria, minVolume: parseFloat(e.target.value) * 1000000})}
                      className="bg-trading-card border-trading-border"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="minPrice">Min Price ($)</Label>
                      <Input
                        id="minPrice"
                        type="number"
                        placeholder="e.g., 50"
                        value={criteria.minPrice || ''}
                        onChange={(e) => setCriteria({...criteria, minPrice: parseFloat(e.target.value)})}
                        className="bg-trading-card border-trading-border"
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxPrice">Max Price ($)</Label>
                      <Input
                        id="maxPrice"
                        type="number"
                        placeholder="e.g., 1000"
                        value={criteria.maxPrice || ''}
                        onChange={(e) => setCriteria({...criteria, maxPrice: parseFloat(e.target.value)})}
                        className="bg-trading-card border-trading-border"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technical" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Technical Analysis Filters</CardTitle>
              <CardDescription>Screen based on technical indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-400">
                <BarChart3 className="w-16 h-16 mx-auto mb-4" />
                <p className="text-lg mb-2">Technical Screening</p>
                <p className="text-sm">Coming Soon - RSI, MACD, Moving Averages, and more</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="options" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Options-Specific Criteria</CardTitle>
              <CardDescription>Filter based on options characteristics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-400">
                <Target className="w-16 h-16 mx-auto mb-4" />
                <p className="text-lg mb-2">Options Screening</p>
                <p className="text-sm">Coming Soon - IV, Open Interest, Volume, Greeks</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Screening Results</CardTitle>
              <CardDescription>Stocks matching your criteria</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-trading-border">
                    <TableHead>Symbol</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Market Cap</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Fundamental</TableHead>
                    <TableHead>Technical</TableHead>
                    <TableHead>Options</TableHead>
                    <TableHead>Recommendation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-400">
                        No results found. Try adjusting your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredResults.map((result) => (
                      <TableRow key={result.symbol} className="border-trading-border hover:bg-white/5">
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className={getSymbolAvatar(result.symbol)}>
                              {result.symbol.substring(0, 4)}
                            </div>
                            <div>
                              <div className="font-medium">{result.symbol}</div>
                              <div className="text-xs text-gray-400">{result.name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{formatCurrency(result.price)}</div>
                          <div className="text-xs text-gray-400">PE: {result.pe}</div>
                        </TableCell>
                        <TableCell>
                          <div>{formatCurrency(result.marketCap, 0)}</div>
                          <div className="text-xs text-gray-400">Beta: {result.beta}</div>
                        </TableCell>
                        <TableCell>
                          <div>{(result.volume / 1000000).toFixed(1)}M</div>
                          <div className="text-xs text-gray-400">Options: {(result.optionVolume / 1000).toFixed(0)}K</div>
                        </TableCell>
                        <TableCell>
                          <div className={`font-medium ${getScoreColor(result.fundamentalScore)}`}>
                            {result.fundamentalScore.toFixed(1)}/10
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                            <div 
                              className="bg-accent-blue h-1 rounded-full" 
                              style={{ width: `${(result.fundamentalScore / 10) * 100}%` }}
                            ></div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`font-medium ${getScoreColor(result.technicalScore)}`}>
                            {result.technicalScore.toFixed(1)}/10
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                            <div 
                              className="bg-accent-purple h-1 rounded-full" 
                              style={{ width: `${(result.technicalScore / 10) * 100}%` }}
                            ></div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{formatPercentage(result.impliedVolatility * 100, 1)}</div>
                          <div className="text-xs text-gray-400">IV</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getRecommendationBadge(result.recommendation)}>
                            {result.recommendation.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
