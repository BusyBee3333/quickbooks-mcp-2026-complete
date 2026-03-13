// Revenue Recognition tools: schedules, deferred revenue management
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_revenue_recognition_rules ────────────────────────────────────────
  server.registerTool(
    "list_revenue_recognition_rules",
    {
      title: "List Revenue Recognition Rules",
      description:
        "List revenue recognition rules configured in QuickBooks. Revenue recognition rules define how and when deferred revenue should be recognized over a period (e.g. monthly over 12 months). Requires QBO Advanced. Use for ASC 606 / IFRS 15 compliance.",
      inputSchema: {
        startPosition: z.number().int().min(1).optional().describe("Pagination offset (default: 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default: 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.list_revenue_recognition_rules",
        () => client.query("RevenueRecognitionRule", undefined, args.startPosition ?? 1, args.maxResults ?? 100),
        { tool: "list_revenue_recognition_rules" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── get_revenue_recognition_rule ───────────────────────────────────────────
  server.registerTool(
    "get_revenue_recognition_rule",
    {
      title: "Get Revenue Recognition Rule",
      description:
        "Get details for a specific revenue recognition rule by ID. Returns the rule's recognition method (straight-line, etc.), recognition period, deferral account, and income account. Use to verify rule configuration before applying to invoices.",
      inputSchema: {
        ruleId: z.string().describe("Revenue recognition rule ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_revenue_recognition_rule",
        () => client.get(`/revenuerecognitionrule/${args.ruleId}`),
        { tool: "get_revenue_recognition_rule", ruleId: args.ruleId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── revenue_recognition_report ─────────────────────────────────────────────
  server.registerTool(
    "revenue_recognition_report",
    {
      title: "Revenue Recognition Report",
      description:
        "Get a Revenue Recognition report showing deferred revenue schedules, amounts recognized, and amounts still deferred for each contract or revenue recognition rule. Provides period-by-period revenue recognition detail. Essential for SaaS and subscription businesses with deferred revenue.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        customerId: z.string().optional().describe("Filter by customer ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.revenue_recognition_report",
        () => client.get(`/reports/RevenueRecognitionReport?${params}`),
        { tool: "revenue_recognition_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── deferred_revenue_report ────────────────────────────────────────────────
  server.registerTool(
    "deferred_revenue_report",
    {
      title: "Deferred Revenue Report",
      description:
        "Get a Deferred Revenue report showing the balance of unearned/deferred revenue as of a date. Lists each deferred revenue item, its original amount, amount recognized to date, and remaining deferred balance. Use for balance sheet deferred revenue account reconciliation.",
      inputSchema: {
        endDate: z.string().describe("As-of date for deferred revenue balance (YYYY-MM-DD)"),
        accountId: z.string().optional().describe("Filter to a specific deferred revenue account ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("end_date", args.endDate as string);
      if (args.accountId) params.set("account", args.accountId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.deferred_revenue_report",
        () => client.get(`/reports/DeferredRevenueReport?${params}`),
        { tool: "deferred_revenue_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
