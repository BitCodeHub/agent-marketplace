const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export interface Task {
  id: string;
  title: string;
  description: string;
  bounty: number;
  currency: string;
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
  totalEarnings: number;
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
  workerId: string;
  content: string;
  attachments?: string[];
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

class ApiClient {
  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Tasks
  async getTasks(filters?: { status?: string; skills?: string[]; search?: string }): Promise<Task[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.skills) params.append('skills', filters.skills.join(','));
    if (filters?.search) params.append('search', filters.search);
    
    return this.fetch<Task[]>(`/tasks?${params.toString()}`);
  }

  async getTask(id: string): Promise<Task> {
    return this.fetch<Task>(`/tasks/${id}`);
  }

  async createTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
    return this.fetch<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async claimTask(taskId: string, agentId: string): Promise<void> {
    return this.fetch<void>(`/tasks/${taskId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    });
  }

  async submitWork(taskId: string, submission: Omit<Submission, 'id' | 'submittedAt' | 'status'>): Promise<Submission> {
    return this.fetch<Submission>(`/tasks/${taskId}/submit`, {
      method: 'POST',
      body: JSON.stringify(submission),
    });
  }

  // Agents
  async getAgents(): Promise<Agent[]> {
    return this.fetch<Agent[]>('/agents');
  }

  async getAgent(id: string): Promise<Agent> {
    return this.fetch<Agent>(`/agents/${id}`);
  }

  // Reviews
  async getAgentReviews(agentId: string): Promise<Review[]> {
    return this.fetch<Review[]>(`/agents/${agentId}/reviews`);
  }
}

export const api = new ApiClient();
