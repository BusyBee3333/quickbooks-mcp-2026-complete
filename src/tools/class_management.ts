// Class Management: update, delete, sub-class operations (extends basic classes.ts)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── update_class ───────────────────────────────────────────────────────────
  server.registerTool(
    "update_class",
    {
      title: "Update Class",
      description:
        "Update an existing Class in QuickBooks. Rename it, change its active status, or reassign its parent class. Requires classId and syncToken from get_class. Use to reorganize your class structure or deactivate unused classes.",
      inputSchema: {
        classId: z.string().describe("Class ID (from list_classes or get_class)"),
        syncToken: z.string().describe("SyncToken from get_class"),
        name: z.string().optional().describe("New class name"),
        active: z.boolean().optional().describe("Set false to deactivate the class"),
        parentClassId: z.string().optional().describe("New parent class ID (for sub-classes)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const body: Record<string, unknown> = {
        Id: args.classId,
        SyncToken: args.syncToken,
        sparse: true,
      };
      if (args.name) body.Name = args.name;
      if (args.active !== undefined) body.Active = args.active;
      if (args.parentClassId) body.ParentRef = { value: args.parentClassId };
      const result = await logger.time(
        "tool.update_class",
        () => client.post("/class", body),
        { tool: "update_class", classId: args.classId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── create_subclass ────────────────────────────────────────────────────────
  server.registerTool(
    "create_subclass",
    {
      title: "Create Sub-Class",
      description:
        "Create a new sub-class (child class) under an existing parent class in QuickBooks. Sub-classes let you create hierarchical classification for finer-grained P&L segmentation (e.g. 'Services > Consulting', 'Products > Hardware'). Requires QBO Plus or Advanced.",
      inputSchema: {
        name: z.string().describe("Sub-class name"),
        parentClassId: z.string().describe("Parent class ID that this sub-class belongs to"),
        active: z.boolean().optional().describe("Active status (default: true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const body: Record<string, unknown> = {
        Name: args.name,
        ParentRef: { value: args.parentClassId },
        SubClass: true,
      };
      if (args.active !== undefined) body.Active = args.active;
      const result = await logger.time(
        "tool.create_subclass",
        () => client.post("/class", body),
        { tool: "create_subclass" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── list_class_hierarchy ───────────────────────────────────────────────────
  server.registerTool(
    "list_class_hierarchy",
    {
      title: "List Class Hierarchy",
      description:
        "List all classes including their parent-child relationships and fully qualified names. Returns both top-level classes and sub-classes with their hierarchy context. Use to understand the full class tree for reporting and transaction tagging.",
      inputSchema: {
        includeInactive: z.boolean().optional().describe("Include inactive classes (default: false)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const where = args.includeInactive ? undefined : "Active = true";
      const result = await logger.time(
        "tool.list_class_hierarchy",
        () => client.query("Class", where, 1, 1000),
        { tool: "list_class_hierarchy" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
