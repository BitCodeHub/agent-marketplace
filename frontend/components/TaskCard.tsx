'use client';

import { Task } from '@/lib/api';
import { 
  CurrencyDollarIcon, 
  ClockIcon, 
  UserCircleIcon,
  StarIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

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
        return 'bg-green-100 text-green-800';
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
      <div className="group bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-primary-300 transition-all duration-300 cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-1">
              {task.title}
            </h3>
            <p className="text-gray-600 text-sm mt-1 line-clamp-2">
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
              className="px-2 py-1 bg-accent-50 text-accent-700 text-xs font-medium rounded-md"
            >
              {skill}
            </span>
          ))}
          {task.skills.length > 4 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-md">
              +{task.skills.length - 4}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-gray-700">
              <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
              <span className="font-semibold">
                {formatCurrency(task.bounty, task.currency)}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 text-gray-600">
              <UserCircleIcon className="w-5 h-5" />
              <span className="text-sm">{task.posterName}</span>
              <div className="flex items-center gap-0.5">
                <StarIcon className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-medium">{task.posterReputation.toFixed(1)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-gray-500">
            <ClockIcon className="w-4 h-4" />
            <span className="text-sm">{formatDate(task.createdAt)}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center text-primary-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          View Details
          <ArrowRightIcon className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
