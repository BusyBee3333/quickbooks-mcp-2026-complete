// Health check tool for QuickBooks MCP Server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  server.registerTool(
    "health_check",
    {
      title: "Health Check",
      description:
        "Validate QuickBooks MCP server health: checks environment variables are set (QB_CLIENT_ID, QB_CLIENT_SECRET, QB_REFRESH_TOKEN, QB_REALM_ID), performs OAuth 2.0 token refresh, and verifies API connectivity. Use when diagnosing connection issues.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const required = ["QB_CLIENT_ID", "QB_CLIENT_SECRET", "QB_REFRESH_TOKEN", "QB_REALM_ID"];
      const missing = required.filter((v) => !process.env[v]);
      const envOk = missing.length === 0;

      const health = await client.healthCheck();

      const status =
        !envOk || !health.reachable
          ? "unhealthy"
          : !health.authenticated
          ? "degraded"
          : "healthy";

      const result = {
        status,
        checks: {
          envVars: { ok: envOk, missing },
          apiReachable: health.reachable,
          authValid: health.authenticated,
          latencyMs: health.latencyMs,
        },
        realmId: process.env.QB_REALM_ID || "(not set)",
        environment: process.env.QB_ENVIRONMENT || "production",
        ...(health.error ? { error: health.error } : {}),
      };

      logger.info("health_check", { status });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );
}
