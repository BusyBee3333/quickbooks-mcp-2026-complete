// Sales Detail Reports: by customer detail, by product detail, by class, by department
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── sales_by_customer_detail ───────────────────────────────────────────────
  server.registerTool(
    "sales_by_customer_detail",
    {
      title: "Sales by Customer Detail Report",
      description:
        "Get a Sales by Customer Detail report showing each individual sales transaction (invoice, sales receipt) per customer for a date range. More granular than sales_by_customer_summary — shows transaction dates and amounts. Use for customer revenue reconciliation.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
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
        "tool.sales_by_customer_detail",
        () => client.get(`/reports/CustomerSalesDetail?${params}`),
        { tool: "sales_by_customer_detail" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── sales_by_product_detail ────────────────────────────────────────────────
  server.registerTool(
    "sales_by_product_detail",
    {
      title: "Sales by Product/Service Detail Report",
      description:
        "Get a Sales by Product/Service Detail report showing each individual line-item sale per product or service. Shows customer, date, quantity, rate, and amount for each sale. Use for product-level revenue analysis and COGS tracking.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        customerId: z.string().optional().describe("Filter by customer ID"),
        itemId: z.string().optional().describe("Filter to a specific product/service item ID"),
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
      if (args.itemId) params.set("item", args.itemId as string);
      if (args.classId) params.set("class", args.classId as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.sales_by_product_detail",
        () => client.get(`/reports/ItemSalesDetail?${params}`),
        { tool: "sales_by_product_detail" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── department_sales_report ────────────────────────────────────────────────
  server.registerTool(
    "department_sales_report",
    {
      title: "Sales by Department Report",
      description:
        "Get a sales report broken down by Department/Location showing income for each department. Use for location-level sales performance, multi-site analysis, and departmental revenue reporting.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        departmentId: z.string().optional().describe("Filter to a specific department/location ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.accountingMethod) params.set("accounting_method", args.accountingMethod as string);
      if (args.departmentId) params.set("department", args.departmentId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.department_sales_report",
        () => client.get(`/reports/DepartmentSales?${params}`),
        { tool: "department_sales_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── class_sales_report ─────────────────────────────────────────────────────
  server.registerTool(
    "class_sales_report",
    {
      title: "Sales by Class Report",
      description:
        "Get a sales report broken down by Class showing income for each class. Use for business-unit-level sales performance, product-line revenue tracking, and class-based commission calculations.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        accountingMethod: z.enum(["Cash", "Accrual"]).optional().describe("Accounting method (default: Accrual)"),
        classId: z.string().optional().describe("Filter to a specific class ID"),
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
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.class_sales_report",
        () => client.get(`/reports/ClassSales?${params}`),
        { tool: "class_sales_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── item_detail_report ─────────────────────────────────────────────────────
  server.registerTool(
    "item_detail_report",
    {
      title: "Item Detail Report",
      description:
        "Get an Item Detail report showing all transactions for a specific product/service item — purchases, sales, inventory adjustments. Provides a complete transaction history per item for audit and reconciliation.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        itemId: z.string().optional().describe("Filter to a specific item ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.itemId) params.set("item", args.itemId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.item_detail_report",
        () => client.get(`/reports/ItemDetail?${params}`),
        { tool: "item_detail_report" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
