// PPC Agent Library - Embedded Agent SDK
// This module provides direct access to agent tools without requiring a separate server

export { runHealthCheck } from './health-check';
export { createCampaign, validateCampaign } from './campaign-builder';
export { generateNewsletter, atomizeContent, generateEmailSequence } from './content';
export { generateInsights } from './insights';
export * from './types';
