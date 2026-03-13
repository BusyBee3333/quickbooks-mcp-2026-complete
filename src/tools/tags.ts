// Tags tools: list, get, create, delete tags + tag reports
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_tags ──────────────────────────────────────────────────────────────
  server.registerTool(
    "list_tags",
    {
      title: "List Tags",
      description:
        "List all Tags configured in QuickBooks. Tags are custom labels applied to transactions for flexible categorization beyond accounts, classes, and departments. Available in QBO Simple Start and above. Use to find tag IDs for transaction filtering and tag-based reports.",
      inputSchema: {
        where: z.string().optional().describe("QBO query WHERE clause (e.g. \"Active = true\")"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset (default: 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default: 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.list_tags",
        () => client.query("Tag", args.where as string | undefined, args.startPosition ?? 1, args.maxResults ?? 100),
        { tool: "list_tags" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── get_tag ────────────────────────────────────────────────────────────────
  server.registerTool(
    "get_tag",
    {
      title: "Get Tag",
      description:
        "Get details for a specific Tag by ID. Returns the tag name, active status, and tag group it belongs to.",
      inputSchema: {
        tagId: z.string().describe("Tag ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_tag",
        () => client.get(`/tag/${args.tagId}`),
        { tool: "get_tag", tagId: args.tagId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── create_tag ─────────────────────────────────────────────────────────────
  server.registerTool(
    "create_tag",
    {
      title: "Create Tag",
      description:
        "Create a new Tag in QuickBooks. Tags are custom labels for flexible transaction categorization. Use tags for campaigns, projects, cost centers, or any custom dimension that doesn't fit accounts/classes/departments. Tags can be applied to invoices, bills, expenses, and other transactions.",
      inputSchema: {
        name: z.string().describe("Tag name (e.g. 'Campaign-Q1', 'Office-Renovation', 'Grant-XYZ')"),
        tagGroupId: z.string().optional().describe("Tag group ID to organize this tag within a group"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const body: Record<string, unknown> = { Name: args.name };
      if (args.tagGroupId) body.TagGroup = { Id: args.tagGroupId };
      const result = await logger.time(
        "tool.create_tag",
        () => client.post("/tag", body),
        { tool: "create_tag" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── list_tag_groups ────────────────────────────────────────────────────────
  server.registerTool(
    "list_tag_groups",
    {
      title: "List Tag Groups",
      description:
        "List all Tag Groups in QuickBooks. Tag groups organize related tags together (e.g. 'Marketing' group with tags 'Campaign-Q1', 'Campaign-Q2'). Returns group name, active status, and list of tags in each group.",
      inputSchema: {
        where: z.string().optional().describe("QBO query WHERE clause"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset (default: 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default: 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.list_tag_groups",
        () => client.query("TagGroup", args.where as string | undefined, args.startPosition ?? 1, args.maxResults ?? 100),
        { tool: "list_tag_groups" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
