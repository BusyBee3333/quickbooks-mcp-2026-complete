// Preferences tools: get_preferences, update_preferences
// QBO Preferences entity — company-wide settings (accounting, sales, expenses, etc.)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── get_preferences ────────────────────────────────────────────────────────
  server.registerTool(
    "get_preferences",
    {
      title: "Get QuickBooks Company Preferences",
      description:
        "Get the QuickBooks Online company preferences and settings, including accounting method (Cash/Accrual), fiscal year start, sales form settings (custom fields, default terms, shipping), expense settings, time tracking settings, and product/service settings. Returns the SyncToken needed for updates.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (_args) => {
      const result = await logger.time(
        "tool.get_preferences",
        () => client.get("/preferences"),
        { tool: "get_preferences" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_preferences ─────────────────────────────────────────────────────
  server.registerTool(
    "update_preferences",
    {
      title: "Update QuickBooks Company Preferences",
      description:
        "Update QuickBooks Online company preferences using sparse update (only provided fields are changed). Requires syncToken from get_preferences. Can update accounting method, fiscal year start, time tracking, shipping, custom fields visibility, and more.",
      inputSchema: {
        syncToken: z
          .string()
          .describe("SyncToken from get_preferences (required for optimistic locking)"),
        accountingInfoPrefs: z
          .object({
            firstMonthOfFiscalYear: z
              .string()
              .optional()
              .describe("First month of fiscal year (e.g. 'January', 'July')"),
            taxYearMonth: z
              .string()
              .optional()
              .describe("First month of tax year"),
            customerTerminology: z
              .enum(["Customers", "Clients", "Members", "Donors"])
              .optional()
              .describe("Term used for customers in the UI"),
            bookCloseDate: z
              .string()
              .optional()
              .describe("Books closed date (YYYY-MM-DD)"),
            taxForm: z.string().optional().describe("Tax form (e.g. 'Form1040', 'Form1120')"),
            classTrackingPerTxn: z
              .boolean()
              .optional()
              .describe("Enable class tracking per transaction"),
            classTrackingPerTxnLine: z
              .boolean()
              .optional()
              .describe("Enable class tracking per transaction line"),
            departmentName: z
              .string()
              .optional()
              .describe("Display name for departments (e.g. 'Location', 'Division')"),
          })
          .optional()
          .describe("Accounting information preferences"),
        salesFormsPrefs: z
          .object({
            DefaultTerms: z.string().optional().describe("Default payment terms ID"),
            DefaultShippingTerms: z.string().optional().describe("Default shipping terms"),
            UsingPriceLevels: z.boolean().optional().describe("Enable price levels"),
            UsingProgressInvoicing: z.boolean().optional().describe("Enable progress invoicing"),
            PrintItemizedReceipts: z.boolean().optional().describe("Print itemized receipts"),
          })
          .optional()
          .describe("Sales forms preferences"),
        vendorAndPurchasesPrefs: z
          .object({
            TrackingByCustomer: z
              .boolean()
              .optional()
              .describe("Track expenses by customer"),
            BillableExpenseTracking: z
              .boolean()
              .optional()
              .describe("Enable billable expense tracking"),
            DefaultMarkup: z.number().optional().describe("Default markup percent"),
            DefaultMarkupAccount: z
              .string()
              .optional()
              .describe("Default markup income account ID"),
          })
          .optional()
          .describe("Vendor and purchases preferences"),
        timeTrackingPrefs: z
          .object({
            WorkWeekStartDate: z
              .string()
              .optional()
              .describe("Work week start day (e.g. 'Monday')"),
            MarkTimeEntriesBillable: z
              .boolean()
              .optional()
              .describe("Mark time entries billable by default"),
            BillCustomers: z
              .boolean()
              .optional()
              .describe("Enable billing customers for time"),
            ShowBillRateToAll: z
              .boolean()
              .optional()
              .describe("Show bill rate to all employees"),
            UseServices: z.boolean().optional().describe("Use services for time tracking"),
            BillableExpenseTracking: z.boolean().optional().describe("Billable expense tracking"),
          })
          .optional()
          .describe("Time tracking preferences"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const prefs: Record<string, unknown> = {
        SyncToken: args.syncToken,
        sparse: true,
      };

      const accountingInfoPrefs = args.accountingInfoPrefs as Record<string, unknown> | undefined;
      if (accountingInfoPrefs) {
        const aiPrefs: Record<string, unknown> = {};
        if (accountingInfoPrefs.firstMonthOfFiscalYear !== undefined)
          aiPrefs.FirstMonthOfFiscalYear = accountingInfoPrefs.firstMonthOfFiscalYear;
        if (accountingInfoPrefs.taxYearMonth !== undefined)
          aiPrefs.TaxYearMonth = accountingInfoPrefs.taxYearMonth;
        if (accountingInfoPrefs.customerTerminology !== undefined)
          aiPrefs.CustomerTerminology = accountingInfoPrefs.customerTerminology;
        if (accountingInfoPrefs.bookCloseDate !== undefined)
          aiPrefs.BookCloseDate = accountingInfoPrefs.bookCloseDate;
        if (accountingInfoPrefs.taxForm !== undefined)
          aiPrefs.TaxForm = accountingInfoPrefs.taxForm;
        if (accountingInfoPrefs.classTrackingPerTxn !== undefined)
          aiPrefs.ClassTrackingPerTxn = accountingInfoPrefs.classTrackingPerTxn;
        if (accountingInfoPrefs.classTrackingPerTxnLine !== undefined)
          aiPrefs.ClassTrackingPerTxnLine = accountingInfoPrefs.classTrackingPerTxnLine;
        if (accountingInfoPrefs.departmentName !== undefined)
          aiPrefs.DepartmentName = accountingInfoPrefs.departmentName;
        prefs.AccountingInfoPrefs = aiPrefs;
      }

      const salesFormsPrefs = args.salesFormsPrefs as Record<string, unknown> | undefined;
      if (salesFormsPrefs) prefs.SalesFormsPrefs = salesFormsPrefs;

      const vendorAndPurchasesPrefs = args.vendorAndPurchasesPrefs as Record<string, unknown> | undefined;
      if (vendorAndPurchasesPrefs) prefs.VendorAndPurchasesPrefs = vendorAndPurchasesPrefs;

      const timeTrackingPrefs = args.timeTrackingPrefs as Record<string, unknown> | undefined;
      if (timeTrackingPrefs) prefs.TimeTrackingPrefs = timeTrackingPrefs;

      const result = await logger.time(
        "tool.update_preferences",
        () => client.post("/preferences", prefs),
        { tool: "update_preferences" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
