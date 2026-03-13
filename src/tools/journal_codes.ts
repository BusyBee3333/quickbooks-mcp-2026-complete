// Journal Code tools: list_journal_codes, get_journal_code, create_journal_code
// Journal codes are required for French-locale QuickBooks companies (QBO France)
// They categorize journal entries by type for regulatory compliance
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_journal_codes ─────────────────────────────────────────────────────
  server.registerTool(
    "list_journal_codes",
    {
      title: "List QuickBooks Journal Codes",
      description:
        "List QuickBooks Online journal codes. Journal codes are required for French-locale (FR) QuickBooks companies for regulatory compliance — they categorize every journal entry by type (e.g. VT = Sales, AC = Purchases, BQ = Bank, OD = Miscellaneous). This feature is only applicable to QBO France accounts. Returns code name, type, and description. Supports pagination.",
      inputSchema: {
        type: z
          .string()
          .optional()
          .describe("Filter by journal code type (e.g. 'Sales', 'Purchase', 'Cash', 'Bank', 'Miscellaneous')"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'Name ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.type) whereParts.push(`Type = '${args.type}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_journal_codes",
        () => client.query("JournalCode", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_journal_codes" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_journal_code ───────────────────────────────────────────────────────
  server.registerTool(
    "get_journal_code",
    {
      title: "Get QuickBooks Journal Code",
      description:
        "Get full details for a QuickBooks journal code by ID. Returns the code name, type, and description. Applicable only to French-locale (FR) QuickBooks companies.",
      inputSchema: {
        journalCodeId: z.string().describe("QuickBooks journal code ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_journal_code",
        () => client.get(`/journalcode/${args.journalCodeId}`),
        { tool: "get_journal_code", journalCodeId: args.journalCodeId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_journal_code ────────────────────────────────────────────────────
  server.registerTool(
    "create_journal_code",
    {
      title: "Create QuickBooks Journal Code",
      description:
        "Create a new QuickBooks journal code (applicable to French-locale QBO companies only). Journal codes classify accounting transactions for French regulatory reporting. Common types: 'Sales' (VT), 'Purchases' (AC), 'Cash' (CA), 'Bank' (BQ), 'Miscellaneous' (OD).",
      inputSchema: {
        name: z.string().describe("Journal code name/abbreviation (e.g. 'VT', 'AC', 'BQ')"),
        type: z
          .enum(["Sales", "Purchases", "Cash", "Bank", "Miscellaneous"])
          .describe("Journal code type"),
        description: z.string().optional().describe("Description of this journal code"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const journalCode: Record<string, unknown> = {
        Name: args.name,
        Type: args.type,
      };
      if (args.description) journalCode.Description = args.description;

      const result = await logger.time(
        "tool.create_journal_code",
        () => client.post("/journalcode", journalCode),
        { tool: "create_journal_code", name: args.name as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_journal_code ────────────────────────────────────────────────────
  server.registerTool(
    "update_journal_code",
    {
      title: "Update QuickBooks Journal Code",
      description:
        "Update an existing QuickBooks journal code. Requires journalCodeId and syncToken (from get_journal_code). Supports sparse update. Applicable to French-locale QBO companies only.",
      inputSchema: {
        journalCodeId: z.string().describe("Journal code ID to update"),
        syncToken: z.string().describe("SyncToken from get_journal_code"),
        name: z.string().optional().describe("New journal code name"),
        description: z.string().optional().describe("New description"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const journalCode: Record<string, unknown> = {
        Id: args.journalCodeId,
        SyncToken: args.syncToken,
        sparse: true,
      };
      if (args.name) journalCode.Name = args.name;
      if (args.description) journalCode.Description = args.description;

      const result = await logger.time(
        "tool.update_journal_code",
        () => client.post("/journalcode", journalCode),
        { tool: "update_journal_code", journalCodeId: args.journalCodeId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
