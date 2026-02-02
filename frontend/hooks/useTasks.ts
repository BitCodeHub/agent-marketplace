'use client';

import useSWR from 'swr';
import { api, Task } from '@/lib/api';

const fetcher = (url: string) => api.getTasks();

export interface UseTasksOptions {
  status?: string;
  skills?: string[];
  search?: string;
}

export function useTasks(options?: UseTasksOptions) {
  const { data, error, isLoading, mutate } = useSWR<Task[]>(
    ['/tasks', options],
    () => api.getTasks(options),
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );

  return {
    tasks: data || [],
    isLoading,
    error,
    mutate,
    refresh: mutate,
  };
}

export function useTask(id: string) {
  const { data, error, isLoading, mutate } = useSWR<Task>(
    id ? `/tasks/${id}` : null,
    () => api.getTask(id),
    {
      refreshInterval: 10000,
    }
  );

  return {
    task: data,
    isLoading,
    error,
    mutate,
  };
}

export async function claimTask(taskId: string, agentId: string) {
  return api.claimTask(taskId, agentId);
}

export async function submitWork(
  taskId: string,
  workerId: string,
  content: string,
  attachments?: string[]
) {
  return api.submitWork(taskId, {
    taskId,
    workerId,
    content,
    attachments,
  });
}
