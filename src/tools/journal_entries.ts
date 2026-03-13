// Journal Entries tools: list_journal_entries, get_journal_entry, create_journal_entry
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

const JournalLineSchema = z.object({
  postingType: z.enum(["Debit", "Credit"]).describe("Whether this line is a Debit or Credit"),
  amount: z.number().describe("Amount for this journal line"),
  accountId: z.string().describe("Account ID (from list_accounts)"),
  description: z.string().optional().describe("Line description / memo"),
  entityRef: z.string().optional().describe("Customer or vendor entity ID (for sub-ledger posting)"),
  entityType: z.enum(["Customer", "Vendor", "Employee"]).optional().describe("Type of entity (Customer/Vendor/Employee)"),
  classId: z.string().optional().describe("Class ID for classification"),
  departmentId: z.string().optional().describe("Department/location ID"),
});

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_journal_entries ───────────────────────────────────────────────────
  server.registerTool(
    "list_journal_entries",
    {
      title: "List QuickBooks Journal Entries",
      description:
        "List QuickBooks Online journal entries with optional filters by date or document number. Returns journal entry ID, date, total, and doc number. Supports startPosition/maxResults pagination.",
      inputSchema: {
        docNumber: z.string().optional().describe("Filter by journal entry number"),
        txnDateAfter: z.string().optional().describe("Filter after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter before date (YYYY-MM-DD)"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'TxnDate DESC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.docNumber) whereParts.push(`DocNumber = '${args.docNumber}'`);
      if (args.txnDateAfter) whereParts.push(`TxnDate >= '${args.txnDateAfter}'`);
      if (args.txnDateBefore) whereParts.push(`TxnDate <= '${args.txnDateBefore}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_journal_entries",
        () => client.query("JournalEntry", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_journal_entries" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_journal_entry ──────────────────────────────────────────────────────
  server.registerTool(
    "get_journal_entry",
    {
      title: "Get QuickBooks Journal Entry",
      description:
        "Get full details for a specific QuickBooks journal entry by ID, including all debit/credit lines, accounts, amounts, and SyncToken.",
      inputSchema: {
        journalEntryId: z.string().describe("QuickBooks journal entry ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_journal_entry",
        () => client.get(`/journalentry/${args.journalEntryId}`),
        { tool: "get_journal_entry", journalEntryId: args.journalEntryId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_journal_entry ───────────────────────────────────────────────────
  server.registerTool(
    "create_journal_entry",
    {
      title: "Create QuickBooks Journal Entry",
      description:
        "Create a new QuickBooks Online journal entry. Requires balanced debit and credit lines (total debits must equal total credits). Each line requires an account, amount, and posting type (Debit/Credit).",
      inputSchema: {
        lines: z.array(JournalLineSchema).min(2).describe("Journal lines (must balance: sum of debits = sum of credits)"),
        txnDate: z.string().optional().describe("Transaction date (YYYY-MM-DD, default: today)"),
        docNumber: z.string().optional().describe("Journal entry number"),
        privateNote: z.string().optional().describe("Internal memo/note"),
        adjustmentEntry: z.boolean().optional().describe("Whether this is an adjusting entry"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const lines = (args.lines as Array<{
        postingType: "Debit" | "Credit";
        amount: number;
        accountId: string;
        description?: string;
        entityRef?: string;
        entityType?: string;
        classId?: string;
        departmentId?: string;
      }>).map((line) => {
        const jeLine: Record<string, unknown> = {
          Amount: line.amount,
          DetailType: "JournalEntryLineDetail",
          JournalEntryLineDetail: {
            PostingType: line.postingType,
            AccountRef: { value: line.accountId },
            ...(line.entityRef && line.entityType ? {
              Entity: {
                Type: line.entityType,
                EntityRef: { value: line.entityRef },
              },
            } : {}),
            ...(line.classId ? { ClassRef: { value: line.classId } } : {}),
            ...(line.departmentId ? { DepartmentRef: { value: line.departmentId } } : {}),
          },
        };
        if (line.description) jeLine.Description = line.description;
        return jeLine;
      });

      const entry: Record<string, unknown> = { Line: lines };
      if (args.txnDate) entry.TxnDate = args.txnDate;
      if (args.docNumber) entry.DocNumber = args.docNumber;
      if (args.privateNote) entry.PrivateNote = args.privateNote;
      if (args.adjustmentEntry) entry.Adjustment = args.adjustmentEntry;

      const result = await logger.time(
        "tool.create_journal_entry",
        () => client.post("/journalentry", entry),
        { tool: "create_journal_entry" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
