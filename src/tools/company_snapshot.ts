// Company Snapshot and Dashboard tools: company_snapshot_report, purchases_by_vendor_detail
// High-level company overview and operational reports
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── company_snapshot ───────────────────────────────────────────────────────
  server.registerTool(
    "company_snapshot",
    {
      title: "Company Snapshot Dashboard",
      description:
        "Get a high-level financial snapshot of the QuickBooks company including key metrics: current cash balance, accounts receivable, accounts payable, net income (YTD), and recent transaction counts. Aggregates data from multiple sources to give a dashboard-style overview. Use for executive summaries or quick financial health checks.",
      inputSchema: {
        asOfDate: z.string().optional().describe("As-of date for balance calculations (YYYY-MM-DD, default: today)"),
        ytdStartDate: z.string().optional().describe("Year-to-date start date for income calculations (YYYY-MM-DD, default: start of current year)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const today = (args.asOfDate as string | undefined) ?? new Date().toISOString().slice(0, 10);
      const currentYear = today.slice(0, 4);
      const ytdStart = (args.ytdStartDate as string | undefined) ?? `${currentYear}-01-01`;

      // Fetch P&L summary for YTD
      const plParams = new URLSearchParams();
      plParams.set("start_date", ytdStart);
      plParams.set("end_date", today);

      // Fetch Balance Sheet for current position
      const bsParams = new URLSearchParams();
      bsParams.set("start_date", ytdStart);
      bsParams.set("end_date", today);

      // Fetch AR aging summary
      const arParams = new URLSearchParams();
      arParams.set("report_date", today);

      // Fetch AP aging summary
      const apParams = new URLSearchParams();
      apParams.set("report_date", today);

      const [plResult, bsResult, arResult, apResult] = await Promise.all([
        logger.time("tool.company_snapshot.pl", () => client.get(`/reports/ProfitAndLoss?${plParams}`), {}),
        logger.time("tool.company_snapshot.bs", () => client.get(`/reports/BalanceSheet?${bsParams}`), {}),
        logger.time("tool.company_snapshot.ar", () => client.get(`/reports/AgedReceivables?${arParams}`), {}),
        logger.time("tool.company_snapshot.ap", () => client.get(`/reports/AgedPayables?${apParams}`), {}),
      ]);

      const snapshot = {
        asOfDate: today,
        ytdStartDate: ytdStart,
        profitAndLoss: plResult,
        balanceSheet: bsResult,
        arAging: arResult,
        apAging: apResult,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(snapshot, null, 2) }],
        structuredContent: snapshot as Record<string, unknown>,
      };
    }
  );

  // ── purchases_by_product_service ───────────────────────────────────────────
  server.registerTool(
    "purchases_by_product_service",
    {
      title: "Purchases by Product/Service Report",
      description:
        "Get a Purchases by Product/Service report showing what items you've purchased from vendors, quantities, and total cost for a date range. Useful for procurement analysis, identifying top purchased items, and comparing purchasing costs over time.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        itemId: z.string().optional().describe("Filter to a specific item/product ID"),
        vendorId: z.string().optional().describe("Filter by vendor ID"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.itemId) params.set("item", args.itemId as string);
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.purchases_by_product_service",
        () => client.get(`/reports/PurchasesByProduct?${params}`),
        { tool: "purchases_by_product_service", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── open_purchase_orders_report ────────────────────────────────────────────
  server.registerTool(
    "open_purchase_orders_report",
    {
      title: "Open Purchase Orders Report",
      description:
        "Get an Open Purchase Orders report showing all outstanding purchase orders — items ordered from vendors that haven't been fully received and billed yet. Returns PO number, vendor, ship date, amount, and open balance. Use for procurement tracking, inventory reorder monitoring, and AP planning.",
      inputSchema: {
        vendorId: z.string().optional().describe("Filter by vendor ID"),
        reportDate: z.string().optional().describe("As-of date (YYYY-MM-DD, default: today)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.reportDate) params.set("report_date", args.reportDate as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.open_purchase_orders_report",
        () => client.get(`/reports/OpenPurchaseOrders?${params}`),
        { tool: "open_purchase_orders_report" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── missing_checks_report ──────────────────────────────────────────────────
  server.registerTool(
    "missing_checks_report",
    {
      title: "Missing Checks Report",
      description:
        "Get a Missing Checks report identifying gaps in check number sequences for a bank account. Helps detect missing, voided, or skipped check numbers that could indicate data entry errors or fraud. Returns gaps in the check number sequence with date ranges.",
      inputSchema: {
        bankAccountId: z.string().describe("Bank account ID to check for missing check numbers"),
        startDate: z.string().optional().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("Report end date (YYYY-MM-DD)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("account", args.bankAccountId as string);
      if (args.startDate) params.set("start_date", args.startDate as string);
      if (args.endDate) params.set("end_date", args.endDate as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.missing_checks_report",
        () => client.get(`/reports/MissingChecks?${params}`),
        { tool: "missing_checks_report", bankAccountId: args.bankAccountId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── unbilled_time_report ───────────────────────────────────────────────────
  server.registerTool(
    "unbilled_time_report",
    {
      title: "Unbilled Time & Expenses Report",
      description:
        "Get an Unbilled Time and Expenses report showing billable time activities and expenses that haven't been invoiced to customers yet. Use to ensure all billable work gets captured on invoices. Returns employee name, customer, hours, rate, and billable amount organized by customer.",
      inputSchema: {
        reportDate: z.string().optional().describe("As-of date (YYYY-MM-DD, default: today)"),
        customerId: z.string().optional().describe("Filter to a specific customer ID"),
        employeeId: z.string().optional().describe("Filter to a specific employee ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.reportDate) params.set("report_date", args.reportDate as string);
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.employeeId) params.set("employee", args.employeeId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.unbilled_time_report",
        () => client.get(`/reports/UnbilledTime?${params}`),
        { tool: "unbilled_time_report" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
