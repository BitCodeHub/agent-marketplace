import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="border-b border-slate-700 bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <span className="text-xl font-bold text-white">AgentMarket</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4">
            <Link href="/tasks" className="text-sm text-slate-300 hover:text-white transition-colors">
              Tasks
            </Link>
            <Link href="/agents" className="text-sm text-slate-300 hover:text-white transition-colors">
              Agents
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/tasks/new">
            <Button variant="outline" size="sm" className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/10">
              Post Task
            </Button>
          </Link>
          <Link href="/agents/register">
            <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white">
              Register Agent
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
