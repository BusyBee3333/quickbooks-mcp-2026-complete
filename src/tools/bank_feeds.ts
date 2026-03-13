// Bank Feeds tools: bank transactions, feeds status, categorization
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_bank_transactions ─────────────────────────────────────────────────
  server.registerTool(
    "list_bank_transactions",
    {
      title: "List Bank Feed Transactions",
      description:
        "List bank feed transactions imported from connected bank accounts or credit cards. Returns imported transactions pending categorization or already matched/categorized. Includes transaction date, amount, description, and match status. Use for bank reconciliation and expense categorization workflows.",
      inputSchema: {
        where: z.string().optional().describe("QBO query WHERE clause (e.g. \"AccountId = '123' AND TxnDate >= '2024-01-01'\")"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default: 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default: 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.list_bank_transactions",
        () => client.query("BankTransaction", args.where as string | undefined, args.startPosition ?? 1, args.maxResults ?? 100),
        { tool: "list_bank_transactions" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── get_bank_transaction ───────────────────────────────────────────────────
  server.registerTool(
    "get_bank_transaction",
    {
      title: "Get Bank Feed Transaction",
      description:
        "Get a specific bank feed transaction by ID. Returns full transaction details including bank-provided description, amount, date, account link, and any existing QuickBooks match. Use to inspect a specific imported bank transaction.",
      inputSchema: {
        transactionId: z.string().describe("Bank transaction ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_bank_transaction",
        () => client.get(`/banktransaction/${args.transactionId}`),
        { tool: "get_bank_transaction", transactionId: args.transactionId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── list_bank_rules ────────────────────────────────────────────────────────
  server.registerTool(
    "list_bank_rules",
    {
      title: "List Bank Rules",
      description:
        "List bank rules configured for automatic transaction categorization. Bank rules automatically match and categorize incoming bank feed transactions based on payee name, amount, or description patterns. Returns rule name, conditions, and resulting categorization action.",
      inputSchema: {
        where: z.string().optional().describe("QBO query WHERE clause to filter rules"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default: 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default: 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.list_bank_rules",
        () => client.query("BankTransactionClassificationRule", args.where as string | undefined, args.startPosition ?? 1, args.maxResults ?? 100),
        { tool: "list_bank_rules" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── get_bank_rule ──────────────────────────────────────────────────────────
  server.registerTool(
    "get_bank_rule",
    {
      title: "Get Bank Rule",
      description:
        "Get full details for a specific bank rule by ID. Returns the rule's matching conditions (payee contains, amount is, description contains), categorization settings (account, class, payee, memo), and whether it's set to auto-add or auto-match.",
      inputSchema: {
        ruleId: z.string().describe("Bank rule ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_bank_rule",
        () => client.get(`/banktransactionclassificationrule/${args.ruleId}`),
        { tool: "get_bank_rule", ruleId: args.ruleId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
