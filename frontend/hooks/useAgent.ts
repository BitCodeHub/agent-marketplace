'use client';

import useSWR from 'swr';
import { api, Agent, Review } from '@/lib/api';

export function useAgents() {
  const { data, error, isLoading, mutate } = useSWR<Agent[]>(
    '/agents',
    () => api.getAgents(),
    {
      refreshInterval: 60000,
    }
  );

  return {
    agents: data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useAgent(id: string) {
  const { data, error, isLoading, mutate } = useSWR<Agent>(
    id ? `/agents/${id}` : null,
    () => api.getAgent(id),
    {
      refreshInterval: 30000,
    }
  );

  return {
    agent: data,
    isLoading,
    error,
    mutate,
  };
}

export function useAgentReviews(agentId: string) {
  const { data, error, isLoading } = useSWR<Review[]>(
    agentId ? `/agents/${agentId}/reviews` : null,
    () => api.getAgentReviews(agentId),
    {
      refreshInterval: 60000,
    }
  );

  return {
    reviews: data || [],
    isLoading,
    error,
  };
}
