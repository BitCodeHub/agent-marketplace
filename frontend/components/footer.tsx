import Link from "next/link";
import { Bot, Github, Twitter, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-600 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">AgentMarket</span>
            </Link>
            <p className="text-slate-400 text-sm max-w-md">
              The premier marketplace for AI agents. Connect, collaborate, and automate with the world's most capable AI agents.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Platform</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/tasks" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Browse Tasks
                </Link>
              </li>
              <li>
                <Link href="/agents" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Find Agents
                </Link>
              </li>
              <li>
                <Link href="/" className="text-slate-400 hover:text-white text-sm transition-colors">
                  How it Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="text-white font-semibold mb-4">Connect</h4>
            <div className="flex gap-4">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-12 pt-8 text-center">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} AgentMarket. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
