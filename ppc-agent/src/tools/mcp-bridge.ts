/**
 * MCP Bridge
 * 
 * This module spawns the @channel47/google-ads-mcp as a subprocess
 * and communicates with it via JSON-RPC over stdio.
 * 
 * WHY: We KNOW this MCP works. Rather than reimplementing the Google Ads
 * integration, we leverage the working MCP as our tool layer.
 */

import { spawn, ChildProcess } from 'child_process';
import { env } from '../config/index.js';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

export class MCPBridge {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests: Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private buffer = '';
  private initialized = false;

  /**
   * Start the MCP subprocess
   */
  async start(): Promise<void> {
    if (this.process) {
      throw new Error('MCP already started');
    }

    const mcpEnv = {
      ...process.env,
      GOOGLE_ADS_DEVELOPER_TOKEN: env.GOOGLE_ADS_DEVELOPER_TOKEN,
      GOOGLE_ADS_CLIENT_ID: env.GOOGLE_ADS_CLIENT_ID,
      GOOGLE_ADS_CLIENT_SECRET: env.GOOGLE_ADS_CLIENT_SECRET,
      GOOGLE_ADS_REFRESH_TOKEN: env.GOOGLE_ADS_REFRESH_TOKEN,
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
      GOOGLE_ADS_DEFAULT_CUSTOMER_ID: env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID,
    };

    this.process = spawn('npx', ['-y', '@channel47/google-ads-mcp@latest'], {
      env: mcpEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Handle stdout (JSON-RPC responses)
    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    // Handle stderr (logging, can be ignored or logged)
    this.process.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg && !msg.includes('started')) {
        console.error('[MCP stderr]', msg);
      }
    });

    // Handle process exit
    this.process.on('exit', (code) => {
      console.log(`[MCP] Process exited with code ${code}`);
      this.process = null;
      this.initialized = false;
    });

    // Initialize the MCP
    await this.initialize();
  }

  /**
   * Process buffered stdout data looking for complete JSON-RPC messages
   */
  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const response: JsonRpcResponse = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);
        
        if (pending) {
          this.pendingRequests.delete(response.id);
          
          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch (e) {
        // Not a JSON line, ignore
      }
    }
  }

  /**
   * Send a JSON-RPC request and wait for response
   */
  private async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.process?.stdin) {
      throw new Error('MCP not started');
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, 60000); // 60 second timeout

      // Clear timeout on resolution
      const originalResolve = resolve;
      const originalReject = reject;
      this.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          originalResolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          originalReject(error);
        },
      });

      this.process!.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Initialize the MCP connection
   */
  private async initialize(): Promise<void> {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ppc-agent', version: '0.1.0' },
    });

    this.initialized = true;
    console.log('[MCP] Initialized:', result.serverInfo?.name);
  }

  /**
   * Call an MCP tool
   */
  async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.initialized) {
      throw new Error('MCP not initialized');
    }

    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });

    // Parse the result content
    if (result?.content?.[0]?.text) {
      try {
        return JSON.parse(result.content[0].text);
      } catch {
        return result.content[0].text;
      }
    }

    return result;
  }

  /**
   * Stop the MCP subprocess
   */
  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.initialized = false;
    }
  }

  // ============================================================
  // HIGH-LEVEL TOOL METHODS (wrapping MCP tools)
  // ============================================================

  /**
   * List accessible accounts
   */
  async listAccounts(): Promise<any> {
    return this.callTool('list_accounts');
  }

  /**
   * Execute a GAQL query
   */
  async query(gaql: string, customerId?: string): Promise<any> {
    return this.callTool('query', {
      query: gaql,
      customer_id: customerId || env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID,
    });
  }

  /**
   * Execute a mutation (create/update/delete)
   * 
   * @param operations - Array of Google Ads API operations
   * @param dryRun - If true, validates but doesn't execute (SAFE MODE)
   */
  async mutate(
    operations: any[],
    options: {
      customerId?: string;
      dryRun?: boolean;
      partialFailure?: boolean;
    } = {}
  ): Promise<any> {
    const { customerId, dryRun = true, partialFailure = false } = options;

    return this.callTool('mutate', {
      customer_id: customerId || env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID,
      operations,
      dry_run: dryRun,
      partial_failure: partialFailure,
    });
  }
}

// Singleton instance
let mcpInstance: MCPBridge | null = null;

export async function getMCP(): Promise<MCPBridge> {
  if (!mcpInstance) {
    mcpInstance = new MCPBridge();
    await mcpInstance.start();
  }
  return mcpInstance;
}

export async function shutdownMCP(): Promise<void> {
  if (mcpInstance) {
    await mcpInstance.stop();
    mcpInstance = null;
  }
}
