// Tax Reports tools: tax_summary_report, tax_detail_report, sales_tax_liability_report
// QuickBooks tax reporting for compliance and filing
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── tax_summary_report ─────────────────────────────────────────────────────
  server.registerTool(
    "tax_summary_report",
    {
      title: "Sales Tax Summary Report",
      description:
        "Get a Sales Tax Summary report showing total taxable sales, non-taxable sales, and tax collected by tax agency for a period. Use for tax filing preparation — shows exactly how much tax you collected per agency so you know what to remit. Returns totals by tax rate and agency.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        taxAgencyId: z.string().optional().describe("Filter by specific tax agency ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.taxAgencyId) params.set("taxagency", args.taxAgencyId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.tax_summary_report",
        () => client.get(`/reports/TaxSummary?${params}`),
        { tool: "tax_summary_report", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── sales_tax_liability_report ─────────────────────────────────────────────
  server.registerTool(
    "sales_tax_liability_report",
    {
      title: "Sales Tax Liability Report",
      description:
        "Get a Sales Tax Liability report showing your total tax liability to each tax agency. Breaks down taxable amount, exempt amount, tax rate, and total tax owed per agency. Essential for preparing sales tax returns and verifying tax collected matches what's owed to each jurisdiction.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        taxAgencyId: z.string().optional().describe("Filter by specific tax agency ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.taxAgencyId) params.set("taxagency", args.taxAgencyId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.sales_tax_liability_report",
        () => client.get(`/reports/TaxSummary?${params}`),
        { tool: "sales_tax_liability_report", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── expenses_by_vendor_summary ─────────────────────────────────────────────
  server.registerTool(
    "expenses_by_vendor_summary",
    {
      title: "Expenses by Vendor Summary Report",
      description:
        "Get an Expenses by Vendor Summary report showing total money spent with each vendor for a date range. Includes bills, checks, credit card charges, and purchase expenses. Use for vendor spend analysis, cost control, and negotiating better terms with top vendors.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        vendorId: z.string().optional().describe("Filter to a specific vendor ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.expenses_by_vendor_summary",
        () => client.get(`/reports/VendorExpenses?${params}`),
        { tool: "expenses_by_vendor_summary", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── account_list_report ────────────────────────────────────────────────────
  server.registerTool(
    "account_list_report",
    {
      title: "Account List Report",
      description:
        "Get an Account List report from QuickBooks showing all accounts in the chart of accounts with their type, detail type, balance, and active status. More comprehensive than list_accounts — includes account numbers, descriptions, and formatted balances. Ideal for auditors, accountants, and understanding the full chart of accounts structure.",
      inputSchema: {
        accountType: z
          .string()
          .optional()
          .describe("Filter by account type (e.g. 'Income', 'Expense', 'Asset', 'Liability', 'Equity')"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.accountType) params.set("account_type", args.accountType as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.account_list_report",
        () => client.get(`/reports/AccountList?${params}`),
        { tool: "account_list_report" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── class_sales_report ─────────────────────────────────────────────────────
  server.registerTool(
    "class_sales_report",
    {
      title: "Profit & Loss by Class Report",
      description:
        "Get a Profit & Loss by Class report segmenting income and expenses across QuickBooks classes. Essential for multi-segment businesses tracking P&L by product line, project, or division. Returns each class as a column with income, cost, and net income.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        classId: z.string().optional().describe("Filter to a specific class ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      params.set("summarize_column_by", "Classes");
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.class_sales_report",
        () => client.get(`/reports/ProfitAndLoss?${params}`),
        { tool: "class_sales_report", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── department_profit_loss_report ──────────────────────────────────────────
  server.registerTool(
    "department_profit_loss_report",
    {
      title: "Profit & Loss by Department/Location Report",
      description:
        "Get a Profit & Loss by Department (Location) report showing income and expenses broken down by department/location. Ideal for multi-location businesses tracking profitability per store, region, or division. Returns each department as a column with full P&L detail.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        departmentId: z.string().optional().describe("Filter to a specific department ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      params.set("summarize_column_by", "Departments");
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.department_profit_loss_report",
        () => client.get(`/reports/ProfitAndLoss?${params}`),
        { tool: "department_profit_loss_report", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── budget_vs_actuals_report ───────────────────────────────────────────────
  server.registerTool(
    "budget_vs_actuals_report",
    {
      title: "Budget vs. Actuals Report",
      description:
        "Get a Budget vs. Actuals report comparing budgeted amounts to actual income and expenses for a period. Shows variance (over/under budget) for each account. Essential for financial planning, identifying cost overruns, and performance management. Requires a budget to exist in QuickBooks.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        budgetId: z.string().optional().describe("Specific budget ID to compare against (uses most recent if not specified)"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        classId: z.string().optional().describe("Filter by class ID"),
        departmentId: z.string().optional().describe("Filter by department ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.budgetId) params.set("budget_id", args.budgetId as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.budget_vs_actuals_report",
        () => client.get(`/reports/ProfitAndLossDetail?${params}&budget=true`),
        { tool: "budget_vs_actuals_report", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
