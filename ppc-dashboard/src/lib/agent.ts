/**
 * PPC Agent Client
 * 
 * Helper functions to interact with the PPC Agent via our Next.js API proxy.
 */

export interface AgentResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export const agentApi = {
  /**
   * Send a generic action to the agent
   */
  async action(action: string, params: Record<string, any> = {}): Promise<AgentResponse> {
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params }),
      });
      
      return await res.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        timestamp: new Date().toISOString(),
      };
    }
  },

  /**
   * Check agent health
   */
  async health(): Promise<{ status: string; timestamp?: string }> {
    try {
      const res = await fetch('/api/agent');
      return await res.json();
    } catch (error) {
      return { status: 'offline' };
    }
  },

  /**
   * Send a chat message (custom query)
   */
  async chat(message: string): Promise<AgentResponse> {
    return this.action('custom', { query: message });
  },

  /**
   * Run a campaign design/validation
   */
  async createCampaign(description: string, businessInfo: any, dryRun = true): Promise<AgentResponse> {
    return this.action('create-campaign', {
      description,
      ...businessInfo,
      dry_run: dryRun,
    });
  },
  
  /**
   * Keyword Research
   */
  async keywordResearch(keywords: string[], location?: string): Promise<AgentResponse> {
      return this.action('keyword-research', { keywords, location });
  },

  /**
   * Competitor Analysis
   */
  async competitorAnalysis(competitors: string[]): Promise<AgentResponse> {
    return this.action('competitor-analysis', { competitors });
  },

  /**
   * Run Health Check
   */
  async runHealthCheck(customerId?: string): Promise<AgentResponse> {
    return this.action('health-check', { customer_id: customerId });
  }
};
