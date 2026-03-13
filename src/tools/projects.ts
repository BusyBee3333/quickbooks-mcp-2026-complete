// Projects tools: list_projects, get_project, create_project, update_project (QBO Advanced)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_projects ──────────────────────────────────────────────────────────
  server.registerTool(
    "list_projects",
    {
      title: "List QBO Projects",
      description:
        "List QuickBooks Projects (QBO Advanced feature). Projects let you track income, expenses, and time against a specific project or job for a customer. Returns project name, status, customer, and totals. Use to get project IDs for financial analysis.",
      inputSchema: {
        where: z.string().optional().describe("QBO query WHERE clause (e.g. \"Status = 'InProgress'\")"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default: 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default: 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.list_projects",
        () => client.query("Project", args.where as string | undefined, args.startPosition ?? 1, args.maxResults ?? 100),
        { tool: "list_projects" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── get_project ────────────────────────────────────────────────────────────
  server.registerTool(
    "get_project",
    {
      title: "Get QBO Project",
      description:
        "Get full details for a QuickBooks Project by ID. Returns project name, description, status (InProgress, Completed, Archived), customer reference, and financial totals. Requires QBO Advanced.",
      inputSchema: {
        projectId: z.string().describe("QuickBooks Project ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_project",
        () => client.get(`/project/${args.projectId}`),
        { tool: "get_project", projectId: args.projectId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── create_project ─────────────────────────────────────────────────────────
  server.registerTool(
    "create_project",
    {
      title: "Create QBO Project",
      description:
        "Create a new QuickBooks Project linked to a customer. Projects enable project-level P&L, time tracking, and expense tracking in QBO Advanced. Once created, assign invoices, bills, and time entries to the project.",
      inputSchema: {
        name: z.string().describe("Project name (shown in QBO and on transactions)"),
        customerId: z.string().describe("Customer ID to link the project to"),
        description: z.string().optional().describe("Project description or notes"),
        dueDate: z.string().optional().describe("Project due date (YYYY-MM-DD)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const body: Record<string, unknown> = {
        Name: args.name,
        CustomerRef: { value: args.customerId },
      };
      if (args.description) body.Description = args.description;
      if (args.dueDate) body.DueDate = args.dueDate;
      const result = await logger.time(
        "tool.create_project",
        () => client.post("/project", body),
        { tool: "create_project" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── update_project ─────────────────────────────────────────────────────────
  server.registerTool(
    "update_project",
    {
      title: "Update QBO Project",
      description:
        "Update an existing QuickBooks Project. Change the name, description, due date, or status (InProgress → Completed or Archived). Requires projectId and syncToken from get_project.",
      inputSchema: {
        projectId: z.string().describe("Project ID"),
        syncToken: z.string().describe("SyncToken from get_project (required for optimistic locking)"),
        name: z.string().optional().describe("New project name"),
        description: z.string().optional().describe("New description"),
        dueDate: z.string().optional().describe("New due date (YYYY-MM-DD)"),
        status: z.enum(["InProgress", "Completed", "Archived"]).optional().describe("New project status"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const body: Record<string, unknown> = {
        Id: args.projectId,
        SyncToken: args.syncToken,
        sparse: true,
      };
      if (args.name) body.Name = args.name;
      if (args.description) body.Description = args.description;
      if (args.dueDate) body.DueDate = args.dueDate;
      if (args.status) body.Status = args.status;
      const result = await logger.time(
        "tool.update_project",
        () => client.post("/project", body),
        { tool: "update_project", projectId: args.projectId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── project_profitability_report ───────────────────────────────────────────
  server.registerTool(
    "project_profitability_report",
    {
      title: "Project Profitability Report",
      description:
        "Get a Profit & Loss report filtered to a specific project. Shows income, costs, and net profit for that project. Requires QBO Advanced and a project linked to a customer. Use for job costing and project ROI analysis.",
      inputSchema: {
        projectId: z.string().describe("Project ID to filter the report"),
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      params.set("projectid", args.projectId as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.project_profitability_report",
        () => client.get(`/reports/ProfitAndLoss?${params}`),
        { tool: "project_profitability_report", projectId: args.projectId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
