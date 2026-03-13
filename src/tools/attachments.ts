// Attachments tools: list_attachments, upload_attachment, get_attachment, delete_attachment
// QBO Attachable entity — links files/notes to transactions and entities
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_attachments ───────────────────────────────────────────────────────
  server.registerTool(
    "list_attachments",
    {
      title: "List QuickBooks Attachments",
      description:
        "List QuickBooks Online attachments (Attachable entities). Can filter by entity type and ID to find files/notes attached to a specific transaction or customer/vendor. Returns attachment ID, file name, content type, size, and linked entity info.",
      inputSchema: {
        entityType: z
          .string()
          .optional()
          .describe(
            "Filter by entity type (e.g. 'Invoice', 'Bill', 'Customer', 'Vendor', 'Expense')"
          ),
        entityId: z
          .string()
          .optional()
          .describe("Filter by entity ID (use with entityType)"),
        startPosition: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe("Max results (default 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      // Attachable query filtering is done via AttachableRef
      // For entity-scoped queries we use a WHERE clause
      let where: string | undefined;
      if (args.entityType && args.entityId) {
        where = `AttachableRef.EntityRef.Type = '${args.entityType}' AND AttachableRef.EntityRef.value = '${args.entityId}'`;
      } else if (args.entityType) {
        where = `AttachableRef.EntityRef.Type = '${args.entityType}'`;
      }

      const result = await logger.time(
        "tool.list_attachments",
        () =>
          client.query(
            "Attachable",
            where,
            args.startPosition ?? 1,
            args.maxResults ?? 100
          ),
        { tool: "list_attachments" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── upload_attachment ──────────────────────────────────────────────────────
  server.registerTool(
    "upload_attachment",
    {
      title: "Upload QuickBooks Attachment",
      description:
        "Create an Attachable (note or file link) in QuickBooks and optionally associate it with a transaction or entity. For file uploads, QBO requires a multipart POST to /upload — this tool creates the Attachable metadata record. Provide fileName and contentType for file references, or just a note for text notes.",
      inputSchema: {
        fileName: z
          .string()
          .optional()
          .describe("File name for the attachment (e.g. 'invoice_scan.pdf')"),
        contentType: z
          .string()
          .optional()
          .describe("MIME content type (e.g. 'application/pdf', 'image/jpeg')"),
        note: z
          .string()
          .optional()
          .describe("Text note to attach (can be used alone without a file)"),
        entityType: z
          .string()
          .optional()
          .describe(
            "Entity type to link to (e.g. 'Invoice', 'Bill', 'Customer', 'Vendor')"
          ),
        entityId: z
          .string()
          .optional()
          .describe("Entity ID to link the attachment to"),
        category: z
          .string()
          .optional()
          .describe("Attachment category (e.g. 'Image', 'Document', 'Spreadsheet')"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const attachable: Record<string, unknown> = {};

      if (args.fileName) attachable.FileName = args.fileName;
      if (args.contentType) attachable.ContentType = args.contentType;
      if (args.note) attachable.Note = args.note;
      if (args.category) attachable.Category = args.category;

      if (args.entityType && args.entityId) {
        attachable.AttachableRef = [
          {
            EntityRef: {
              type: args.entityType,
              value: args.entityId,
            },
          },
        ];
      }

      const result = await logger.time(
        "tool.upload_attachment",
        () => client.post("/attachable", attachable),
        { tool: "upload_attachment" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_attachment ─────────────────────────────────────────────────────────
  server.registerTool(
    "get_attachment",
    {
      title: "Get QuickBooks Attachment",
      description:
        "Get full details for a specific QuickBooks attachment (Attachable) by ID, including file name, content type, size, download URL, and all linked entities.",
      inputSchema: {
        attachableId: z.string().describe("QuickBooks attachable/attachment ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_attachment",
        () => client.get(`/attachable/${args.attachableId}`),
        { tool: "get_attachment", attachableId: args.attachableId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── delete_attachment ──────────────────────────────────────────────────────
  server.registerTool(
    "delete_attachment",
    {
      title: "Delete QuickBooks Attachment",
      description:
        "Permanently delete a QuickBooks attachment (Attachable) by ID. Requires attachableId and syncToken (from get_attachment). This action cannot be undone.",
      inputSchema: {
        attachableId: z.string().describe("Attachable ID to delete"),
        syncToken: z
          .string()
          .describe("SyncToken from get_attachment (required for optimistic locking)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async (args) => {
      const result = await logger.time(
        "tool.delete_attachment",
        () =>
          client.post("/attachable?operation=delete", {
            Id: args.attachableId,
            SyncToken: args.syncToken,
          }),
        { tool: "delete_attachment", attachableId: args.attachableId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
