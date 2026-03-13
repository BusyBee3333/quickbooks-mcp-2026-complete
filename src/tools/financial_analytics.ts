// Financial Analytics: KPI aggregation, financial health scorecard, open transactions
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── financial_kpis ─────────────────────────────────────────────────────────
  server.registerTool(
    "financial_kpis",
    {
      title: "Financial KPIs Dashboard",
      description:
        "Fetch multiple key financial metrics in a single call: current period P&L, YTD revenue, open invoices total, unpaid bills total, and cash balance. Returns a concise financial health snapshot. Use as a daily/weekly executive dashboard or to get quick financial context before deeper analysis.",
      inputSchema: {
        periodStartDate: z.string().describe("Current period start date (YYYY-MM-DD)"),
        periodEndDate: z.string().describe("Current period end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const [plResult, arResult, apResult, bankResult] = await Promise.all([
        // P&L for the period
        logger.time("tool.financial_kpis.pl", () => {
          const params = new URLSearchParams();
          params.set("start_date", args.periodStartDate as string);
          params.set("end_date", args.periodEndDate as string);
          if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
          return client.get(`/reports/ProfitAndLoss?${params}`);
        }, { tool: "financial_kpis" }),
        // Open invoices (AR)
        logger.time("tool.financial_kpis.ar", () =>
          client.query("Invoice", "Balance > '0.00' AND DueDate < CURRENT_DATE", 1, 1),
          { tool: "financial_kpis" }
        ),
        // Unpaid bills (AP)
        logger.time("tool.financial_kpis.ap", () =>
          client.query("Bill", "Balance > '0.00'", 1, 1),
          { tool: "financial_kpis" }
        ),
        // Bank accounts balance
        logger.time("tool.financial_kpis.bank", () =>
          client.query("Account", "AccountType = 'Bank' AND Active = true", 1, 100),
          { tool: "financial_kpis" }
        ),
      ]);

      const snapshot = {
        period: { startDate: args.periodStartDate, endDate: args.periodEndDate },
        profitAndLoss: plResult,
        accountsReceivable: { openInvoicesSample: arResult },
        accountsPayable: { unpaidBillsSample: apResult },
        bankAccounts: bankResult,
        generatedAt: new Date().toISOString(),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(snapshot, null, 2) }], structuredContent: snapshot };
    }
  );

  // ── open_transactions_summary ──────────────────────────────────────────────
  server.registerTool(
    "open_transactions_summary",
    {
      title: "Open Transactions Summary",
      description:
        "Get a summary of all open (unpaid/uncleared) transactions across invoices, bills, and purchase orders. Returns counts and total amounts for: open invoices (AR), overdue invoices, unpaid bills (AP), overdue bills, and open purchase orders. Use for daily cash management and collections prioritization.",
      inputSchema: {
        asOfDate: z.string().optional().describe("As-of date for overdue calculation (YYYY-MM-DD, default: today)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const today = (args.asOfDate as string) || new Date().toISOString().split("T")[0];
      const [openInvoices, overdueInvoices, openBills, overdueBills, openPOs] = await Promise.all([
        client.query("Invoice", "Balance > '0.00'", 1, 1000),
        client.query("Invoice", `Balance > '0.00' AND DueDate < '${today}'`, 1, 1000),
        client.query("Bill", "Balance > '0.00'", 1, 1000),
        client.query("Bill", `Balance > '0.00' AND DueDate < '${today}'`, 1, 1000),
        client.query("PurchaseOrder", "POStatus = 'Open'", 1, 1000),
      ]);

      const summarize = (qr: unknown) => {
        const r = qr as { QueryResponse?: Record<string, unknown> };
        const response = r.QueryResponse || {};
        // totalCount is the real count from QBO
        return { count: (response.totalCount as number) ?? 0 };
      };

      const summary = {
        asOfDate: today,
        openInvoices: summarize(openInvoices),
        overdueInvoices: summarize(overdueInvoices),
        openBills: summarize(openBills),
        overdueBills: summarize(overdueBills),
        openPurchaseOrders: summarize(openPOs),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }], structuredContent: summary };
    }
  );

  // ── top_customers_by_revenue ───────────────────────────────────────────────
  server.registerTool(
    "top_customers_by_revenue",
    {
      title: "Top Customers by Revenue",
      description:
        "Get a Sales by Customer Summary report and identify top customers by total revenue for a period. Returns customer name, total sales, and percentage of total revenue. Use for customer concentration risk analysis, key account identification, and sales strategy.",
      inputSchema: {
        startDate: z.string().describe("Period start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Period end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.top_customers_by_revenue",
        () => client.get(`/reports/CustomerSales?${params}`),
        { tool: "top_customers_by_revenue" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── unbilled_time_and_expenses ─────────────────────────────────────────────
  server.registerTool(
    "unbilled_time_and_expenses",
    {
      title: "Unbilled Time & Expenses Report",
      description:
        "Get a report of all billable time activities and expenses that have not yet been invoiced to customers. Shows unbilled hours and costs per customer, ready to be invoiced. Use for ensuring all billable work gets invoiced and identifying revenue leakage.",
      inputSchema: {
        customerId: z.string().optional().describe("Filter to a specific customer ID"),
        startDate: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.startDate) params.set("start_date", args.startDate as string);
      if (args.endDate) params.set("end_date", args.endDate as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.unbilled_time_and_expenses",
        () => client.get(`/reports/UnbilledTime?${params}`),
        { tool: "unbilled_time_and_expenses" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
