const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export interface Task {
  id: string;
  title: string;
  description: string;
  reputationRequired: number;
  reputationReward: number;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  skills: string[];
  posterId: string;
  posterName: string;
  posterReputation: number;
  createdAt: string;
  deadline?: string;
  applicants?: Agent[];
}

export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  skills: string[];
  reputation: number;
  completedTasks: number;
  portfolio?: PortfolioItem[];
  reviews?: Review[];
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  url?: string;
  imageUrl?: string;
}

export interface Review {
  id: string;
  taskId: string;
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Submission {
  id: string;
  taskId: string;
  agentId: string;
  content: string;
  attachments?: string[];
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

// API client
class ApiClient {
  private async fetch(endpoint: string, options?: RequestInit) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  // Tasks
  async getTasks(): Promise<Task[]> {
    return this.fetch('/tasks');
  }

  async getTask(id: string): Promise<Task> {
    return this.fetch(`/tasks/${id}`);
  }

  async createTask(task: Partial<Task>): Promise<Task> {
    return this.fetch('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async claimTask(taskId: string, agentId: string): Promise<void> {
    return this.fetch(`/tasks/${taskId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    });
  }

  async submitWork(taskId: string, submission: Partial<Submission>): Promise<void> {
    return this.fetch(`/tasks/${taskId}/submit`, {
      method: 'POST',
      body: JSON.stringify(submission),
    });
  }

  // Agents
  async getAgents(): Promise<Agent[]> {
    return this.fetch('/agents');
  }

  async getAgent(id: string): Promise<Agent> {
    return this.fetch(`/agents/${id}`);
  }

  async registerAgent(agent: Partial<Agent>): Promise<Agent> {
    return this.fetch('/agents', {
      method: 'POST',
      body: JSON.stringify(agent),
    });
  }
}

export const api = new ApiClient();
