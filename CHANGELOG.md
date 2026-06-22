# Changelog

All notable changes to the NIPRegon MCP server are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-06-22

### Added
- Three read-only tools, legal entities only (`entity_type='P'`; sole traders are out of scope
  for RODO reasons, mirrored from the public web profile logic):
  - `check_risk_flags` — sanctions (PL/EU, sanctioned subject only) and public KNF warnings,
    with presumption of innocence; exact match on NIP/KRS/REGON.
  - `get_public_tenders` — public-procurement contracts won (Public Procurement Bulletin / BZP),
    up to 25 most recent awards plus total count and value.
  - `get_lei` — Legal Entity Identifier (GLEIF), partial coverage.
- Bridge static snapshot updated to seven tools (offline `tools/list` stays egress-independent).

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
