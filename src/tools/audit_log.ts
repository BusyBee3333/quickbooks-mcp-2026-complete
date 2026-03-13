// Audit Log tools: query_audit_log, get_audit_activity
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── query_audit_log ────────────────────────────────────────────────────────
  server.registerTool(
    "query_audit_log",
    {
      title: "Query Audit Log",
      description:
        "Query the QuickBooks Audit Log (Activity Log) to see who changed what and when. Returns a timeline of create, update, delete, and login events with the user who made the change, the entity type, entity ID, and old/new field values. Essential for fraud detection, SOX compliance, and change tracking.",
      inputSchema: {
        startDate: z.string().describe("Filter events from this date (YYYY-MM-DD)"),
        endDate: z.string().describe("Filter events to this date (YYYY-MM-DD)"),
        entityType: z.string().optional().describe("Filter by entity type (e.g. 'Invoice', 'Bill', 'Payment', 'Customer', 'Vendor')"),
        userId: z.string().optional().describe("Filter by user who made the change"),
        eventType: z.enum(["Create", "Update", "Delete", "SendEmail", "Login"]).optional().describe("Filter by event type"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default: 1)"),
        maxResults: z.number().int().min(1).max(500).optional().describe("Max results (default: 100, max: 500)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.entityType) params.set("entity_type", args.entityType as string);
      if (args.userId) params.set("user_id", args.userId as string);
      if (args.eventType) params.set("event_type", args.eventType as string);
      if (args.startPosition) params.set("start_position", String(args.startPosition));
      if (args.maxResults) params.set("max_results", String(args.maxResults));
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.query_audit_log",
        () => client.get(`/reports/AuditActivity?${params}`),
        { tool: "query_audit_log" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── get_audit_activity ─────────────────────────────────────────────────────
  server.registerTool(
    "get_audit_activity",
    {
      title: "Get Audit Activity for Entity",
      description:
        "Get the complete audit history for a specific entity (e.g. an invoice, bill, or customer). Returns all create/update/delete events for that entity with user, timestamp, and changed fields. Use for transaction-level change tracking and dispute resolution.",
      inputSchema: {
        entityType: z.string().describe("Entity type (e.g. 'Invoice', 'Bill', 'Payment', 'Customer', 'Vendor')"),
        entityId: z.string().describe("Entity ID to get history for"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("entity_type", args.entityType as string);
      params.set("entity_id", args.entityId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.get_audit_activity",
        () => client.get(`/reports/AuditActivity?${params}`),
        { tool: "get_audit_activity", entityType: args.entityType as string, entityId: args.entityId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
