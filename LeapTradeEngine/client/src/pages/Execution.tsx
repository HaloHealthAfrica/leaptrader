import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, queryClient } from "@/lib/queryClient";
import { usePortfolio } from "@/hooks/usePortfolio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Play, 
  Pause, 
  X, 
  Clock, 
  CheckCircle, 
  XCircle,
  MoreVertical,
  Plus,
  AlertTriangle
} from "lucide-react";
import { formatCurrency, formatDate, getSymbolAvatar, getStatusBadge } from "@/utils/formatters";
import { useToast } from "@/hooks/use-toast";

export default function Execution() {
  const [selectedTab, setSelectedTab] = useState("pending");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isExecuteDialogOpen, setIsExecuteDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  
  const { data: portfolios = [] } = usePortfolio();
  const { toast } = useToast();
  
  const mainPortfolio = portfolios[0];
  const portfolioId = mainPortfolio?.id;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['/api/orders', { portfolioId }],
    queryFn: () => portfolioId ? api.getOrders({ portfolioId }) : [],
    enabled: !!portfolioId,
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  const { data: activeSignals = [] } = useQuery({
    queryKey: ['/api/signals', { status: 'active' }],
    queryFn: () => api.getSignals({ status: 'active' }),
  });

  const executeSignalMutation = useMutation({
    mutationFn: ({ signalId, quantity }: { signalId: string; quantity: number }) =>
      api.executeSignal(signalId, portfolioId!, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/signals'] });
      setIsExecuteDialogOpen(false);
      setQuantity("");
      toast({
        title: "Order Executed",
        description: "Signal has been executed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to execute signal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const pendingOrders = orders.filter(order => order.status === 'pending');
  const filledOrders = orders.filter(order => order.status === 'filled');
  const cancelledOrders = orders.filter(order => order.status === 'cancelled' || order.status === 'rejected');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-warning-orange" />;
      case 'filled':
        return <CheckCircle className="w-4 h-4 text-success-green" />;
      case 'cancelled':
      case 'rejected':
        return <XCircle className="w-4 h-4 text-danger-red" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const handleExecuteSignal = (signal: any) => {
    setSelectedOrder(signal);
    setIsExecuteDialogOpen(true);
  };

  const handleConfirmExecution = () => {
    if (!selectedOrder || !quantity) return;
    
    executeSignalMutation.mutate({
      signalId: selectedOrder.id,
      quantity: parseInt(quantity)
    });
  };

  const OrderTable = ({ orders, emptyMessage }: { orders: any[]; emptyMessage: string }) => (
    <Table>
      <TableHeader>
        <TableRow className="border-trading-border">
          <TableHead>Symbol</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Side</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-8 text-gray-400">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          orders.map((order) => (
            <TableRow key={order.id} className="border-trading-border hover:bg-white/5">
              <TableCell>
                <div className="flex items-center space-x-2">
                  <div className={getSymbolAvatar(order.symbol)}>
                    {order.symbol.substring(0, 4)}
                  </div>
                  <span className="font-medium">{order.symbol}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{order.type.toUpperCase()}</Badge>
              </TableCell>
              <TableCell>
                <Badge className={order.side === 'buy' ? 'btn-buy' : 'btn-sell'}>
                  {order.side.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell>{order.quantity.toLocaleString()}</TableCell>
              <TableCell>
                {order.price ? formatCurrency(order.price) : 'Market'}
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(order.status)}
                  <Badge className={getStatusBadge(order.status)}>
                    {order.status.toUpperCase()}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>{formatDate(order.createdAt)}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="glass-card animate-pulse h-64"></div>
        <div className="glass-card animate-pulse h-96"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Execution Overview */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Order Execution</h2>
            <p className="text-gray-400">Manage order execution and monitor trading activity</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Manual Order
            </Button>
          </div>
        </div>

        {/* Execution Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <Clock className="w-8 h-8 text-warning-orange mx-auto mb-2" />
            <div className="text-2xl font-bold text-warning-orange">{pendingOrders.length}</div>
            <div className="text-sm text-gray-400">Pending Orders</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <CheckCircle className="w-8 h-8 text-success-green mx-auto mb-2" />
            <div className="text-2xl font-bold text-success-green">{filledOrders.length}</div>
            <div className="text-sm text-gray-400">Filled Today</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <XCircle className="w-8 h-8 text-danger-red mx-auto mb-2" />
            <div className="text-2xl font-bold text-danger-red">{cancelledOrders.length}</div>
            <div className="text-sm text-gray-400">Cancelled</div>
          </div>
          <div className="text-center p-4 bg-white/5 rounded-lg">
            <Play className="w-8 h-8 text-accent-blue mx-auto mb-2" />
            <div className="text-2xl font-bold text-accent-blue">{activeSignals.length}</div>
            <div className="text-sm text-gray-400">Ready to Execute</div>
          </div>
        </div>
      </div>

      {/* Order Management Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4 bg-trading-card">
          <TabsTrigger value="pending">Pending ({pendingOrders.length})</TabsTrigger>
          <TabsTrigger value="filled">Filled ({filledOrders.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({cancelledOrders.length})</TabsTrigger>
          <TabsTrigger value="signals">Ready to Execute ({activeSignals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Pending Orders</CardTitle>
              <CardDescription>Orders awaiting execution</CardDescription>
            </CardHeader>
            <CardContent>
              <OrderTable orders={pendingOrders} emptyMessage="No pending orders" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="filled" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Filled Orders</CardTitle>
              <CardDescription>Successfully executed orders</CardDescription>
            </CardHeader>
            <CardContent>
              <OrderTable orders={filledOrders} emptyMessage="No filled orders" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cancelled" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Cancelled/Rejected Orders</CardTitle>
              <CardDescription>Orders that were cancelled or rejected</CardDescription>
            </CardHeader>
            <CardContent>
              <OrderTable orders={cancelledOrders} emptyMessage="No cancelled orders" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signals" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Signals Ready for Execution</CardTitle>
              <CardDescription>Active signals that can be executed</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-trading-border">
                    <TableHead>Symbol</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target Price</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Expected Return</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSignals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                        No signals ready for execution
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeSignals.map((signal) => (
                      <TableRow key={signal.id} className="border-trading-border hover:bg-white/5">
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <div className={getSymbolAvatar(signal.symbol)}>
                              {signal.symbol.substring(0, 4)}
                            </div>
                            <span className="font-medium">{signal.symbol}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {signal.strategy.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={signal.action === 'buy' ? 'btn-buy' : 'btn-sell'}>
                            {signal.action.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(signal.targetPrice || 0)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span>{signal.confidence.toFixed(1)}/10</span>
                            <div className="w-16 bg-gray-700 rounded-full h-1">
                              <div 
                                className="bg-accent-blue h-1 rounded-full" 
                                style={{ width: `${(signal.confidence / 10) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${
                            (signal.expectedReturn || 0) >= 0 ? 'text-success-green' : 'text-danger-red'
                          }`}>
                            {signal.expectedReturn ? `${signal.expectedReturn.toFixed(1)}%` : 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            onClick={() => handleExecuteSignal(signal)}
                            className="bg-success-green hover:bg-success-green/80"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Execute
                          </Button>
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

      {/* Execute Signal Dialog */}
      <Dialog open={isExecuteDialogOpen} onOpenChange={setIsExecuteDialogOpen}>
        <DialogContent className="glass-card border-trading-border">
          <DialogHeader>
            <DialogTitle>Execute Signal</DialogTitle>
            <DialogDescription>
              Configure order parameters for signal execution
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-lg">
                <div className="flex items-center space-x-3 mb-3">
                  <div className={getSymbolAvatar(selectedOrder.symbol)}>
                    {selectedOrder.symbol.substring(0, 4)}
                  </div>
                  <div>
                    <div className="font-medium">{selectedOrder.symbol}</div>
                    <div className="text-sm text-gray-400">
                      {selectedOrder.strategy.replace('_', ' ')} • {selectedOrder.action.toUpperCase()}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Target Price:</span>
                    <span className="ml-2 font-medium">{formatCurrency(selectedOrder.targetPrice || 0)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Confidence:</span>
                    <span className="ml-2 font-medium">{selectedOrder.confidence.toFixed(1)}/10</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  className="bg-trading-card border-trading-border"
                />
              </div>

              <div className="flex items-start space-x-2 p-3 bg-warning-orange/10 border border-warning-orange/30 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-warning-orange mt-0.5" />
                <div className="text-sm">
                  <p className="text-warning-orange font-medium">Risk Warning</p>
                  <p className="text-gray-300">
                    This will execute a market order. Please review all parameters before confirming.
                  </p>
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button 
                  onClick={handleConfirmExecution}
                  disabled={!quantity || executeSignalMutation.isPending}
                  className="flex-1 bg-success-green hover:bg-success-green/80"
                >
                  {executeSignalMutation.isPending ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Execute Order
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsExecuteDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
