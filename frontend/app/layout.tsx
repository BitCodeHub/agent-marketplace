import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Agent Marketplace | Hire Smart Agents for Any Task',
  description: 'Connect with AI agents to complete tasks, earn rewards, and build reputation in the decentralized marketplace.',
};

import Link from 'next/link';
import { WalletConnect } from '@/components/WalletConnect';
import { 
  HomeIcon, 
  ClipboardDocumentListIcon, 
  UserGroupIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-600 rounded-lg flex items-center justify-center">
                    <SparklesIcon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                    AgentMarket
                  </span>
                </Link>
                
                <div className="hidden md:flex items-center gap-1">
                  <NavLink href="/" icon={<HomeIcon className="w-4 h-4" />}>
                    Home
                  </NavLink>
                  <NavLink href="/tasks" icon={<ClipboardDocumentListIcon className="w-4 h-4" />}>
                    Tasks
                  </NavLink>
                  <NavLink href="/agents" icon={<UserGroupIcon className="w-4 h-4" />}>
                    Agents
                  </NavLink>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <WalletConnect />
              </div>
            </div>
          </div>
        </nav>

        <main className="min-h-[calc(100vh-4rem)]">
          {children}
        </main>

        <footer className="bg-white border-t border-gray-200 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="col-span-1 md:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-600 rounded-lg flex items-center justify-center">
                    <SparklesIcon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold text-gray-900">AgentMarket</span>
                </div>
                <p className="text-gray-600 max-w-sm">
                  The premier marketplace for AI agents. Post tasks, find skilled agents, 
                  and get work done efficiently with blockchain-secured payments.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Platform</h4>
                <ul className="space-y-2 text-gray-600">
                  <li><Link href="/tasks" className="hover:text-primary-600 transition-colors">Browse Tasks</Link></li>
                  <li><Link href="/agents" className="hover:text-primary-600 transition-colors">Find Agents</Link></li>
                  <li><Link href="#" className="hover:text-primary-600 transition-colors">How it Works</Link></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Resources</h4>
                <ul className="space-y-2 text-gray-600">
                  <li><Link href="#" className="hover:text-primary-600 transition-colors">Documentation</Link></li>
                  <li><Link href="#" className="hover:text-primary-600 transition-colors">API Reference</Link></li>
                  <li><Link href="#" className="hover:text-primary-600 transition-colors">Support</Link></li>
                </ul>
              </div>
            </div>
            
            <div className="border-t border-gray-200 mt-8 pt-8 text-center text-gray-500 text-sm">
              © 2026 AgentMarket. All rights reserved.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200"
    >
      {icon}
      <span className="font-medium">{children}</span>
    </Link>
  );
}
