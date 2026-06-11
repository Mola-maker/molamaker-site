// Minimal MCP (Model Context Protocol) client for the OFFICIAL MathWorks
// MATLAB MCP server — matlab/matlab-mcp-core-server.
//
// The official binary speaks stdio; a web backend can't spawn it per-request,
// so this client speaks MCP Streamable HTTP (JSON-RPC POST, JSON or SSE
// responses, Mcp-Session-Id header) to MATLAB_MCP_URL. Any stdio→HTTP MCP
// gateway (e.g. `npx supergateway --stdio "./matlab-mcp-core-server"`) puts
// the official server behind such an endpoint with zero code. Tool names
// below are verbatim from the official README so this also works against any
// other MCP-compliant MATLAB server.

/** Official tool names (matlab/matlab-mcp-core-server). */
export const MATLAB_MCP_TOOLS = {
  evaluate: 'evaluate_matlab_code',        // { code, project_path? }
  toolboxes: 'detect_matlab_toolboxes',    // {}
  check: 'check_matlab_code',              // { script_path }
  runFile: 'run_matlab_file',              // { script_path }
  runTest: 'run_matlab_test_file',         // { script_path }
} as const;

/** Official guidance resources exposed by the server. */
export const MATLAB_MCP_RESOURCES = {
  codingGuidelines: 'guidelines://coding',
  liveCodeGuidelines: 'guidelines://plain-text-live-code',
} as const;

const PROTOCOL_VERSION = '2025-03-26';

interface JsonRpcResponse {
  result?: unknown;
  error?: { code: number; message: string };
}

export interface McpToolResult {
  /** concatenated text content blocks */
  text: string;
  isError: boolean;
}

function extractJsonRpc(body: string, contentType: string): JsonRpcResponse | null {
  // Streamable HTTP responses are either plain JSON or an SSE stream whose
  // final `data:` frame carries the JSON-RPC response.
  if (contentType.includes('text/event-stream')) {
    let last: JsonRpcResponse | null = null;
    for (const part of body.split('\n\n')) {
      const dataLines = part.split('\n').filter((l) => l.startsWith('data:'));
      if (!dataLines.length) continue;
      const raw = dataLines.map((l) => l.slice(5).trim()).join('');
      try {
        const j = JSON.parse(raw) as JsonRpcResponse & { id?: unknown };
        if ('result' in j || 'error' in j) last = j;
      } catch { /* keep scanning frames */ }
    }
    return last;
  }
  try {
    return JSON.parse(body) as JsonRpcResponse;
  } catch {
    return null;
  }
}

export class MatlabMcpClient {
  private endpoint: string;
  private token?: string;
  private sessionId: string | null = null;
  private nextId = 1;
  private timeoutMs: number;

  constructor(endpoint: string, opts?: { token?: string; timeoutMs?: number }) {
    this.endpoint = endpoint.replace(/\/+$/, '');
    this.token = opts?.token;
    this.timeoutMs = opts?.timeoutMs ?? 60_000;
  }

  private async rpc(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // servers may reply as JSON or SSE — accept both per the MCP spec
      'Accept': 'application/json, text/event-stream',
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;

    const r = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: this.nextId++, method, params: params ?? {} }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const sid = r.headers.get('Mcp-Session-Id');
    if (sid) this.sessionId = sid;

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`MCP ${method}: HTTP ${r.status}${text ? ` — ${text.slice(0, 160)}` : ''}`);
    }
    const parsed = extractJsonRpc(await r.text(), r.headers.get('Content-Type') ?? '');
    if (!parsed) throw new Error(`MCP ${method}: unparseable response`);
    if (parsed.error) throw new Error(`MCP ${method}: ${parsed.error.message}`);
    return parsed.result;
  }

  private async notify(method: string): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;
    await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', method }),
      signal: AbortSignal.timeout(8_000),
    }).catch(() => { /* notifications are best-effort */ });
  }

  /** MCP handshake. Returns the server's advertised info. */
  async initialize(): Promise<{ name: string; version: string }> {
    const result = await this.rpc('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'molamaker-matlab-studio', version: '1.0.0' },
    }) as { serverInfo?: { name?: string; version?: string } };
    await this.notify('notifications/initialized');
    return {
      name: result?.serverInfo?.name ?? 'unknown',
      version: result?.serverInfo?.version ?? '',
    };
  }

  async listTools(): Promise<string[]> {
    const result = await this.rpc('tools/list') as { tools?: Array<{ name?: string }> };
    return (result?.tools ?? []).map((t) => t.name ?? '').filter(Boolean);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.rpc('tools/call', { name, arguments: args }) as {
      content?: Array<{ type?: string; text?: string }>;
      isError?: boolean;
    };
    const text = (result?.content ?? [])
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string)
      .join('\n');
    return { text, isError: !!result?.isError };
  }
}

/** One-shot convenience: handshake + evaluate_matlab_code. */
export async function evaluateMatlabViaMcp(
  endpoint: string,
  code: string,
  opts?: { token?: string; projectPath?: string; timeoutMs?: number },
): Promise<McpToolResult> {
  const client = new MatlabMcpClient(endpoint, { token: opts?.token, timeoutMs: opts?.timeoutMs ?? 90_000 });
  await client.initialize();
  const args: Record<string, unknown> = { code };
  if (opts?.projectPath) args.project_path = opts.projectPath;
  return client.callTool(MATLAB_MCP_TOOLS.evaluate, args);
}
