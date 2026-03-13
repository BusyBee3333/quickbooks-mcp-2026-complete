// Account Operations tools: create_account, update_account, get_account_reconciliation
// Extended account management beyond the basic list/get in accounts.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── create_account ─────────────────────────────────────────────────────────
  server.registerTool(
    "create_account",
    {
      title: "Create QuickBooks Account",
      description:
        "Create a new account in the QuickBooks chart of accounts. Required: name and accountType. AccountType must be one of the supported QuickBooks account types (Bank, Accounts Receivable, Other Current Asset, Fixed Asset, Other Asset, Accounts Payable, Credit Card, Other Current Liability, Long Term Liability, Equity, Income, Cost of Goods Sold, Expense, Other Income, Other Expense). The account number is optional but recommended for organized financial reporting.",
      inputSchema: {
        name: z.string().describe("Account name (must be unique in chart of accounts)"),
        accountType: z
          .enum([
            "Bank",
            "Accounts Receivable",
            "Other Current Asset",
            "Fixed Asset",
            "Other Asset",
            "Accounts Payable",
            "Credit Card",
            "Other Current Liability",
            "Long Term Liability",
            "Equity",
            "Income",
            "Cost of Goods Sold",
            "Expense",
            "Other Income",
            "Other Expense",
          ])
          .describe("QuickBooks account type"),
        accountSubType: z.string().optional().describe("Account sub-type (further classifies the account, e.g. 'Checking', 'Savings', 'Automobile')"),
        accountNumber: z.string().optional().describe("Account number in your chart of accounts (e.g. '1000', '4000')"),
        description: z.string().optional().describe("Account description"),
        currencyCode: z.string().optional().describe("Currency code for foreign currency accounts (e.g. 'EUR')"),
        parentAccountId: z.string().optional().describe("Parent account ID for sub-accounts"),
        taxCodeId: z.string().optional().describe("Default tax code ID for this account"),
        active: z.boolean().optional().describe("Whether the account is active (default: true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const account: Record<string, unknown> = {
        Name: args.name,
        AccountType: args.accountType,
      };

      if (args.accountSubType) account.AccountSubType = args.accountSubType;
      if (args.accountNumber) account.AcctNum = args.accountNumber;
      if (args.description) account.Description = args.description;
      if (args.currencyCode) account.CurrencyRef = { value: args.currencyCode };
      if (args.parentAccountId) account.ParentRef = { value: args.parentAccountId };
      if (args.taxCodeId) account.TaxCodeRef = { value: args.taxCodeId };
      if (args.active !== undefined) account.Active = args.active;

      const result = await logger.time(
        "tool.create_account",
        () => client.post("/account", account),
        { tool: "create_account", name: args.name as string, accountType: args.accountType as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_account ─────────────────────────────────────────────────────────
  server.registerTool(
    "update_account",
    {
      title: "Update QuickBooks Account",
      description:
        "Update an existing QuickBooks chart of accounts entry. Requires accountId and syncToken (from get_account). Supports sparse update — only provided fields are changed. Common uses: renaming accounts, adding account numbers, adding descriptions, deactivating unused accounts.",
      inputSchema: {
        accountId: z.string().describe("Account ID to update"),
        syncToken: z.string().describe("SyncToken from get_account (required for optimistic locking)"),
        name: z.string().optional().describe("New account name"),
        accountNumber: z.string().optional().describe("New account number"),
        description: z.string().optional().describe("New description"),
        active: z.boolean().optional().describe("Set to false to deactivate account"),
        parentAccountId: z.string().optional().describe("New parent account ID (to move to sub-account)"),
        taxCodeId: z.string().optional().describe("New default tax code"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const account: Record<string, unknown> = {
        Id: args.accountId,
        SyncToken: args.syncToken,
        sparse: true,
      };

      if (args.name) account.Name = args.name;
      if (args.accountNumber) account.AcctNum = args.accountNumber;
      if (args.description) account.Description = args.description;
      if (args.active !== undefined) account.Active = args.active;
      if (args.parentAccountId) account.ParentRef = { value: args.parentAccountId };
      if (args.taxCodeId) account.TaxCodeRef = { value: args.taxCodeId };

      const result = await logger.time(
        "tool.update_account",
        () => client.post("/account", account),
        { tool: "update_account", accountId: args.accountId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── list_inactive_accounts ─────────────────────────────────────────────────
  server.registerTool(
    "list_inactive_accounts",
    {
      title: "List Inactive QuickBooks Accounts",
      description:
        "List all inactive (deactivated) accounts in the QuickBooks chart of accounts. Use to review accounts that have been deactivated, verify they shouldn't be reactivated, or clean up the account list. Returns account name, type, and balance at time of deactivation.",
      inputSchema: {
        accountType: z
          .string()
          .optional()
          .describe("Filter by account type (e.g. 'Bank', 'Income', 'Expense')"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'Name ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = ["Active = false"];
      if (args.accountType) whereParts.push(`AccountType = '${args.accountType}'`);
      const where = whereParts.join(" AND ");

      const result = await logger.time(
        "tool.list_inactive_accounts",
        () => client.query("Account", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_inactive_accounts" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── list_bank_accounts ─────────────────────────────────────────────────────
  server.registerTool(
    "list_bank_accounts",
    {
      title: "List QuickBooks Bank Accounts",
      description:
        "List all bank accounts in QuickBooks (accounts of type 'Bank'). Returns account name, number, current balance, and active status. Use to find available bank accounts for creating transactions, viewing bank balances, or configuring bank feeds.",
      inputSchema: {
        active: z.boolean().optional().describe("Filter by active status (default: active only)"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'Name ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = ["AccountType = 'Bank'"];
      if (args.active !== undefined) {
        whereParts.push(`Active = ${args.active}`);
      } else {
        whereParts.push("Active = true");
      }
      const where = whereParts.join(" AND ");

      const result = await logger.time(
        "tool.list_bank_accounts",
        () => client.query("Account", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_bank_accounts" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── list_credit_card_accounts ──────────────────────────────────────────────
  server.registerTool(
    "list_credit_card_accounts",
    {
      title: "List QuickBooks Credit Card Accounts",
      description:
        "List all credit card accounts in QuickBooks (accounts of type 'Credit Card'). Returns account name, number, current balance (as a liability), and active status. Use to find credit card accounts for expense tracking, payment recording, and reconciliation.",
      inputSchema: {
        active: z.boolean().optional().describe("Filter by active status (default: active only)"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'Name ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = ["AccountType = 'Credit Card'"];
      if (args.active !== undefined) {
        whereParts.push(`Active = ${args.active}`);
      } else {
        whereParts.push("Active = true");
      }
      const where = whereParts.join(" AND ");

      const result = await logger.time(
        "tool.list_credit_card_accounts",
        () => client.query("Account", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_credit_card_accounts" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
