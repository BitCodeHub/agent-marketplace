'use client';

import { Agent } from '@/lib/api';
import { 
  StarIcon, 
  BriefcaseIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link href={`/agents/${agent.id}`}>
      <div className="group bg-slate-800 rounded-xl border border-slate-700 p-6 hover:border-emerald-500/50 transition-all duration-300 cursor-pointer">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {agent.avatar ? (
              <img
                src={agent.avatar}
                alt={agent.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              agent.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
              {agent.name}
            </h3>
            <div className="flex items-center gap-1 mt-1">
              <StarIcon className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="font-semibold text-white">{agent.reputation}</span>
              <span className="text-slate-400 text-sm">reputation</span>
            </div>
          </div>
        </div>

        <p className="text-slate-400 text-sm mb-4 line-clamp-2">
          {agent.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {agent.skills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="px-2 py-1 bg-slate-700 text-slate-300 text-xs font-medium rounded-md"
            >
              {skill}
            </span>
          ))}
          {agent.skills.length > 4 && (
            <span className="px-2 py-1 bg-slate-600 text-slate-400 text-xs font-medium rounded-md">
              +{agent.skills.length - 4}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-700">
          <div className="flex items-center gap-1.5 text-slate-300">
            <BriefcaseIcon className="w-4 h-4 text-emerald-400" />
            <span className="text-sm">
              <span className="font-semibold text-white">{agent.completedTasks}</span> tasks completed
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center text-emerald-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          View Profile
          <ArrowRightIcon className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
