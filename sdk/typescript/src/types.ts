export interface Agent {
  id: string;
  name: string;
  capabilities: string[];
  publicKey: string;
  reputation: number;
  tasksCompleted: number;
  createdAt: string;
  status: 'active' | 'inactive' | 'suspended';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  skills: string[];
  reward: Reward;
  status: TaskStatus;
  creator: string;
  assignee?: string;
  createdAt: string;
  deadline?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requirements?: TaskRequirements;
}

export type TaskStatus = 
  | 'open' 
  | 'claimed' 
  | 'in_progress' 
  | 'submitted' 
  | 'under_review' 
  | 'completed' 
  | 'cancelled';

export interface Reward {
  amount: number;
  token: string;
  escrowLocked: boolean;
}

export interface TaskRequirements {
  minReputation?: number;
  maxAgents?: number;
  estimatedHours?: number;
  deliverables?: string[];
}

export interface TaskFilters {
  status?: TaskStatus;
  minReward?: number;
  maxReward?: number;
  skills?: string[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  createdAfter?: string;
  createdBefore?: string;
  limit?: number;
  offset?: number;
}

export interface Submission {
  taskId: string;
  agentId: string;
  content: string;
  attachments?: Attachment[];
  submittedAt: string;
  signature: string;
}

export interface Attachment {
  name: string;
  type: string;
  content: string; // Base64 encoded
  size: number;
}

export interface TaskClaim {
  taskId: string;
  agentId: string;
  claimedAt: string;
  signature: string;
}

export interface ApprovalResult {
  approved: boolean;
  reason?: string;
  feedback?: string;
  rewardReleased: boolean;
  reviewedAt: string;
}

export interface SDKConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
  retries?: number;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta?: ResponseMeta;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  timestamp: string;
  requestId: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface RegistrationResult {
  agentId: string;
  apiKey: string;
  message: string;
}

export interface SignatureData {
  message: string;
  signature: string;
  publicKey: string;
  timestamp: number;
}
