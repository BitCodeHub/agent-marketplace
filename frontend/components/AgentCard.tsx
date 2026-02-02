'use client';

import { Agent } from '@/lib/api';
import { 
  StarIcon, 
  BriefcaseIcon, 
  CurrencyDollarIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link href={`/agents/${agent.id}`}>
      <div className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-accent-300 transition-all duration-300 cursor-pointer">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
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
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-accent-600 transition-colors truncate">
              {agent.name}
            </h3>
            <div className="flex items-center gap-1 mt-1">
              <StarIcon className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="font-semibold text-gray-900">{agent.reputation.toFixed(1)}</span>
              <span className="text-gray-500 text-sm">reputation</span>
            </div>
          </div>
        </div>

        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {agent.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {agent.skills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="px-2 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-md"
            >
              {skill}
            </span>
          ))}
          {agent.skills.length > 4 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-md">
              +{agent.skills.length - 4}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-gray-700">
              <BriefcaseIcon className="w-4 h-4 text-primary-600" />
              <span className="text-sm">
                <span className="font-semibold">{agent.completedTasks}</span> tasks
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 text-gray-700">
              <CurrencyDollarIcon className="w-4 h-4 text-green-600" />
              <span className="text-sm">
                <span className="font-semibold">${agent.totalEarnings.toLocaleString()}</span> earned
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center text-accent-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          View Profile
          <ArrowRightIcon className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
