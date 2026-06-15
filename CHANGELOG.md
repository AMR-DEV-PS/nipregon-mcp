# Changelog

All notable changes to the NIPRegon MCP server are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-15

### Added
- Remote MCP endpoint `https://api.nipregon.pl/mcp` (streamable HTTP, JSON-RPC 2.0).
- Self-introspecting stdio bridge (`nipregon-mcp.mjs`, zero dependencies): `initialize`,
  `tools/list` and `ping` answered locally from a static snapshot of the live endpoint, so
  Docker build-test introspection is independent of sandbox network egress; only `tools/call`
  is forwarded to the remote server.
- Four read-only tools: `search_company`, `get_company`, `get_financials`, `check_vat_whitelist`.
- `glama.json` (maintainer claim), `package.json` (Node project detection), `server.json`
  (official MCP registry manifest), MIT `LICENSE`.
- CI workflow validating JSON manifests, bridge syntax and offline introspection.

### Notes
- Data sourced exclusively from official Polish public registers (KRS, REGON, CEIDG, the
  Ministry of Finance VAT white list, and financial statements filed with the National Court
  Register). No creditworthiness scoring, no profiling of natural persons.
