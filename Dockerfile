# Stdio wariant serwera MCP NIPRegon (most do zdalnego endpointu streamable HTTP).
# Wymagany przez Glama do introspekcji i score (buduje i uruchamia serwer stdio).
FROM node:20-alpine
WORKDIR /app
COPY nipregon-mcp.mjs ./
ENTRYPOINT ["node", "nipregon-mcp.mjs"]
