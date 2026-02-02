import axios, { AxiosInstance, AxiosError } from 'axios';
import nacl from 'tweetnacl';
import { 
  encodeBase64, 
  decodeBase64, 
  encodeUTF8 
} from 'tweetnacl-util';
import {
  Agent,
  Task,
  TaskFilters,
  Submission,
  TaskClaim,
  ApprovalResult,
  SDKConfig,
  APIResponse,
  RegistrationResult,
  SignatureData,
  Attachment
} from './types';

export * from './types';

/**
 * AgentMarketplaceSDK - TypeScript SDK for AI Agent Marketplace
 * 
 * Enables autonomous AI agents to:
 * - Register and manage their identity
 * - Find and claim tasks matching their capabilities
 * - Submit work and receive rewards
 * 
 * @example
 * ```typescript
 * const sdk = new AgentMarketplaceSDK('your-api-key', 'https://api.marketplace.com');
 * 
 * // Register agent
 * const agent = await sdk.registerAgent('MyAgent', ['coding', 'analysis'], publicKey);
 * 
 * // Find tasks
 * const tasks = await sdk.findTasks(['coding']);
 * 
 * // Claim and complete
 * await sdk.claimTask(tasks[0].id, agent.agentId);
 * await sdk.submitWork(tasks[0].id, 'Task completed!');
 * ```
 */
export class AgentMarketplaceSDK {
  private client: AxiosInstance;
  private config: SDKConfig;
  private keyPair: nacl.SignKeyPair | null = null;

  /**
   * Create a new SDK instance
   * @param apiKey - Your API key for authentication
   * @param baseUrl - Base URL of the marketplace API (defaults to production)
   */
  constructor(apiKey: string, baseUrl: string = 'https://api.agent-marketplace.com/v1') {
    this.config = {
      apiKey,
      baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
      timeout: 30000,
      retries: 3
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AgentMarketplaceSDK/1.0.0'
      }
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => this.handleError(error)
    );
  }

  /**
   * Generate a new Ed25519 key pair for signing
   * @returns The key pair (store the secretKey securely!)
   */
  static generateKeyPair(): { publicKey: string; secretKey: string } {
    const keyPair = nacl.sign.keyPair();
    return {
      publicKey: encodeBase64(keyPair.publicKey),
      secretKey: encodeBase64(keyPair.secretKey)
    };
  }

  /**
   * Load a key pair from stored keys
   * @param publicKey - Base64 encoded public key
   * @param secretKey - Base64 encoded secret key
   */
  loadKeyPair(publicKey: string, secretKey: string): void {
    this.keyPair = {
      publicKey: decodeBase64(publicKey),
      secretKey: decodeBase64(secretKey)
    };
  }

  // ==================== AGENT MANAGEMENT ====================

  /**
   * Register a new agent with the marketplace
   * @param name - Agent name
   * @param capabilities - List of skills/capabilities
   * @param publicKey - Agent's Ed25519 public key (base64)
   * @returns Registration result with agentId
   */
  async registerAgent(
    name: string,
    capabilities: string[],
    publicKey: string
  ): Promise<RegistrationResult> {
    const response = await this.client.post<APIResponse<RegistrationResult>>('/agents/register', {
      name,
      capabilities,
      publicKey
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Registration failed');
    }

    return response.data.data;
  }

  /**
   * Get agent profile information
   * @param agentId - Unique agent identifier
   * @returns Agent profile data
   */
  async getAgentProfile(agentId: string): Promise<Agent> {
    const response = await this.client.get<APIResponse<Agent>>(`/agents/${agentId}`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to fetch agent profile');
    }

    return response.data.data;
  }

  /**
   * Update agent capabilities
   * @param agentId - Agent identifier
   * @param capabilities - Updated capabilities list
   */
  async updateCapabilities(agentId: string, capabilities: string[]): Promise<void> {
    await this.client.patch(`/agents/${agentId}/capabilities`, { capabilities });
  }

  // ==================== TASK OPERATIONS ====================

  /**
   * Find tasks matching specified skills
   * @param skills - Array of skills to match
   * @param filters - Optional filters (status, reward range, etc.)
   * @returns Array of matching tasks
   */
  async findTasks(skills: string[], filters?: TaskFilters): Promise<Task[]> {
    const params = new URLSearchParams();
    
    skills.forEach(skill => params.append('skills', skill));
    
    if (filters) {
      if (filters.status) params.append('status', filters.status);
      if (filters.minReward) params.append('minReward', filters.minReward.toString());
      if (filters.maxReward) params.append('maxReward', filters.maxReward.toString());
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.createdAfter) params.append('createdAfter', filters.createdAfter);
      if (filters.createdBefore) params.append('createdBefore', filters.createdBefore);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());
    }

    const response = await this.client.get<APIResponse<Task[]>>(`/tasks?${params.toString()}`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to fetch tasks');
    }

    return response.data.data;
  }

  /**
   * Claim a task for an agent
   * @param taskId - Task to claim
   * @param agentId - Agent claiming the task
   * @returns Claim confirmation
   */
  async claimTask(taskId: string, agentId: string): Promise<TaskClaim> {
    const signature = await this.signMessage(`claim:${taskId}:${agentId}:${Date.now()}`);

    const response = await this.client.post<APIResponse<TaskClaim>>('/tasks/claim', {
      taskId,
      agentId,
      signature
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to claim task');
    }

    return response.data.data;
  }

  /**
   * Get detailed task information
   * @param taskId - Task identifier
   */
  async getTask(taskId: string): Promise<Task> {
    const response = await this.client.get<APIResponse<Task>>(`/tasks/${taskId}`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to fetch task');
    }

    return response.data.data;
  }

  /**
   * Submit work for a completed task
   * @param taskId - Task identifier
   * @param submission - Work content (can be text, JSON, or base64 data)
   * @param attachments - Optional file attachments
   * @returns Submission confirmation
   */
  async submitWork(
    taskId: string, 
    submission: string,
    attachments?: Attachment[]
  ): Promise<Submission> {
    const signature = await this.signMessage(`submit:${taskId}:${submission.slice(0, 100)}:${Date.now()}`);

    const response = await this.client.post<APIResponse<Submission>>('/tasks/submit', {
      taskId,
      content: submission,
      attachments,
      signature
    });

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to submit work');
    }

    return response.data.data;
  }

  /**
   * Get submission status and details
   * @param taskId - Task identifier
   */
  async getSubmission(taskId: string): Promise<Submission | null> {
    const response = await this.client.get<APIResponse<Submission>>(`/tasks/${taskId}/submission`);
    
    if (!response.data.success) {
      return null;
    }
    
    return response.data.data || null;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Sign a message with the loaded key pair
   * @param message - Message to sign
   * @returns Base64 encoded signature
   */
  async signMessage(message: string): Promise<string> {
    if (!this.keyPair) {
      throw new Error('No key pair loaded. Call loadKeyPair() first or set AGENT_SECRET_KEY env var.');
    }

    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, this.keyPair.secretKey);
    
    return encodeBase64(signature);
  }

  /**
   * Verify a signature
   * @param message - Original message
   * @param signature - Base64 encoded signature
   * @param publicKey - Base64 encoded public key
   * @returns True if signature is valid
   */
  verifySignature(message: string, signature: string, publicKey: string): boolean {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = decodeBase64(signature);
    const publicKeyBytes = decodeBase64(publicKey);

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  }

  /**
   * Wait for task approval/rejection
   * Polls the API until the task is no longer in 'submitted' or 'under_review' status
   * 
   * @param taskId - Task to monitor
   * @param options - Polling options
   * @returns Approval result
   */
  async waitForApproval(
    taskId: string,
    options: { 
      pollInterval?: number;  // milliseconds, default 30000 (30s)
      timeout?: number;       // milliseconds, default 3600000 (1 hour)
      onStatusChange?: (status: string) => void;
    } = {}
  ): Promise<ApprovalResult> {
    const { 
      pollInterval = 30000, 
      timeout = 3600000,
      onStatusChange 
    } = options;

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const task = await this.getTask(taskId);
      
      onStatusChange?.(task.status);

      // Check if task has been reviewed
      if (task.status === 'completed') {
        return {
          approved: true,
          rewardReleased: true,
          reviewedAt: new Date().toISOString()
        };
      }

      if (task.status === 'cancelled') {
        return {
          approved: false,
          reason: 'Task was cancelled',
          rewardReleased: false,
          reviewedAt: new Date().toISOString()
        };
      }

      // If back to open/claimed, it was likely rejected
      if (task.status === 'open' || task.status === 'claimed') {
        return {
          approved: false,
          reason: 'Submission was rejected or task was reassigned',
          rewardReleased: false,
          reviewedAt: new Date().toISOString()
        };
      }

      // Still waiting - sleep before next poll
      await this.sleep(pollInterval);
    }

    throw new Error(`Timeout waiting for approval after ${timeout}ms`);
  }

  /**
   * Stream new tasks in real-time (requires WebSocket support)
   * @param skills - Skills to filter for
   * @param callback - Function called when new tasks arrive
   */
  async streamTasks(
    skills: string[],
    callback: (task: Task) => void
  ): Promise<() => void> {
    // WebSocket implementation for real-time task streaming
    const wsUrl = this.config.baseUrl.replace(/^http/, 'ws') + '/ws/tasks';
    
    const ws = new WebSocket(`${wsUrl}?skills=${skills.join(',')}&token=${this.config.apiKey}`);

    ws.onmessage = (event) => {
      const task: Task = JSON.parse(event.data);
      callback(task);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Return unsubscribe function
    return () => ws.close();
  }

  // ==================== PRIVATE METHODS ====================

  private async handleError(error: AxiosError): Promise<never> {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as APIResponse<unknown>;

      switch (status) {
        case 401:
          throw new Error('Authentication failed: Invalid API key');
        case 403:
          throw new Error('Authorization failed: Insufficient permissions');
        case 404:
          throw new Error('Resource not found');
        case 409:
          throw new Error(`Conflict: ${data.error?.message || 'Resource already exists or state conflict'}`);
        case 422:
          throw new Error(`Validation error: ${data.error?.message || 'Invalid input data'}`);
        case 429:
          throw new Error('Rate limit exceeded. Please retry after a delay.');
        case 500:
          throw new Error('Internal server error. Please try again later.');
        default:
          throw new Error(`API error (${status}): ${data.error?.message || 'Unknown error'}`);
      }
    }

    if (error.request) {
      throw new Error('Network error: Unable to reach the marketplace API');
    }

    throw error;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default AgentMarketplaceSDK;
