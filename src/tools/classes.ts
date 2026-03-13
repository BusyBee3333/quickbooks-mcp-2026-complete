// Classes tools: list_classes, get_class, create_class
// Classes are used for profit-center tracking and segmentation in QBO
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_classes ────────────────────────────────────────────────────────────
  server.registerTool(
    "list_classes",
    {
      title: "List QuickBooks Classes",
      description:
        "List QuickBooks Online classes used for profit-center and segment tracking. Returns class name, fully qualified name, and active status. Classes can be used to filter reports by business segment.",
      inputSchema: {
        active: z.boolean().optional().describe("Filter by active status"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'Name ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.active !== undefined) whereParts.push(`Active = ${args.active}`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_classes",
        () => client.query(
          "Class",
          where,
          args.startPosition ?? 1,
          args.maxResults ?? 100,
          args.orderBy as string | undefined
        ),
        { tool: "list_classes" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_class ───────────────────────────────────────────────────────────────
  server.registerTool(
    "get_class",
    {
      title: "Get QuickBooks Class",
      description:
        "Get full details for a QuickBooks class by ID. Returns name, fully qualified name, parent class (if sub-class), and active status.",
      inputSchema: {
        classId: z.string().describe("QuickBooks class ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_class",
        () => client.get(`/class/${args.classId}`),
        { tool: "get_class", classId: args.classId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_class ────────────────────────────────────────────────────────────
  server.registerTool(
    "create_class",
    {
      title: "Create QuickBooks Class",
      description:
        "Create a new class in QuickBooks Online for profit-center or segment tracking. Classes can be nested under parent classes. Returns the created class with assigned ID.",
      inputSchema: {
        name: z.string().describe("Class name"),
        parentClassId: z.string().optional().describe("Parent class ID to create a sub-class"),
        active: z.boolean().optional().describe("Whether class is active (default: true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const cls: Record<string, unknown> = {
        Name: args.name,
      };

      if (args.parentClassId) {
        cls.SubClass = true;
        cls.ParentRef = { value: args.parentClassId };
      }
      if (args.active !== undefined) cls.Active = args.active;

      const result = await logger.time(
        "tool.create_class",
        () => client.post("/class", cls),
        { tool: "create_class" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
