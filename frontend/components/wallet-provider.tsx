"use client";

import { createContext, useContext, ReactNode } from "react";

interface WalletContextType {
  connected: boolean;
  address: string | null;
}

const WalletContext = createContext<WalletContextType>({
  connected: false,
  address: null,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WalletContext.Provider value={{ connected: false, address: null }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
