'use client';

import { useState, useEffect } from 'react';
import { WalletIcon, ChevronDownIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

export function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Check if wallet was previously connected
  useEffect(() => {
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
      setAddress(savedAddress);
      setIsConnected(true);
      onConnect?.(savedAddress);
    }
  }, [onConnect]);

  const connectWallet = async () => {
    setIsLoading(true);
    
    // Simulate wallet connection - in production, integrate with MetaMask, Phantom, etc.
    setTimeout(() => {
      const mockAddress = '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
      setAddress(mockAddress);
      setIsConnected(true);
      localStorage.setItem('walletAddress', mockAddress);
      onConnect?.(mockAddress);
      setIsLoading(false);
    }, 1000);
  };

  const disconnectWallet = () => {
    setAddress(null);
    setIsConnected(false);
    localStorage.removeItem('walletAddress');
    setShowDropdown(false);
    onDisconnect?.();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <button
        onClick={connectWallet}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-600 to-accent-600 text-white font-medium rounded-lg hover:from-primary-700 hover:to-accent-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/25"
      >
        <WalletIcon className="w-5 h-5" />
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Connecting...
          </>
        ) : (
          'Connect Wallet'
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-900 font-medium rounded-lg hover:bg-gray-50 transition-all duration-200"
      >
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        <span className="font-mono text-sm">{formatAddress(address!)}</span>
        <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500">Connected as</p>
              <p className="font-mono text-sm text-gray-900 truncate">{address}</p>
            </div>
            <button
              onClick={disconnectWallet}
              className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors text-sm"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
