#!/usr/bin/env node
// NIPRegon MCP server (stdio bridge) — rejestr 4,4 mln polskich firm dla asystentow AI.
// Zero zaleznosci: czyta JSON-RPC z stdin (newline-delimited) i przekazuje do zdalnego
// serwera MCP NIPRegon (streamable HTTP). Wymaga Node 18+ (globalny fetch).
//
// Konfiguracja (Claude Desktop / Claude Code / inne klienty stdio):
//   { "mcpServers": { "nipregon": { "command": "node", "args": ["/sciezka/nipregon-mcp.mjs"],
//       "env": { "NIPREGON_API_KEY": "(opcjonalnie, wyzsze limity)" } } } }

const BASE = process.env.NIPREGON_BASE ?? "https://api.nipregon.pl";
const KEY = process.env.NIPREGON_API_KEY ?? "";

async function forward(message) {
  const headers = { "Content-Type": "application/json" };
  if (KEY) headers["Authorization"] = `Bearer ${KEY}`;
  const resp = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
  });
  if (resp.status === 202) return null; // notyfikacja, bez odpowiedzi
  const text = await resp.text();
  if (!text) return null;
  return JSON.parse(text);
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    try {
      const response = await forward(message);
      if (response) process.stdout.write(JSON.stringify(response) + "\n");
    } catch (err) {
      if (message && message.id !== undefined && message.id !== null) {
        process.stdout.write(JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32000, message: `NIPRegon API unreachable: ${err.message}` },
        }) + "\n");
      }
    }
  }
});
process.stdin.on("end", () => process.exit(0));
