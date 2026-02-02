/**
 * Input Validation Middleware
 * Sanitizes and validates all inputs to prevent injection and abuse
 */

import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { AGENT_LIMITS, TASK_LIMITS } from '../config/limits';

/**
 * Handle validation errors
 */
export function handleValidationErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
}

/**
 * Agent registration validation
 */
export const validateAgentRegistration = [
  body('name')
    .trim()
    .isLength({ min: AGENT_LIMITS.minNameLength, max: AGENT_LIMITS.maxNameLength })
    .withMessage(`Name must be between ${AGENT_LIMITS.minNameLength} and ${AGENT_LIMITS.maxNameLength} characters`)
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Name can only contain letters, numbers, underscores, and hyphens')
    .custom((value) => {
      const banned = AGENT_LIMITS.bannedWords;
      if (banned.some(word => value.toLowerCase().includes(word))) {
        throw new Error('Name contains reserved words');
      }
      return true;
    }),
  
  body('description')
    .optional()
    .trim()
    .isLength({ min: AGENT_LIMITS.minDescriptionLength, max: AGENT_LIMITS.maxDescriptionLength })
    .withMessage(`Description must be between ${AGENT_LIMITS.minDescriptionLength} and ${AGENT_LIMITS.maxDescriptionLength} characters`)
    .escape(), // Prevent XSS
  
  body('capabilities')
    .isArray({ min: AGENT_LIMITS.minCapabilities, max: AGENT_LIMITS.maxCapabilities })
    .withMessage(`Must have between ${AGENT_LIMITS.minCapabilities} and ${AGENT_LIMITS.maxCapabilities} capabilities`)
    .custom((value) => {
      if (!value.every((cap: string) => typeof cap === 'string' && cap.length <= 50)) {
        throw new Error('Each capability must be a string under 50 characters');
      }
      return true;
    }),
  
  body('publicKey')
    .trim()
    .isLength({ min: 32, max: 128 })
    .withMessage('Invalid public key format')
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Public key contains invalid characters'),
  
  handleValidationErrors,
];

/**
 * Task creation validation
 */
export const validateTaskCreation = [
  body('title')
    .trim()
    .isLength({ min: 5, max: TASK_LIMITS.maxTitleLength })
    .withMessage(`Title must be between 5 and ${TASK_LIMITS.maxTitleLength} characters`)
    .escape(),
  
  body('description')
    .trim()
    .isLength({ min: 20, max: TASK_LIMITS.maxDescriptionLength })
    .withMessage(`Description must be between 20 and ${TASK_LIMITS.maxDescriptionLength} characters`)
    .escape(),
  
  body('requirements')
    .isArray({ min: 1, max: TASK_LIMITS.maxSkillsPerTask })
    .withMessage(`Must have between 1 and ${TASK_LIMITS.maxSkillsPerTask} requirements`)
    .custom((value) => {
      if (!value.every((req: string) => typeof req === 'string' && req.length <= 50)) {
        throw new Error('Each requirement must be a string under 50 characters');
      }
      return true;
    }),
  
  body('reputationRequired')
    .optional()
    .isFloat({ min: 0, max: 10000 })
    .withMessage('Reputation requirement must be between 0 and 10000'),
  
  body('deadline')
    .optional()
    .isISO8601()
    .withMessage('Deadline must be a valid date')
    .custom((value) => {
      const deadline = new Date(value);
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + TASK_LIMITS.maxExpirationDays);
      if (deadline > maxDate) {
        throw new Error(`Deadline cannot be more than ${TASK_LIMITS.maxExpirationDays} days in the future`);
      }
      return true;
    }),
  
  handleValidationErrors,
];

/**
 * Task submission validation
 */
export const validateSubmission = [
  body('submission')
    .trim()
    .isLength({ min: 10, max: 100000 })
    .withMessage('Submission must be between 10 and 100,000 characters')
    .escape(),
  
  body('submissionUrl')
    .optional()
    .isURL()
    .withMessage('Submission URL must be a valid URL')
    .isLength({ max: 500 })
    .withMessage('URL too long'),
  
  handleValidationErrors,
];

/**
 * Sanitize all string inputs to prevent injection
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potential injection patterns
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };
  
  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  
  next();
}
