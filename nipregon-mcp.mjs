#!/usr/bin/env node
// NIPRegon MCP server (stdio bridge) — rejestr 4,4 mln polskich firm dla asystentow AI.
// ZERO zaleznosci. initialize + tools/list + ping odpowiadaja LOKALNIE ze statycznego
// snapshotu skopiowanego 1:1 z zywego endpointu (probe 2026-06-15) — dzieki temu
// introspekcja w sandboxie Glamy NIE zalezy od dostepu do sieci (egress-independent).
// Tylko tools/call (i nieznane metody) sa forwardowane do zdalnego serwera MCP NIPRegon
// (streamable HTTP). Wymaga Node 18+ (globalny fetch).
//
// Konfiguracja (Claude Desktop / Claude Code / inne klienty stdio):
//   { "mcpServers": { "nipregon": { "command": "node",
//       "args": ["/sciezka/nipregon-mcp.mjs"],
//       "env": { "NIPREGON_API_KEY": "(opcjonalnie, wyzsze limity)" } } } }

const BASE = process.env.NIPREGON_BASE ?? "https://api.nipregon.pl";
const KEY = process.env.NIPREGON_API_KEY ?? "";
const PROTOCOL_VERSION = "2025-06-18";

// ── Statyczny snapshot z zywego endpointu (https://api.nipregon.pl/mcp, probe 2026-06-15).
//    Aktualizowac przy KAZDEJ zmianie zestawu narzedzi w API (i bumpnac wersje + Sync Server).
const SERVER_INFO = {
  "name": "nipregon",
  "title": "NIPRegon: Polish company registry",
  "version": "1.0.0"
};
const CAPABILITIES = {"tools": {"listChanged": false}};
const INSTRUCTIONS = "NIPRegon.pl: official registry data on Polish companies (KRS court register, REGON, CEIDG, the Ministry of Finance VAT white list, financial statements). Data comes exclusively from public state registers. Use these tools when the user asks about a Polish company, its NIP/REGON/KRS, registry details, financials, or VAT status. Prohibited uses: creditworthiness scoring, automated assessment of natural persons, and direct marketing towards sole traders. Web profile: https://nipregon.pl/nip/{nip}";
const TOOLS = [
  {
    "name": "search_company",
    "title": "Search Polish companies by name",
    "description": "Search Polish companies by name (fuzzy match). USE THIS when the user asks to find a Polish company, look up a firm by name, or get its NIP/KRS/REGON. Returns NIP, KRS, city, status and a profile URL. Data from the Polish court (KRS) and statistical (REGON) registers. Read-only.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "minLength": 3,
          "description": "Company name or part of it"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10,
          "default": 5,
          "description": "Max results (1-10, default 5)"
        }
      },
      "required": [
        "query"
      ]
    },
    "annotations": {
      "title": "Search Polish companies by name",
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": true
    }
  },
  {
    "name": "get_company",
    "title": "Get full company profile by NIP",
    "description": "Get the full registry profile of a Polish company by its NIP (10-digit tax ID). USE THIS when the user gives a NIP and wants company details, address, board members, or registry status. Returns address, legal form, status, KRS, REGON, PKD activity codes, board members (names from the public KRS register) and VAT status. Data from KRS, REGON and CEIDG public registers. Read-only.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "nip": {
          "type": "string",
          "pattern": "^[0-9]{10}$",
          "description": "Polish tax ID (NIP), 10 digits"
        }
      },
      "required": [
        "nip"
      ]
    },
    "annotations": {
      "title": "Get full company profile by NIP",
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": true
    }
  },
  {
    "name": "get_financials",
    "title": "Get company financial statements",
    "description": "Get yearly financial statements of a Polish company by NIP, as filed with the National Court Register (KRS). USE THIS when the user asks about a company's revenue, profit, assets or financial results. Returns per-year revenue, net profit, total assets, equity and liabilities. Data from financial statements (RDF/KRS). Read-only.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "nip": {
          "type": "string",
          "pattern": "^[0-9]{10}$",
          "description": "Polish tax ID (NIP), 10 digits"
        }
      },
      "required": [
        "nip"
      ]
    },
    "annotations": {
      "title": "Get company financial statements",
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": true
    }
  },
  {
    "name": "check_vat_whitelist",
    "title": "Check company on the VAT white list",
    "description": "Check a Polish company's VAT status in the Ministry of Finance taxpayer register (the 'white list', biała lista KAS) and, optionally, whether a given bank account number is registered to that company. USE THIS before paying an invoice: in Poland, paying over PLN 15,000 to an account outside the white list has tax consequences. Returns VAT status and account-match result. Live query to the official KAS register. Read-only.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "nip": {
          "type": "string",
          "pattern": "^[0-9]{10}$",
          "description": "Polish tax ID (NIP), 10 digits"
        },
        "account": {
          "type": "string",
          "description": "Polish bank account number (26 digits), optional"
        }
      },
      "required": [
        "nip"
      ]
    },
    "annotations": {
      "title": "Check company on the VAT white list",
      "readOnlyHint": true,
      "destructiveHint": false,
      "idempotentHint": true,
      "openWorldHint": true
    }
  }
];

function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
function replyError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}

async function forward(message) {
  const headers = { "Content-Type": "application/json" };
  if (KEY) headers["Authorization"] = `Bearer ${KEY}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000); // forward NIE moze wisiec (np. brak egressu)
  try {
    const resp = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify(message),
      signal: ctrl.signal,
    });
    if (resp.status === 202) return null; // notyfikacja, bez odpowiedzi
    const text = await resp.text();
    if (!text) return null;
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
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
    try { message = JSON.parse(line); } catch { continue; }

    // Notyfikacje (brak id), np. notifications/initialized — bez odpowiedzi.
    if (message.id === undefined || message.id === null) continue;

    // ── Introspekcja LOKALNA (egress-independent) ──────────────────────────
    if (message.method === "initialize") {
      const requested = message.params && message.params.protocolVersion;
      reply(message.id, {
        protocolVersion: requested || PROTOCOL_VERSION, // echo wersji klienta (fallback)
        capabilities: CAPABILITIES,
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
      continue;
    }
    if (message.method === "tools/list") { reply(message.id, { tools: TOOLS }); continue; }
    if (message.method === "ping") { reply(message.id, {}); continue; }

    // Pozostale metody handshake'u / capability-probing — LOKALNIE, puste listy.
    // Bez tego klient (np. build-test Glamy) wola resources/list lub prompts/list,
    // bridge forwarduje do sieci, a sandbox bez egressu wiesza fetch -> "build failed".
    if (message.method === "resources/list") { reply(message.id, { resources: [] }); continue; }
    if (message.method === "resources/templates/list") { reply(message.id, { resourceTemplates: [] }); continue; }
    if (message.method === "prompts/list") { reply(message.id, { prompts: [] }); continue; }

    // ── Reszta (tools/call i inne) → forward do zdalnego serwera ───────────
    try {
      const response = await forward(message);
      if (response) process.stdout.write(JSON.stringify(response) + "\n");
    } catch (err) {
      replyError(message.id, -32000, `NIPRegon API unreachable: ${err.message}`);
    }
  }
});
process.stdin.on("end", () => process.exit(0));
