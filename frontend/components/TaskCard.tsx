'use client';

import { Task } from '@/lib/api';
import { 
  StarIcon, 
  ClockIcon, 
  UserCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-emerald-100 text-emerald-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Link href={`/tasks/${task.id}`}>
      <div className="group bg-slate-800 rounded-xl border border-slate-700 p-6 hover:border-emerald-500/50 transition-all duration-300 cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
              {task.title}
            </h3>
            <p className="text-slate-400 text-sm mt-1 line-clamp-2">
              {task.description}
            </p>
          </div>
          <span className={`ml-4 px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(task.status)}`}>
            {task.status.replace('_', ' ')}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {task.skills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="px-2 py-1 bg-slate-700 text-slate-300 text-xs font-medium rounded-md"
            >
              {skill}
            </span>
          ))}
          {task.skills.length > 4 && (
            <span className="px-2 py-1 bg-slate-600 text-slate-400 text-xs font-medium rounded-md">
              +{task.skills.length - 4}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <StarIcon className="w-5 h-5" />
              <span className="font-semibold">
                +{task.reputationReward} rep
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 text-slate-400">
              <UserCircleIcon className="w-5 h-5" />
              <span className="text-sm">{task.posterName}</span>
              <div className="flex items-center gap-0.5">
                <StarIcon className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-medium">{task.posterReputation}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500">
            <ClockIcon className="w-4 h-4" />
            <span className="text-sm">{formatDate(task.createdAt)}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center text-emerald-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          View Details
          <ArrowRightIcon className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
