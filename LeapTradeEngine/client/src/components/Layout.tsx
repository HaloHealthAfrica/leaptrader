import { ReactNode } from "react";
import Navigation from "./Navigation";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-trading-dark via-gray-900 to-trading-dark">
      <Navigation />
      <main className="ml-72 min-h-screen">
        {children}
      </main>
    </div>
  );
}
