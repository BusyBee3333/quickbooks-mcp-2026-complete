// Reports tools: profit_loss_report, balance_sheet_report
// QuickBooks Reports API: /reports/{reportName}?params
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── profit_loss_report ─────────────────────────────────────────────────────
  server.registerTool(
    "profit_loss_report",
    {
      title: "Profit & Loss Report",
      description:
        "Get a Profit & Loss (Income Statement) report for a date range. Returns income, expenses, and net income broken down by account. Supports comparison periods and class/department segmentation. Use for financial analysis and reporting.",
      inputSchema: {
        startDate: z
          .string()
          .describe("Report start date (YYYY-MM-DD)"),
        endDate: z
          .string()
          .describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        summarizeColumnsBy: z
          .enum(["Total", "Month", "Week", "Days", "Quarter", "Year", "Customers", "Vendors", "Employees", "Departments", "Classes", "ProductsAndServices"])
          .optional()
          .describe("Group columns by period or dimension (default: Total)"),
        classId: z.string().optional().describe("Filter by class ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        customerId: z.string().optional().describe("Filter by customer ID"),
        vendorId: z.string().optional().describe("Filter by vendor ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.summarizeColumnsBy) params.set("summarize_column_by", args.summarizeColumnsBy as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.profit_loss_report",
        () => client.get(`/reports/ProfitAndLoss?${params}`),
        { tool: "profit_loss_report", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── balance_sheet_report ───────────────────────────────────────────────────
  server.registerTool(
    "balance_sheet_report",
    {
      title: "Balance Sheet Report",
      description:
        "Get a Balance Sheet report as of a specific date. Returns assets, liabilities, and equity broken down by account. Use for financial position analysis, auditing, or investor reporting.",
      inputSchema: {
        startDate: z
          .string()
          .describe("Report start date (YYYY-MM-DD)"),
        endDate: z
          .string()
          .describe("Report end date / as-of date (YYYY-MM-DD)"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        summarizeColumnsBy: z
          .enum(["Total", "Month", "Week", "Days", "Quarter", "Year"])
          .optional()
          .describe("Group columns by time period (default: Total)"),
        classId: z.string().optional().describe("Filter by class ID"),
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
      if (args.summarizeColumnsBy) params.set("summarize_column_by", args.summarizeColumnsBy as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.balance_sheet_report",
        () => client.get(`/reports/BalanceSheet?${params}`),
        { tool: "balance_sheet_report", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── profit_and_loss_detail ─────────────────────────────────────────────────
  server.registerTool(
    "profit_and_loss_detail",
    {
      title: "Profit & Loss Detail Report",
      description:
        "Get a detailed Profit & Loss report showing individual transactions within each account, for a date range. More granular than profit_loss_report — includes transaction dates, names, and amounts. Useful for auditing.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        classId: z.string().optional().describe("Filter by class ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        customerId: z.string().optional().describe("Filter by customer ID"),
        vendorId: z.string().optional().describe("Filter by vendor ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.profit_and_loss_detail",
        () => client.get(`/reports/ProfitAndLossDetail?${params}`),
        { tool: "profit_and_loss_detail", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── accounts_receivable_aging ──────────────────────────────────────────────
  server.registerTool(
    "accounts_receivable_aging",
    {
      title: "Accounts Receivable Aging Report",
      description:
        "Get an Accounts Receivable aging report showing outstanding customer balances bucketed by age (0-30, 31-60, 61-90, 90+ days). Use to track overdue invoices and collection priorities.",
      inputSchema: {
        reportDate: z.string().optional().describe("As-of date (YYYY-MM-DD, default: today)"),
        agingPeriod: z.number().int().optional().describe("Days per aging bucket (default: 30)"),
        numberOfPeriods: z.number().int().optional().describe("Number of aging buckets (default: 4)"),
        customerId: z.string().optional().describe("Filter by customer ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
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
      if (args.reportDate) params.set("report_date", args.reportDate as string);
      if (args.agingPeriod) params.set("aging_period", String(args.agingPeriod));
      if (args.numberOfPeriods) params.set("num_periods", String(args.numberOfPeriods));
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.accounts_receivable_aging",
        () => client.get(`/reports/AgedReceivables?${params}`),
        { tool: "accounts_receivable_aging" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── accounts_payable_aging ─────────────────────────────────────────────────
  server.registerTool(
    "accounts_payable_aging",
    {
      title: "Accounts Payable Aging Report",
      description:
        "Get an Accounts Payable aging report showing outstanding vendor balances bucketed by age (0-30, 31-60, 61-90, 90+ days). Use to track overdue bills and cash flow planning.",
      inputSchema: {
        reportDate: z.string().optional().describe("As-of date (YYYY-MM-DD, default: today)"),
        agingPeriod: z.number().int().optional().describe("Days per aging bucket (default: 30)"),
        numberOfPeriods: z.number().int().optional().describe("Number of aging buckets (default: 4)"),
        vendorId: z.string().optional().describe("Filter by vendor ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
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
      if (args.reportDate) params.set("report_date", args.reportDate as string);
      if (args.agingPeriod) params.set("aging_period", String(args.agingPeriod));
      if (args.numberOfPeriods) params.set("num_periods", String(args.numberOfPeriods));
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.accounts_payable_aging",
        () => client.get(`/reports/AgedPayables?${params}`),
        { tool: "accounts_payable_aging" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── customer_balance_detail ────────────────────────────────────────────────
  server.registerTool(
    "customer_balance_detail",
    {
      title: "Customer Balance Detail Report",
      description:
        "Get a detailed Customer Balance report showing each customer's outstanding invoices and payments. Returns transaction-level detail per customer. Use for customer statement reconciliation.",
      inputSchema: {
        reportDate: z.string().optional().describe("As-of date (YYYY-MM-DD, default: today)"),
        customerId: z.string().optional().describe("Filter to a specific customer ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
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
      if (args.reportDate) params.set("report_date", args.reportDate as string);
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.customer_balance_detail",
        () => client.get(`/reports/CustomerBalanceDetail?${params}`),
        { tool: "customer_balance_detail" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── vendor_balance_detail ──────────────────────────────────────────────────
  server.registerTool(
    "vendor_balance_detail",
    {
      title: "Vendor Balance Detail Report",
      description:
        "Get a detailed Vendor Balance report showing each vendor's outstanding bills and payments at the transaction level. Use for vendor statement reconciliation, AP auditing, and cash flow planning.",
      inputSchema: {
        reportDate: z.string().optional().describe("As-of date (YYYY-MM-DD, default: today)"),
        vendorId: z.string().optional().describe("Filter to a specific vendor ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
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
      if (args.reportDate) params.set("report_date", args.reportDate as string);
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.vendor_balance_detail",
        () => client.get(`/reports/VendorBalanceDetail?${params}`),
        { tool: "vendor_balance_detail" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── trial_balance ──────────────────────────────────────────────────────────
  server.registerTool(
    "trial_balance",
    {
      title: "Trial Balance Report",
      description:
        "Get a Trial Balance report showing all accounts with their debit and credit balances for a period. Confirms the books are balanced. Essential for period-end close, audits, and financial statement preparation.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
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
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.trial_balance",
        () => client.get(`/reports/TrialBalance?${params}`),
        { tool: "trial_balance", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── general_ledger ─────────────────────────────────────────────────────────
  server.registerTool(
    "general_ledger",
    {
      title: "General Ledger Report",
      description:
        "Get a General Ledger report showing all transactions posted to each account for a date range, with running balances. The most detailed accounting report — use for auditing, reconciliation, and forensic accounting.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        accountId: z.string().optional().describe("Filter to a specific account ID"),
        classId: z.string().optional().describe("Filter by class ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        sourceAccountType: z
          .string()
          .optional()
          .describe("Filter by account type (e.g. 'Income', 'Expense', 'Asset')"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.accountId) params.set("account", args.accountId as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.sourceAccountType) params.set("source_account_type", args.sourceAccountType as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.general_ledger",
        () => client.get(`/reports/GeneralLedger?${params}`),
        { tool: "general_ledger", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── transaction_list ───────────────────────────────────────────────────────
  server.registerTool(
    "transaction_list",
    {
      title: "Transaction List Report",
      description:
        "Get a flat list of all transactions for a date range with optional filters. Returns transaction type, date, number, name, memo, account, split, and amount. Great for searching, exporting, and custom analysis across all transaction types.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        transactionType: z
          .string()
          .optional()
          .describe("Filter by transaction type (e.g. 'Invoice', 'Bill', 'Payment', 'Deposit', 'Transfer')"),
        customerId: z.string().optional().describe("Filter by customer ID"),
        vendorId: z.string().optional().describe("Filter by vendor ID"),
        accountId: z.string().optional().describe("Filter by account ID"),
        classId: z.string().optional().describe("Filter by class ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        memo: z.string().optional().describe("Filter by memo/description (partial match)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.transactionType) params.set("transaction_type", args.transactionType as string);
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.accountId) params.set("account", args.accountId as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.memo) params.set("memo", args.memo as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.transaction_list",
        () => client.get(`/reports/TransactionList?${params}`),
        { tool: "transaction_list", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── inventory_valuation_summary ────────────────────────────────────────────
  server.registerTool(
    "inventory_valuation_summary",
    {
      title: "Inventory Valuation Summary Report",
      description:
        "Get an Inventory Valuation Summary report showing current quantity on hand, average cost, and asset value for each inventory item. Use for inventory audits, balance sheet reconciliation, and COGS analysis.",
      inputSchema: {
        startDate: z.string().optional().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("Report end date / as-of date (YYYY-MM-DD)"),
        itemId: z.string().optional().describe("Filter to a specific item ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.startDate) params.set("start_date", args.startDate as string);
      if (args.endDate) params.set("end_date", args.endDate as string);
      if (args.itemId) params.set("item", args.itemId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.inventory_valuation_summary",
        () => client.get(`/reports/InventoryValuationSummary?${params}`),
        { tool: "inventory_valuation_summary" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── sales_by_customer_summary ──────────────────────────────────────────────
  server.registerTool(
    "sales_by_customer_summary",
    {
      title: "Sales by Customer Summary Report",
      description:
        "Get a Sales by Customer Summary report showing total sales, cost of goods sold, and gross margin broken down by customer for a date range. Use for customer profitability analysis, sales performance, and commission calculations.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        customerId: z.string().optional().describe("Filter to a specific customer ID"),
        classId: z.string().optional().describe("Filter by class ID"),
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
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.sales_by_customer_summary",
        () => client.get(`/reports/CustomerSales?${params}`),
        { tool: "sales_by_customer_summary", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── sales_by_product_service_summary ───────────────────────────────────────
  server.registerTool(
    "sales_by_product_service_summary",
    {
      title: "Sales by Product/Service Summary Report",
      description:
        "Get a Sales by Product/Service Summary report showing quantity sold, total sales, COGS, and gross margin for each product or service. Use for product performance analysis, pricing decisions, and inventory planning.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z
          .enum(["Cash", "Accrual"])
          .optional()
          .describe("Accounting method (default: Accrual)"),
        customerId: z.string().optional().describe("Filter by customer ID"),
        classId: z.string().optional().describe("Filter by class ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
        itemId: z.string().optional().describe("Filter to a specific item/product ID"),
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
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.itemId) params.set("item", args.itemId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.sales_by_product_service_summary",
        () => client.get(`/reports/ItemSales?${params}`),
        { tool: "sales_by_product_service_summary", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── aged_payables ──────────────────────────────────────────────────────────
  server.registerTool(
    "aged_payables",
    {
      title: "Aged Payables Detail Report",
      description:
        "Get an Aged Payables Detail report showing each vendor's individual outstanding bills bucketed by age (0-30, 31-60, 61-90, 90+ days past due). More granular than accounts_payable_aging — shows each individual bill.",
      inputSchema: {
        reportDate: z.string().optional().describe("As-of date (YYYY-MM-DD, default: today)"),
        agingPeriod: z.number().int().optional().describe("Days per aging bucket (default: 30)"),
        numberOfPeriods: z.number().int().optional().describe("Number of aging buckets (default: 4)"),
        vendorId: z.string().optional().describe("Filter to a specific vendor ID"),
        departmentId: z.string().optional().describe("Filter by department/location ID"),
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
      if (args.reportDate) params.set("report_date", args.reportDate as string);
      if (args.agingPeriod) params.set("aging_period", String(args.agingPeriod));
      if (args.numberOfPeriods) params.set("num_periods", String(args.numberOfPeriods));
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.aged_payables",
        () => client.get(`/reports/AgedPayableDetail?${params}`),
        { tool: "aged_payables" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── cash_flow ──────────────────────────────────────────────────────────────
  server.registerTool(
    "cash_flow",
    {
      title: "Cash Flow Statement Report",
      description:
        "Get a Statement of Cash Flows for a date range showing cash inflows and outflows from operating, investing, and financing activities. Essential for cash management, lender reporting, and understanding liquidity.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);

      const result = await logger.time(
        "tool.cash_flow",
        () => client.get(`/reports/CashFlow?${params}`),
        { tool: "cash_flow", startDate: args.startDate, endDate: args.endDate }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
