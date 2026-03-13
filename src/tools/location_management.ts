// Location Management: list, get, create, update, delete locations (QBO Plus/Advanced)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_locations ─────────────────────────────────────────────────────────
  server.registerTool(
    "list_locations",
    {
      title: "List Locations",
      description:
        "List all Locations (also called Departments) configured in QuickBooks. Locations allow tracking income and expenses by physical location, business unit, or profit center. Requires QBO Plus or Advanced. Returns ID, name, and active status.",
      inputSchema: {
        activeOnly: z.boolean().optional().describe("Return only active locations (default: true)"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset (default: 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default: 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const where = args.activeOnly !== false ? "Active = true" : undefined;
      const result = await logger.time(
        "tool.list_locations",
        () => client.query("Department", where, args.startPosition ?? 1, args.maxResults ?? 100),
        { tool: "list_locations" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── get_location ───────────────────────────────────────────────────────────
  server.registerTool(
    "get_location",
    {
      title: "Get Location",
      description:
        "Get full details for a specific Location/Department by ID. Returns name, active status, parent department (for sub-locations), and fully qualified name. Use to retrieve location details for reporting and transaction tagging.",
      inputSchema: {
        locationId: z.string().describe("Location/Department ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_location",
        () => client.get(`/department/${args.locationId}`),
        { tool: "get_location", locationId: args.locationId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── create_location ────────────────────────────────────────────────────────
  server.registerTool(
    "create_location",
    {
      title: "Create Location",
      description:
        "Create a new Location (Department) in QuickBooks. Locations segment your P&L by physical location, business unit, or profit center. Requires QBO Plus or Advanced. Can create sub-locations by setting a parent location ID.",
      inputSchema: {
        name: z.string().describe("Location name (e.g. 'Downtown Store', 'West Coast Office')"),
        parentLocationId: z.string().optional().describe("Parent location ID (for creating sub-locations)"),
        active: z.boolean().optional().describe("Active status (default: true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const body: Record<string, unknown> = { Name: args.name };
      if (args.parentLocationId) body.ParentRef = { value: args.parentLocationId };
      if (args.active !== undefined) body.Active = args.active;
      const result = await logger.time(
        "tool.create_location",
        () => client.post("/department", body),
        { tool: "create_location" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── update_location ────────────────────────────────────────────────────────
  server.registerTool(
    "update_location",
    {
      title: "Update Location",
      description:
        "Update an existing Location/Department. Change the name, active status, or parent location. Requires locationId and syncToken from get_location. Use to rename locations, deactivate old locations, or reorganize location hierarchy.",
      inputSchema: {
        locationId: z.string().describe("Location ID"),
        syncToken: z.string().describe("SyncToken from get_location"),
        name: z.string().optional().describe("New location name"),
        active: z.boolean().optional().describe("Set false to deactivate the location"),
        parentLocationId: z.string().optional().describe("New parent location ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const body: Record<string, unknown> = {
        Id: args.locationId,
        SyncToken: args.syncToken,
        sparse: true,
      };
      if (args.name) body.Name = args.name;
      if (args.active !== undefined) body.Active = args.active;
      if (args.parentLocationId) body.ParentRef = { value: args.parentLocationId };
      const result = await logger.time(
        "tool.update_location",
        () => client.post("/department", body),
        { tool: "update_location", locationId: args.locationId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
