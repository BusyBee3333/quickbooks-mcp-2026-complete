// Aging Reports: AR summary/detail, AP summary/detail
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── ar_aging_summary ───────────────────────────────────────────────────────
  server.registerTool(
    "ar_aging_summary",
    {
      title: "AR Aging Summary Report",
      description:
        "Get an Accounts Receivable Aging Summary showing total outstanding balances per customer bucketed by age (Current, 1-30, 31-60, 61-90, 90+ days). One row per customer. Use for high-level collections overview and dashboard metrics.",
      inputSchema: {
        reportDate: z.string().optional().describe("As-of date (YYYY-MM-DD, default: today)"),
        agingPeriod: z.number().int().optional().describe("Days per aging bucket (default: 30)"),
        numberOfPeriods: z.number().int().optional().describe("Number of aging buckets (default: 4)"),
        customerId: z.string().optional().describe("Filter to a specific customer ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.reportDate) params.set("report_date", args.reportDate as string);
      if (args.agingPeriod) params.set("aging_period", String(args.agingPeriod));
      if (args.numberOfPeriods) params.set("num_periods", String(args.numberOfPeriods));
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.ar_aging_summary",
        () => client.get(`/reports/AgedReceivables?${params}`),
        { tool: "ar_aging_summary" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── ar_aging_detail ────────────────────────────────────────────────────────
  server.registerTool(
    "ar_aging_detail",
    {
      title: "AR Aging Detail Report",
      description:
        "Get an Accounts Receivable Aging Detail report showing each individual outstanding invoice with its age. More granular than ar_aging_summary — shows each invoice, due date, and days past due. Use for targeted collection calls.",
      inputSchema: {
        reportDate: z.string().optional().describe("As-of date (YYYY-MM-DD, default: today)"),
        agingPeriod: z.number().int().optional().describe("Days per aging bucket (default: 30)"),
        numberOfPeriods: z.number().int().optional().describe("Number of aging buckets (default: 4)"),
        customerId: z.string().optional().describe("Filter to a specific customer ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.reportDate) params.set("report_date", args.reportDate as string);
      if (args.agingPeriod) params.set("aging_period", String(args.agingPeriod));
      if (args.numberOfPeriods) params.set("num_periods", String(args.numberOfPeriods));
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.ar_aging_detail",
        () => client.get(`/reports/AgedReceivableDetail?${params}`),
        { tool: "ar_aging_detail" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── ap_aging_summary ───────────────────────────────────────────────────────
  server.registerTool(
    "ap_aging_summary",
    {
      title: "AP Aging Summary Report",
      description:
        "Get an Accounts Payable Aging Summary showing total outstanding bill balances per vendor bucketed by age. One row per vendor. Use for cash flow planning, vendor relationship management, and AP dashboard metrics.",
      inputSchema: {
        reportDate: z.string().optional().describe("As-of date (YYYY-MM-DD, default: today)"),
        agingPeriod: z.number().int().optional().describe("Days per aging bucket (default: 30)"),
        numberOfPeriods: z.number().int().optional().describe("Number of aging buckets (default: 4)"),
        vendorId: z.string().optional().describe("Filter to a specific vendor ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.reportDate) params.set("report_date", args.reportDate as string);
      if (args.agingPeriod) params.set("aging_period", String(args.agingPeriod));
      if (args.numberOfPeriods) params.set("num_periods", String(args.numberOfPeriods));
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.ap_aging_summary",
        () => client.get(`/reports/AgedPayables?${params}`),
        { tool: "ap_aging_summary" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── ap_aging_detail ────────────────────────────────────────────────────────
  server.registerTool(
    "ap_aging_detail",
    {
      title: "AP Aging Detail Report",
      description:
        "Get an Accounts Payable Aging Detail report showing each individual outstanding bill with its age, due date, and days past due. More granular than ap_aging_summary. Use for prioritizing bill payments and avoiding late fees.",
      inputSchema: {
        reportDate: z.string().optional().describe("As-of date (YYYY-MM-DD, default: today)"),
        agingPeriod: z.number().int().optional().describe("Days per aging bucket (default: 30)"),
        numberOfPeriods: z.number().int().optional().describe("Number of aging buckets (default: 4)"),
        vendorId: z.string().optional().describe("Filter to a specific vendor ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.reportDate) params.set("report_date", args.reportDate as string);
      if (args.agingPeriod) params.set("aging_period", String(args.agingPeriod));
      if (args.numberOfPeriods) params.set("num_periods", String(args.numberOfPeriods));
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.ap_aging_detail",
        () => client.get(`/reports/AgedPayableDetail?${params}`),
        { tool: "ap_aging_detail" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
