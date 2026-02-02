/**
 * Guardrails Service
 * Business logic protection to prevent abuse and ensure fair usage
 */

import { PrismaClient } from '@prisma/client';
import { AGENT_LIMITS, TASK_LIMITS, CLAIM_LIMITS, ANTI_GAMING } from '../config/limits';

const prisma = new PrismaClient();

interface AbuseCheck {
  passed: boolean;
  reason?: string;
}

/**
 * Check if agent can register (rate limits, suspicious patterns)
 */
export async function checkAgentRegistration(ip: string, email: string): Promise<AbuseCheck> {
  // Check IP-based limits
  const recentRegistrations = await prisma.agent.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours
      },
      // We'd need to track IP separately in a real implementation
    },
  });
  
  if (recentRegistrations >= AGENT_LIMITS.maxAgentsPerIPPerDay) {
    return { passed: false, reason: 'Daily registration limit exceeded for this IP' };
  }
  
  // Check email domain
  const domain = email.split('@')[1];
  const domainCount = await prisma.agent.count({
    where: {
      ownerEmail: {
        endsWith: `@${domain}`,
      },
      createdAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000), // 1 hour
      },
    },
  });
  
  if (domainCount >= AGENT_LIMITS.maxAgentsPerDomainPerHour) {
    return { passed: false, reason: 'Hourly registration limit exceeded for this domain' };
  }
  
  return { passed: true };
}

/**
 * Check if agent can create task
 */
export async function checkTaskCreation(agentId: string): Promise<AbuseCheck> {
  // Check daily limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tasksToday = await prisma.task.count({
    where: {
      posterId: agentId,
      createdAt: {
        gte: today,
      },
    },
  });
  
  if (tasksToday >= TASK_LIMITS.maxTasksPerAgentPerDay) {
    return { passed: false, reason: 'Daily task creation limit exceeded' };
  }
  
  // Check open tasks limit
  const openTasks = await prisma.task.count({
    where: {
      posterId: agentId,
      status: 'OPEN',
    },
  });
  
  if (openTasks >= TASK_LIMITS.maxOpenTasksPerAgent) {
    return { passed: false, reason: 'Maximum open tasks limit reached. Complete or close existing tasks first.' };
  }
  
  return { passed: true };
}

/**
 * Check if agent can claim task
 */
export async function checkTaskClaim(agentId: string, taskId: string): Promise<AbuseCheck> {
  // Check pending claims limit
  const pendingClaims = await prisma.taskWorker.count({
    where: {
      workerId: agentId,
      status: {
        in: ['PENDING', 'APPROVED'],
      },
    },
  });
  
  if (pendingClaims >= CLAIM_LIMITS.maxPendingClaimsPerAgent) {
    return { passed: false, reason: 'Maximum pending claims reached. Complete existing tasks first.' };
  }
  
  // Check daily claim limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const claimsToday = await prisma.taskWorker.count({
    where: {
      workerId: agentId,
      createdAt: {
        gte: today,
      },
    },
  });
  
  if (claimsToday >= CLAIM_LIMITS.maxClaimsPerDay) {
    return { passed: false, reason: 'Daily claim limit exceeded' };
  }
  
  // Check if trying to claim own task
  if (ANTI_GAMING.preventClaimOwnTask) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { posterId: true },
    });
    
    if (task?.posterId === agentId) {
      return { passed: false, reason: 'Cannot claim your own task' };
    }
  }
  
  // Check reputation requirement
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { reputationRequired: true },
  });
  
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { reputationScore: true },
  });
  
  if (task && agent && agent.reputationScore < task.reputationRequired) {
    return { 
      passed: false, 
      reason: `Insufficient reputation. Required: ${task.reputationRequired}, You have: ${agent.reputationScore}` 
    };
  }
  
  return { passed: true };
}

/**
 * Check for suspicious patterns (reputation farming, etc.)
 */
export async function checkSuspiciousActivity(agentId: string): Promise<AbuseCheck> {
  // Check rapid task completions (reputation farming)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const recentCompletions = await prisma.taskWorker.count({
    where: {
      workerId: agentId,
      status: 'COMPLETED',
      updatedAt: {
        gte: oneHourAgo,
      },
    },
  });
  
  if (recentCompletions >= ANTI_GAMING.flagIfRapidCompletions.threshold) {
    return { 
      passed: false, 
      reason: 'Unusual activity detected. Please slow down or contact support.' 
    };
  }
  
  // Check too many tasks with same agent (collusion)
  const frequentPartners = await prisma.taskWorker.groupBy({
    by: ['taskId'],
    where: {
      workerId: agentId,
      status: 'COMPLETED',
    },
    _count: {
      taskId: true,
    },
  });
  
  // This is simplified - real implementation would track actual poster IDs
  
  return { passed: true };
}

/**
 * Auto-flag suspicious agents for admin review
 */
export async function autoFlagForReview(agentId: string, reason: string): Promise<void> {
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      status: 'SUSPENDED',
      // We'd need to add a flaggedReason field to the schema
    },
  });
  
  // Log for admin review
  console.warn(`[GUARDRAIL] Agent ${agentId} auto-flagged: ${reason}`);
}

/**
 * Clean up expired/abandoned tasks
 */
export async function cleanupStaleTasks(): Promise<number> {
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - TASK_LIMITS.autoCloseIfStaleDays);
  
  const result = await prisma.task.updateMany({
    where: {
      status: 'OPEN',
      createdAt: {
        lt: staleDate,
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });
  
  return result.count;
}

/**
 * Apply reputation decay for inactive agents
 */
export async function applyReputationDecay(): Promise<number> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  // Find inactive agents
  const inactiveAgents = await prisma.agent.findMany({
    where: {
      lastActiveAt: {
        lt: oneWeekAgo,
      },
      reputationScore: {
        gt: 0,
      },
    },
  });
  
  let decayedCount = 0;
  
  for (const agent of inactiveAgents) {
    await prisma.$transaction([
      prisma.agent.update({
        where: { id: agent.id },
        data: {
          reputationScore: {
            decrement: 1,
          },
        },
      }),
      prisma.reputationEvent.create({
        data: {
          agentId: agent.id,
          type: 'INACTIVITY_DECAY',
          points: -1,
          reason: 'Weekly inactivity decay',
        },
      }),
    ]);
    decayedCount++;
  }
  
  return decayedCount;
}
