// Items tools: list_items, get_item, create_item, update_item, delete_item
// Items are products and services in the QuickBooks catalog
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_items ──────────────────────────────────────────────────────────────
  server.registerTool(
    "list_items",
    {
      title: "List QuickBooks Items (Products & Services)",
      description:
        "List QuickBooks Online items (products and services catalog). Returns name, type, price, and account assignments. Supports filtering by type (Inventory, NonInventory, Service) and pagination.",
      inputSchema: {
        type: z
          .enum(["Inventory", "NonInventory", "Service", "Category"])
          .optional()
          .describe("Filter by item type (Inventory, NonInventory, Service, Category)"),
        active: z
          .boolean()
          .optional()
          .describe("Filter by active status (default: all)"),
        where: z
          .string()
          .optional()
          .describe("Additional QBO WHERE clause (e.g. \"Name LIKE 'Widget%'\")"),
        startPosition: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Pagination offset — 1-indexed (default 1)"),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe("Max results to return (default 100, max 1000)"),
        orderBy: z
          .string()
          .optional()
          .describe("Sort field (e.g. 'Name ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.type) whereParts.push(`Type = '${args.type}'`);
      if (args.active !== undefined) whereParts.push(`Active = ${args.active}`);
      if (args.where) whereParts.push(args.where as string);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_items",
        () => client.query(
          "Item",
          where,
          args.startPosition ?? 1,
          args.maxResults ?? 100,
          args.orderBy as string | undefined
        ),
        { tool: "list_items" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_item ────────────────────────────────────────────────────────────────
  server.registerTool(
    "get_item",
    {
      title: "Get QuickBooks Item",
      description:
        "Get full details for a QuickBooks item (product or service) by ID. Returns type, unit price, income account, expense account, quantity on hand, and purchase cost.",
      inputSchema: {
        itemId: z.string().describe("QuickBooks item ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_item",
        () => client.get(`/item/${args.itemId}`),
        { tool: "get_item", itemId: args.itemId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_item ─────────────────────────────────────────────────────────────
  server.registerTool(
    "create_item",
    {
      title: "Create QuickBooks Item",
      description:
        "Create a new product or service item in the QuickBooks catalog. Required: name and type. Service items need incomeAccountId. Inventory items also need assetAccountId, expenseAccountId, and invStartDate.",
      inputSchema: {
        name: z.string().describe("Item name"),
        type: z
          .enum(["Inventory", "NonInventory", "Service"])
          .describe("Item type: Service (labor/services), NonInventory (non-tracked goods), Inventory (tracked stock)"),
        incomeAccountId: z.string().optional().describe("Income account ID for sales (required for most types)"),
        expenseAccountId: z.string().optional().describe("Expense/COGS account ID (required for Inventory)"),
        assetAccountId: z.string().optional().describe("Asset account ID for inventory (required for Inventory type)"),
        description: z.string().optional().describe("Sales description"),
        purchaseDescription: z.string().optional().describe("Purchase description"),
        unitPrice: z.number().optional().describe("Sales price / rate"),
        purchaseCost: z.number().optional().describe("Purchase cost"),
        sku: z.string().optional().describe("SKU / item code"),
        taxable: z.boolean().optional().describe("Whether item is taxable"),
        invStartDate: z.string().optional().describe("Inventory start date (YYYY-MM-DD, required for Inventory)"),
        qtyOnHand: z.number().optional().describe("Starting quantity on hand (for Inventory)"),
        trackQtyOnHand: z.boolean().optional().describe("Whether to track quantity (Inventory only)"),
        subItemOf: z.string().optional().describe("Parent item ID if this is a sub-item"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const item: Record<string, unknown> = {
        Name: args.name,
        Type: args.type,
      };

      if (args.description) item.Description = args.description;
      if (args.purchaseDescription) item.PurchaseDesc = args.purchaseDescription;
      if (args.unitPrice !== undefined) item.UnitPrice = args.unitPrice;
      if (args.purchaseCost !== undefined) item.PurchaseCost = args.purchaseCost;
      if (args.sku) item.Sku = args.sku;
      if (args.taxable !== undefined) item.Taxable = args.taxable;
      if (args.subItemOf) item.SubItem = true, item.ParentRef = { value: args.subItemOf };
      if (args.incomeAccountId) item.IncomeAccountRef = { value: args.incomeAccountId };
      if (args.expenseAccountId) item.ExpenseAccountRef = { value: args.expenseAccountId };
      if (args.assetAccountId) item.AssetAccountRef = { value: args.assetAccountId };

      if (args.type === "Inventory") {
        if (args.trackQtyOnHand !== undefined) item.TrackQtyOnHand = args.trackQtyOnHand;
        else item.TrackQtyOnHand = true;
        if (args.qtyOnHand !== undefined) item.QtyOnHand = args.qtyOnHand;
        if (args.invStartDate) item.InvStartDate = args.invStartDate;
      }

      const result = await logger.time(
        "tool.create_item",
        () => client.post("/item", item),
        { tool: "create_item" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_item ─────────────────────────────────────────────────────────────
  server.registerTool(
    "update_item",
    {
      title: "Update QuickBooks Item",
      description:
        "Update an existing QuickBooks item (product or service). Requires itemId and syncToken (from get_item). Only provided fields are updated (sparse update).",
      inputSchema: {
        itemId: z.string().describe("Item ID (from list_items or get_item)"),
        syncToken: z.string().describe("SyncToken from get_item (required for optimistic locking)"),
        name: z.string().optional().describe("New item name"),
        description: z.string().optional().describe("New sales description"),
        purchaseDescription: z.string().optional().describe("New purchase description"),
        unitPrice: z.number().optional().describe("New sales price / rate"),
        purchaseCost: z.number().optional().describe("New purchase cost"),
        sku: z.string().optional().describe("New SKU / item code"),
        active: z.boolean().optional().describe("Set to false to deactivate item"),
        taxable: z.boolean().optional().describe("Whether item is taxable"),
        incomeAccountId: z.string().optional().describe("New income account ID"),
        expenseAccountId: z.string().optional().describe("New expense account ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const item: Record<string, unknown> = {
        Id: args.itemId,
        SyncToken: args.syncToken,
        sparse: true,
      };

      if (args.name) item.Name = args.name;
      if (args.description) item.Description = args.description;
      if (args.purchaseDescription) item.PurchaseDesc = args.purchaseDescription;
      if (args.unitPrice !== undefined) item.UnitPrice = args.unitPrice;
      if (args.purchaseCost !== undefined) item.PurchaseCost = args.purchaseCost;
      if (args.sku) item.Sku = args.sku;
      if (args.active !== undefined) item.Active = args.active;
      if (args.taxable !== undefined) item.Taxable = args.taxable;
      if (args.incomeAccountId) item.IncomeAccountRef = { value: args.incomeAccountId };
      if (args.expenseAccountId) item.ExpenseAccountRef = { value: args.expenseAccountId };

      const result = await logger.time(
        "tool.update_item",
        () => client.post("/item", item),
        { tool: "update_item", itemId: args.itemId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── delete_item ─────────────────────────────────────────────────────────────
  server.registerTool(
    "delete_item",
    {
      title: "Delete (Deactivate) QuickBooks Item",
      description:
        "Deactivate (soft-delete) a QuickBooks item. In QBO items cannot be permanently deleted if they have transactions — this sets Active = false. Requires itemId and syncToken.",
      inputSchema: {
        itemId: z.string().describe("Item ID to deactivate"),
        syncToken: z.string().describe("SyncToken from get_item (required for optimistic locking)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async (args) => {
      // QBO items don't support hard-delete via the API; we deactivate (sparse update Active=false)
      const item: Record<string, unknown> = {
        Id: args.itemId,
        SyncToken: args.syncToken,
        sparse: true,
        Active: false,
      };

      const result = await logger.time(
        "tool.delete_item",
        () => client.post("/item", item),
        { tool: "delete_item", itemId: args.itemId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
