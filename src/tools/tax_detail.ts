// Tax Detail Reports: tax liability by jurisdiction, tax filing detail, sales tax detail
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── sales_tax_liability_detail ─────────────────────────────────────────────
  server.registerTool(
    "sales_tax_liability_detail",
    {
      title: "Sales Tax Liability Detail Report",
      description:
        "Get a detailed Sales Tax Liability report showing taxable and non-taxable sales, tax collected, and tax owed for each tax agency for a date range. Shows individual tax rates and line-item detail. Use for state/local tax filing, tax remittance, and audit support.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        taxAgencyId: z.string().optional().describe("Filter to a specific tax agency ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.taxAgencyId) params.set("tax_agency", args.taxAgencyId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.sales_tax_liability_detail",
        () => client.get(`/reports/TaxSummary?${params}`),
        { tool: "sales_tax_liability_detail" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── taxable_sales_detail ───────────────────────────────────────────────────
  server.registerTool(
    "taxable_sales_detail",
    {
      title: "Taxable Sales Detail Report",
      description:
        "Get a detailed list of all taxable and non-taxable sales transactions with tax amounts and tax codes applied. Shows customer, date, invoice/receipt number, taxable amount, tax rate, and tax collected per line. Use for tax audit support and tax return preparation.",
      inputSchema: {
        startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
        endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
        taxCodeId: z.string().optional().describe("Filter by tax code ID"),
        customerId: z.string().optional().describe("Filter by customer ID"),
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = new URLSearchParams();
      params.set("start_date", args.startDate as string);
      params.set("end_date", args.endDate as string);
      if (args.taxCodeId) params.set("taxcode", args.taxCodeId as string);
      if (args.customerId) params.set("customer", args.customerId as string);
      if (args.minorVersion) params.set("minorversion", args.minorVersion as string);
      const result = await logger.time(
        "tool.taxable_sales_detail",
        () => client.get(`/reports/TaxableSales?${params}`),
        { tool: "taxable_sales_detail" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── tax_classification_list ────────────────────────────────────────────────
  server.registerTool(
    "tax_classification_list",
    {
      title: "List Tax Classifications",
      description:
        "List all tax classifications defined in QuickBooks. Tax classifications (also called tax categories) are used in some jurisdictions to categorize products and services for proper tax treatment. Returns classification codes and descriptions. Use for tax compliance and proper tax code assignment.",
      inputSchema: {
        country: z.string().optional().describe("Filter by country code (e.g. 'US', 'CA', 'GB', 'AU')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      let where: string | undefined;
      if (args.country) where = `Country = '${args.country}'`;
      const result = await logger.time(
        "tool.tax_classification_list",
        () => client.query("TaxClassification", where, 1, 1000),
        { tool: "tax_classification_list" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── tax_filing_history ─────────────────────────────────────────────────────
  server.registerTool(
    "tax_filing_history",
    {
      title: "Tax Filing History",
      description:
        "Get the tax filing history for the company, showing past tax return filings, their periods, statuses, and amounts. Returns filed tax periods, tax agency, filing date, and remittance amounts. Use to audit tax compliance and track which periods have been filed.",
      inputSchema: {
        taxAgencyId: z.string().optional().describe("Filter to a specific tax agency ID"),
        startDate: z.string().optional().describe("Filter filings from this date (YYYY-MM-DD)"),
        endDate: z.string().optional().describe("Filter filings to this date (YYYY-MM-DD)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const conditions: string[] = [];
      if (args.taxAgencyId) conditions.push(`TaxAgencyRef.value = '${args.taxAgencyId}'`);
      if (args.startDate) conditions.push(`TaxPeriodStartDate >= '${args.startDate}'`);
      if (args.endDate) conditions.push(`TaxPeriodEndDate <= '${args.endDate}'`);
      const where = conditions.length ? conditions.join(" AND ") : undefined;
      const result = await logger.time(
        "tool.tax_filing_history",
        () => client.query("TaxService", where, 1, 100),
        { tool: "tax_filing_history" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
