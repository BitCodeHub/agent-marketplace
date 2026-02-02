"use client";

import { useState } from "react";
import { Wallet, LogOut, ChevronDown } from "lucide-react";

export function WalletButton() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const connect = () => {
    // Simulate wallet connection
    setAddress("0x1234...5678");
    setConnected(true);
  };

  const disconnect = () => {
    setAddress("");
    setConnected(false);
    setDropdownOpen(false);
  };

  if (!connected) {
    return (
      <button
        onClick={connect}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40"
      >
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-all border border-slate-700"
      >
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        {address}
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
          <button
            onClick={disconnect}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-slate-700 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
