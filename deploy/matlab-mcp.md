# MATLAB Studio — official MCP bridge setup

The Workplace **MATLAB** tile generates runnable scripts with an LLM and can
execute them through the **official MathWorks MCP server**
([matlab/matlab-mcp-core-server](https://github.com/matlab/matlab-mcp-core-server)).

Two ways to run scripts:

| Path | Needs | What you get |
|------|-------|--------------|
| **MCP bridge** (`▶ 运行`) | A machine with licensed MATLAB R2021a+ and the official MCP binary | Real engine output in the studio console, one-click LLM repair on errors |
| **MATLAB Online** (`⬆`) | Just the free MathWorks account | Copy the script, paste into matlab.mathworks.com, run in the browser |

## Bridge setup (the official server is stdio; expose it over HTTP)

1. Download the official binary on the machine that has MATLAB:

   ```bash
   curl -L -o matlab-mcp-core-server \
     https://github.com/matlab/matlab-mcp-core-server/releases/latest/download/matlab-mcp-core-server-glnxa64
   chmod +x matlab-mcp-core-server
   ```

2. Put it behind any stdio→HTTP MCP gateway, e.g. supergateway:

   ```bash
   npx -y supergateway \
     --stdio "./matlab-mcp-core-server --matlab-session-mode=auto" \
     --outputTransport streamableHttp --port 8765
   ```

   (pm2 it like the other ECS services; bind to 127.0.0.1 and let nginx
   terminate TLS if the site runs elsewhere.)

3. Point the site at it:

   ```bash
   MATLAB_MCP_URL=http://127.0.0.1:8765/mcp
   # optional, if your gateway enforces a bearer token:
   MATLAB_MCP_TOKEN=…
   ```

4. Verify: open the MATLAB tile — the chip should read `MCP ✓`, and the
   `工具箱` button should list your installation
   (`detect_matlab_toolboxes`).

## Official tool surface used

| Tool | Used by |
|------|---------|
| `evaluate_matlab_code` | ▶ 运行 (and the repair-rerun loop) |
| `detect_matlab_toolboxes` | 工具箱 button + status chip |
| `check_matlab_code`, `run_matlab_file`, `run_matlab_test_file` | exposed by the client (`MATLAB_MCP_TOOLS`) for future file-based flows |

Per the MathWorks license note in the MCP README, the server must not be
shared by multiple users — keep the bridge personal (it runs under *your*
MATLAB license), which is exactly how the Workplace auth gate scopes it.
