// Departments tools: list_departments, get_department, create_department
// In QuickBooks Online, Departments are also called "Locations" or "Business Units"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_departments ────────────────────────────────────────────────────────
  server.registerTool(
    "list_departments",
    {
      title: "List QuickBooks Departments",
      description:
        "List QuickBooks Online departments (also called locations or business units). Returns department name, fully qualified name, and active status. Departments are used to segment financial reports by location or business unit.",
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
        "tool.list_departments",
        () => client.query(
          "Department",
          where,
          args.startPosition ?? 1,
          args.maxResults ?? 100,
          args.orderBy as string | undefined
        ),
        { tool: "list_departments" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_department ──────────────────────────────────────────────────────────
  server.registerTool(
    "get_department",
    {
      title: "Get QuickBooks Department",
      description:
        "Get full details for a QuickBooks department by ID. Returns name, fully qualified name, parent department (if sub-department), and active status.",
      inputSchema: {
        departmentId: z.string().describe("QuickBooks department ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_department",
        () => client.get(`/department/${args.departmentId}`),
        { tool: "get_department", departmentId: args.departmentId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_department ───────────────────────────────────────────────────────
  server.registerTool(
    "create_department",
    {
      title: "Create QuickBooks Department",
      description:
        "Create a new department (location/business unit) in QuickBooks Online. Departments can be nested under parent departments. Returns the created department with assigned ID.",
      inputSchema: {
        name: z.string().describe("Department name"),
        parentDepartmentId: z.string().optional().describe("Parent department ID to create a sub-department"),
        active: z.boolean().optional().describe("Whether department is active (default: true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const dept: Record<string, unknown> = {
        Name: args.name,
      };

      if (args.parentDepartmentId) {
        dept.SubDepartment = true;
        dept.ParentRef = { value: args.parentDepartmentId };
      }
      if (args.active !== undefined) dept.Active = args.active;

      const result = await logger.time(
        "tool.create_department",
        () => client.post("/department", dept),
        { tool: "create_department" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
