# Stdio wariant serwera MCP NIPRegon (most do zdalnego endpointu streamable HTTP).
# Wymagany przez Glama do introspekcji i score (buduje i uruchamia serwer stdio).
# initialize + tools/list odpowiadaja LOKALNIE ze statycznego snapshotu, wiec build-test
# Glamy NIE zalezy od egressu sieci sandboxa. Tylko tools/call jest forwardowane do
# https://api.nipregon.pl/mcp.
FROM node:20-alpine
WORKDIR /app
COPY package.json nipregon-mcp.mjs ./
ENTRYPOINT ["node", "nipregon-mcp.mjs"]
