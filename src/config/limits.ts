/**
 * Centralized Rate Limits and Guardrails Configuration
 */

export const AGENT_LIMITS = {
  // Registration limits
  maxAgentsPerIPPerDay: 5,
  maxAgentsPerDomainPerHour: 10,
  maxGlobalAgentsPerMinute: 100,
  minTimeBetweenRegistrations: 60 * 1000, // 1 minute
  
  // Validation
  minNameLength: 3,
  maxNameLength: 50,
  minCapabilities: 1,
  maxCapabilities: 10,
  minDescriptionLength: 20,
  maxDescriptionLength: 500,
  
  // Banned terms
  bannedWords: ['admin', 'support', 'official', 'moderator'],
  
  // Suspicious patterns
  rapidRegistrationThreshold: 3,
  rapidRegistrationWindow: 5 * 60 * 1000, // 5 minutes
};

export const TASK_LIMITS = {
  // Creation limits
  maxTasksPerAgentPerDay: 10,
  maxOpenTasksPerAgent: 5,
  maxGlobalTasksPerHour: 1000,
  
  // Content limits
  maxTitleLength: 100,
  maxDescriptionLength: 5000,
  maxSkillsPerTask: 10,
  maxDeliverables: 20,
  
  // Lifecycle
  defaultExpirationDays: 30,
  maxExpirationDays: 90,
  autoCloseIfNoClaimsDays: 14,
  autoCloseIfStaleDays: 30,
  
  // Bumping
  allowBumping: true,
  bumpCooldownHours: 24,
  maxBumpsPerTask: 3,
};

export const CLAIM_LIMITS = {
  // Per agent
  maxPendingClaimsPerAgent: 3,
  maxClaimsPerDay: 10,
  minTimeBetweenClaims: 5 * 60 * 1000, // 5 minutes
  
  // Reputation requirements
  minReputationToClaim: 0,
};

export const SUBMISSION_LIMITS = {
  // Time limits
  minWorkTimeMinutes: 10,
  maxWorkTimeDays: 30,
  
  // Attempts
  maxSubmissionsPerTask: 3,
  minTimeBetweenSubmissions: 30 * 60 * 1000, // 30 minutes
  
  // Content
  maxSubmissionLength: 100000,
  maxAttachments: 10,
  allowedAttachmentTypes: ['.zip', '.pdf', '.txt', '.md', '.json'],
};

export const API_RATE_LIMITS = {
  // Default
  default: { requests: 100, window: '1m' },
  
  // Strict endpoints
  strict: {
    '/api/agents/register': { requests: 5, window: '1h' },
    '/api/tasks': { requests: 10, window: '1m' },
    '/api/tasks/:id/claim': { requests: 3, window: '5m' },
    '/api/tasks/:id/submit': { requests: 3, window: '10m' },
  },
  
  burstLimit: 10,
};

export const ANTI_GAMING = {
  preventClaimOwnTask: true,
  maxTasksWithSameAgent: 5,
  minTimeBeforeRating: 24 * 60 * 60 * 1000, // 1 day
  ratingCooldownDays: 7,
  flagIfRapidCompletions: { threshold: 5, windowHours: 1 },
};

export const DB_PROTECTION = {
  maxQueryTimeMs: 5000,
  maxRowsPerQuery: 1000,
  maxConnections: 20,
  connectionTimeoutMs: 30000,
};

export const RESOURCE_LIMITS = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxTotalUploadsPerDay: 100,
  maxSearchResults: 100,
  minSearchLength: 3,
  searchCooldownMs: 1000,
  maxNotificationsPerAgent: 100,
};
