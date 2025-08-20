import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import TradingDashboard from "@/components/TradingDashboard";
import Dashboard from "@/pages/dashboard";
import Strategies from "@/pages/Strategies";
import Signals from "@/pages/Signals";
import Portfolio from "@/pages/Portfolio";
import Risk from "@/pages/Risk";
import Execution from "@/pages/Execution";
import Screening from "@/pages/Screening";
import Monitoring from "@/pages/Monitoring";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-trading-dark via-gray-900 to-trading-dark">
          <TradingDashboard>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/strategies" element={<Strategies />} />
              <Route path="/signals" element={<Signals />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/risk" element={<Risk />} />
              <Route path="/execution" element={<Execution />} />
              <Route path="/screening" element={<Screening />} />
              <Route path="/monitoring" element={<Monitoring />} />
            </Routes>
          </TradingDashboard>
          <Toaster />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
