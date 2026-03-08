/**
 * Operations Agent
 *
 * Processes the Neon outbox queue to:
 * - Sync leads to Pipedrive CRM
 * - Send Google Chat team notifications
 * - Sync subscribers to Beehiiv
 *
 * Can run as a daemon (continuous polling) or one-shot processor.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env, NEON_CONFIG, GOOGLE_CHAT_CONFIG, PIPEDRIVE_CONFIG } from '../config/index.js';
import {
  claimOutboxMessages,
  completeOutboxMessage,
  failOutboxMessage,
  getOutboxStats,
  getLeadById,
  upsertCrmLink,
  type OutboxMessage,
  type Lead,
} from '../tools/neon.js';
import {
  sendLeadNotification,
  sendErrorNotification,
  type LeadNotificationData,
} from '../tools/google-chat.js';
import { syncLeadToPipedrive, type SyncLeadResult } from '../tools/pipedrive.js';

// ============================================================
// CONFIGURATION
// ============================================================

const WORKER_ID = `ops-agent-${process.pid}`;
const POLL_INTERVAL_MS = 60_000; // 1 minute
const BATCH_SIZE = 10;

const MESSAGE_TYPES = [
  'lead.sync_pipedrive',
  'lead.notify_gchat',
  'lead.sync_beehiiv',
];

// ============================================================
// MESSAGE HANDLERS
// ============================================================

type MessageHandler = (message: OutboxMessage) => Promise<void>;

const messageHandlers: Record<string, MessageHandler> = {
  /**
   * Sync a lead to Pipedrive CRM
   */
  'lead.sync_pipedrive': async (message: OutboxMessage) => {
    if (!PIPEDRIVE_CONFIG.isConfigured) {
      throw new Error('Pipedrive API not configured');
    }

    const payload = message.payload as {
      lead_id?: string;
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      property_address?: string;
      city?: string;
      state?: string;
      zip?: string;
      service_interest?: string;
      message?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      gclid?: string;
    };

    // Get lead data from Neon if we only have the ID
    let leadData = payload;
    if (message.lead_id && !payload.email) {
      const lead = await getLeadById(message.lead_id);
      if (!lead) {
        throw new Error(`Lead ${message.lead_id} not found in Neon`);
      }
      leadData = {
        lead_id: lead.id,
        first_name: lead.first_name || undefined,
        last_name: lead.last_name || undefined,
        email: lead.email,
        phone: lead.phone || undefined,
        property_address: lead.property_address || undefined,
        city: lead.property_city || undefined,
        state: lead.property_state || undefined,
        zip: lead.property_zip || undefined,
        service_interest: lead.service_interest || undefined,
        message: lead.message || undefined,
        utm_source: lead.utm_source || undefined,
        utm_medium: lead.utm_medium || undefined,
        utm_campaign: lead.utm_campaign || undefined,
        gclid: lead.gclid || undefined,
      };
    }

    if (!leadData.email) {
      throw new Error('Lead email is required for Pipedrive sync');
    }

    const result: SyncLeadResult = await syncLeadToPipedrive({
      neonLeadId: message.lead_id || leadData.lead_id || 'unknown',
      firstName: leadData.first_name,
      lastName: leadData.last_name,
      email: leadData.email,
      phone: leadData.phone,
      propertyAddress: leadData.property_address,
      city: leadData.city,
      state: leadData.state,
      zip: leadData.zip,
      serviceInterest: leadData.service_interest,
      message: leadData.message,
      utmSource: leadData.utm_source,
      utmMedium: leadData.utm_medium,
      utmCampaign: leadData.utm_campaign,
      gclid: leadData.gclid,
    });

    if (!result.success) {
      throw new Error(result.error || 'Pipedrive sync failed');
    }

    // Save CRM link back to Neon
    if (message.lead_id && result.dealId) {
      await upsertCrmLink(
        message.lead_id,
        'pipedrive',
        String(result.dealId),
        `https://stiltner.pipedrive.com/deal/${result.dealId}`
      );
    }

    console.log(
      `  ✅ Synced to Pipedrive: Person #${result.personId}, Deal #${result.dealId}`
    );
  },

  /**
   * Send a Google Chat notification for a new lead
   */
  'lead.notify_gchat': async (message: OutboxMessage) => {
    if (!GOOGLE_CHAT_CONFIG.isConfigured) {
      throw new Error('Google Chat not configured');
    }

    const payload = message.payload as Partial<Lead>;

    // Get lead data from Neon if we only have the ID
    let leadData: Partial<Lead> = payload;
    if (message.lead_id && !payload.email) {
      const lead = await getLeadById(message.lead_id);
      if (!lead) {
        throw new Error(`Lead ${message.lead_id} not found in Neon`);
      }
      leadData = lead;
    }

    if (!leadData.email) {
      throw new Error('Lead email is required for G-Chat notification');
    }

    const notificationData: LeadNotificationData = {
      leadId: message.lead_id || leadData.id || 'unknown',
      firstName: leadData.first_name || undefined,
      lastName: leadData.last_name || undefined,
      email: leadData.email,
      phone: leadData.phone || undefined,
      service: leadData.service_interest || undefined,
      propertyAddress: leadData.property_address || undefined,
      city: leadData.property_city || undefined,
      message: leadData.message || undefined,
      utmSource: leadData.utm_source || undefined,
      utmMedium: leadData.utm_medium || undefined,
      utmCampaign: leadData.utm_campaign || undefined,
    };

    const result = await sendLeadNotification(notificationData);

    if (!result.success) {
      throw new Error(result.error || 'G-Chat notification failed');
    }

    console.log(`  ✅ Sent G-Chat notification: ${result.messageId}`);
  },

  /**
   * Sync a subscriber to Beehiiv newsletter
   */
  'lead.sync_beehiiv': async (message: OutboxMessage) => {
    // TODO: Implement Beehiiv sync in Phase 2
    console.log(`  ⏭️ Beehiiv sync not yet implemented, skipping`);
    // Don't throw - just complete the message so it doesn't retry
  },
};

// ============================================================
// OUTBOX PROCESSOR
// ============================================================

/**
 * Process a batch of outbox messages
 */
async function processBatch(): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  try {
    // Claim messages from the queue
    const messages = await claimOutboxMessages({
      workerId: WORKER_ID,
      messageTypes: MESSAGE_TYPES,
      batchSize: BATCH_SIZE,
    });

    if (messages.length === 0) {
      return { processed: 0, failed: 0 };
    }

    console.log(`\n📬 Claimed ${messages.length} messages from outbox`);

    // Process each message
    for (const message of messages) {
      console.log(`\n  Processing: ${message.message_type} (attempt ${message.attempts})`);

      const handler = messageHandlers[message.message_type];

      if (!handler) {
        console.log(`  ⚠️ Unknown message type: ${message.message_type}`);
        await failOutboxMessage(message.id, `Unknown message type: ${message.message_type}`);
        failed++;
        continue;
      }

      try {
        await handler(message);
        await completeOutboxMessage(message.id);
        processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`  ❌ Failed: ${errorMessage}`);
        await failOutboxMessage(message.id, errorMessage);
        failed++;

        // Send error notification for critical failures
        if (message.attempts >= message.max_attempts - 1) {
          try {
            await sendErrorNotification('Operations Agent', errorMessage, {
              message_type: message.message_type,
              message_id: message.id,
              lead_id: message.lead_id || 'N/A',
              attempts: message.attempts,
            });
          } catch {
            // Don't fail on notification error
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Batch processing error:', error);
  }

  return { processed, failed };
}

/**
 * Run the outbox processor once (one-shot mode)
 */
export async function processOutboxOnce(): Promise<void> {
  console.log('\n🔄 Operations Agent - One-Shot Mode');
  console.log('=' .repeat(50));

  // Check configuration
  const configStatus = [];
  if (NEON_CONFIG.isConfigured) configStatus.push('✅ Neon');
  else configStatus.push('❌ Neon');
  if (PIPEDRIVE_CONFIG.isConfigured) configStatus.push('✅ Pipedrive');
  else configStatus.push('⚠️ Pipedrive (not configured)');
  if (GOOGLE_CHAT_CONFIG.isConfigured) configStatus.push('✅ G-Chat');
  else configStatus.push('⚠️ G-Chat (not configured)');

  console.log('Config:', configStatus.join(' | '));

  if (!NEON_CONFIG.isConfigured) {
    console.error('\n❌ Neon database not configured. Cannot process outbox.');
    return;
  }

  // Show queue stats
  const stats = await getOutboxStats();
  console.log('\nOutbox Queue:');
  for (const stat of stats) {
    console.log(`  ${stat.message_type}: ${stat.count} ${stat.status}`);
  }

  // Process one batch
  const result = await processBatch();
  console.log(`\n✅ Complete: ${result.processed} processed, ${result.failed} failed`);
}

/**
 * Run the outbox processor as a daemon (continuous polling)
 */
export async function runOperationsDaemon(): Promise<never> {
  console.log('\n🤖 Operations Agent - Daemon Mode');
  console.log('=' .repeat(50));
  console.log(`Worker ID: ${WORKER_ID}`);
  console.log(`Poll Interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log('Message Types:', MESSAGE_TYPES.join(', '));

  // Check configuration
  if (!NEON_CONFIG.isConfigured) {
    console.error('\n❌ Neon database not configured. Cannot start daemon.');
    process.exit(1);
  }

  console.log('\n🟢 Daemon started. Press Ctrl+C to stop.\n');

  let totalProcessed = 0;
  let totalFailed = 0;

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down Operations Agent...');
    console.log(`   Total processed: ${totalProcessed}`);
    console.log(`   Total failed: ${totalFailed}`);
    process.exit(0);
  });

  // Main loop
  while (true) {
    try {
      const result = await processBatch();
      totalProcessed += result.processed;
      totalFailed += result.failed;

      if (result.processed > 0 || result.failed > 0) {
        console.log(
          `📊 Session: ${totalProcessed} processed, ${totalFailed} failed`
        );
      }
    } catch (error) {
      console.error('❌ Daemon error:', error);
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// ============================================================
// AGENT TOOL DEFINITION
// ============================================================

export const operationsAgentTool = {
  name: 'run_operations_processor',
  description:
    'Process the outbox queue to sync leads to Pipedrive and send G-Chat notifications. Runs one batch.',
  input_schema: {
    type: 'object' as const,
    properties: {
      batch_size: {
        type: 'number',
        default: 10,
        description: 'Number of messages to process',
      },
    },
    required: [],
  },
  handler: async ({ batch_size }: { batch_size?: number }) => {
    const oldBatchSize = BATCH_SIZE;
    // @ts-ignore - Allow temporary override
    globalThis.BATCH_SIZE_OVERRIDE = batch_size;

    const result = await processBatch();

    return {
      processed: result.processed,
      failed: result.failed,
      message: `Processed ${result.processed} messages, ${result.failed} failed`,
    };
  },
};

// ============================================================
// STANDALONE EXECUTION
// ============================================================

// If this file is run directly, start the daemon
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const mode = process.argv[2];

  if (mode === 'once' || mode === '--once') {
    processOutboxOnce().catch(console.error);
  } else {
    runOperationsDaemon().catch(console.error);
  }
}
