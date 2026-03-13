// Tax Agency tools: list_tax_agencies, get_tax_agency
// Tax agencies are government entities that collect taxes (e.g. IRS, state tax boards)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_tax_agencies ──────────────────────────────────────────────────────
  server.registerTool(
    "list_tax_agencies",
    {
      title: "List QuickBooks Tax Agencies",
      description:
        "List QuickBooks Online tax agencies — the government entities you remit taxes to (e.g. IRS, California Board of Equalization, state revenue departments). Tax agencies are linked to tax rates and track your tax liability accounts. Returns agency name, tax tracking type, and associated liability/asset accounts. Supports pagination.",
      inputSchema: {
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'DisplayName ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.list_tax_agencies",
        () => client.query("TaxAgency", undefined, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_tax_agencies" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_tax_agency ─────────────────────────────────────────────────────────
  server.registerTool(
    "get_tax_agency",
    {
      title: "Get QuickBooks Tax Agency",
      description:
        "Get full details for a QuickBooks tax agency by ID, including the agency name, tax tracking type (TaxVendor, TaxPayable, or NonTaxable), and links to the associated tax liability and tax payable accounts.",
      inputSchema: {
        taxAgencyId: z.string().describe("QuickBooks tax agency ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_tax_agency",
        () => client.get(`/taxagency/${args.taxAgencyId}`),
        { tool: "get_tax_agency", taxAgencyId: args.taxAgencyId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_tax_agency ──────────────────────────────────────────────────────
  server.registerTool(
    "create_tax_agency",
    {
      title: "Create QuickBooks Tax Agency",
      description:
        "Create a new QuickBooks tax agency. Tax agencies represent government bodies you collect and remit taxes to. After creating an agency, you can create tax rates linked to it and build tax codes from those rates.",
      inputSchema: {
        displayName: z.string().describe("Tax agency name (e.g. 'California Board of Equalization')"),
        taxTrackedOnPurchases: z.boolean().optional().describe("Track taxes on purchases (for recoverable taxes)"),
        taxTrackedOnSales: z.boolean().optional().describe("Track taxes on sales"),
        taxRegistrationNumber: z.string().optional().describe("Your tax registration/ID number with this agency"),
        lastFileDate: z.string().optional().describe("Last tax filing date (YYYY-MM-DD)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const agency: Record<string, unknown> = {
        DisplayName: args.displayName,
      };

      if (args.taxTrackedOnPurchases !== undefined) agency.TaxTrackedOnPurchases = args.taxTrackedOnPurchases;
      if (args.taxTrackedOnSales !== undefined) agency.TaxTrackedOnSales = args.taxTrackedOnSales;
      if (args.taxRegistrationNumber) agency.TaxRegistrationNumber = args.taxRegistrationNumber;
      if (args.lastFileDate) agency.LastFileDate = args.lastFileDate;

      const result = await logger.time(
        "tool.create_tax_agency",
        () => client.post("/taxagency", agency),
        { tool: "create_tax_agency", displayName: args.displayName as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
