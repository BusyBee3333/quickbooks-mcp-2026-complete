// Purchase Reports: by vendor summary/detail, by product summary/detail
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── purchase_by_vendor_summary ─────────────────────────────────────────────
  server.registerTool(
    "purchase_by_vendor_summary",
    {
      title: "Purchase by Vendor Summary Report",
      description:
        "Get a Purchase by Vendor Summary report showing total purchases per vendor for a date range. Includes total cost broken down by expense account. Use for spend analysis, vendor consolidation, and procurement reviews.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        vendorId: z.string().optional().describe("Filter to a specific vendor ID"),
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
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.purchase_by_vendor_summary",
        () => client.get(`/reports/PurchasesByVendor?${params}`),
        { tool: "purchase_by_vendor_summary" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── purchase_by_vendor_detail ──────────────────────────────────────────────
  server.registerTool(
    "purchase_by_vendor_detail",
    {
      title: "Purchase by Vendor Detail Report",
      description:
        "Get a Purchase by Vendor Detail report showing each individual purchase transaction per vendor. Shows bill/check/credit card charge details including date, account, memo, and amount. Use for vendor invoice audit and expense categorization review.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        vendorId: z.string().optional().describe("Filter to a specific vendor ID"),
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
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.purchase_by_vendor_detail",
        () => client.get(`/reports/PurchasesByVendorDetail?${params}`),
        { tool: "purchase_by_vendor_detail" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── purchase_by_product_summary ────────────────────────────────────────────
  server.registerTool(
    "purchase_by_product_summary",
    {
      title: "Purchase by Product/Service Summary Report",
      description:
        "Get a Purchase by Product/Service Summary report showing total quantities purchased and total cost per inventory item or service. Use for procurement analysis, supplier negotiations, and inventory cost tracking.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        itemId: z.string().optional().describe("Filter to a specific product/service item ID"),
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
      if (args.itemId) params.set("item", args.itemId as string);
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.purchase_by_product_summary",
        () => client.get(`/reports/PurchasesByProduct?${params}`),
        { tool: "purchase_by_product_summary" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── purchase_by_product_detail ─────────────────────────────────────────────
  server.registerTool(
    "purchase_by_product_detail",
    {
      title: "Purchase by Product/Service Detail Report",
      description:
        "Get a Purchase by Product/Service Detail report showing each individual purchase line item per product. Shows vendor, date, quantity, unit cost, and total for each purchase. Use for COGS reconciliation and inventory cost audit.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        itemId: z.string().optional().describe("Filter to a specific product/service item ID"),
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
      if (args.itemId) params.set("item", args.itemId as string);
      if (args.vendorId) params.set("vendor", args.vendorId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.purchase_by_product_detail",
        () => client.get(`/reports/PurchasesByProductDetail?${params}`),
        { tool: "purchase_by_product_detail" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── expenses_by_vendor_detail ──────────────────────────────────────────────
  server.registerTool(
    "expenses_by_vendor_detail",
    {
      title: "Expenses by Vendor Detail Report",
      description:
        "Get a detailed Expenses by Vendor report breaking down all expenses per vendor with individual transaction detail. Covers bills, checks, credit card charges, and cash expenses. Use for vendor spend reconciliation and 1099 preparation.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
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
        "tool.expenses_by_vendor_detail",
        () => client.get(`/reports/ExpensesByVendorSummary?${params}`),
        { tool: "expenses_by_vendor_detail" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
