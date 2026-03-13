// Unit of Measure tools: list_unit_of_measure_sets, get_unit_of_measure_set, create_unit_of_measure_set
// Unit of Measure (UOM) sets define measurement units for items (e.g. "each", "case of 12", "lb")
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

const UOMUnitSchema = z.object({
  name: z.string().describe("Unit name (e.g. 'Each', 'Dozen', 'Case')"),
  abbreviation: z.string().optional().describe("Short abbreviation (e.g. 'ea', 'dz', 'cs')"),
  conversionRatio: z.number().describe("Conversion ratio relative to the base unit (base unit = 1.0)"),
});

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_unit_of_measure_sets ──────────────────────────────────────────────
  server.registerTool(
    "list_unit_of_measure_sets",
    {
      title: "List QuickBooks Unit of Measure Sets",
      description:
        "List QuickBooks Online Unit of Measure (UOM) sets. UOM sets group related measurement units for buying and selling items in different quantities (e.g. a 'Beverage' set might include: Each=1, 6-Pack=6, Case=24). Used to sell the same inventory item in multiple unit quantities. Requires Advanced Inventory or QuickBooks Enterprise. Returns set name, base unit, and all units in the set.",
      inputSchema: {
        active: z.boolean().optional().describe("Filter by active status"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'Name ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.active !== undefined) whereParts.push(`Active = ${args.active}`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_unit_of_measure_sets",
        () => client.query("UOMSet", where, args.startPosition ?? 1, args.maxResults ?? 100, args.orderBy as string | undefined),
        { tool: "list_unit_of_measure_sets" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_unit_of_measure_set ────────────────────────────────────────────────
  server.registerTool(
    "get_unit_of_measure_set",
    {
      title: "Get QuickBooks Unit of Measure Set",
      description:
        "Get full details for a QuickBooks Unit of Measure set by ID, including all measurement units in the set with their conversion ratios relative to the base unit.",
      inputSchema: {
        uomSetId: z.string().describe("QuickBooks UOM set ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_unit_of_measure_set",
        () => client.get(`/uomset/${args.uomSetId}`),
        { tool: "get_unit_of_measure_set", uomSetId: args.uomSetId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_unit_of_measure_set ─────────────────────────────────────────────
  server.registerTool(
    "create_unit_of_measure_set",
    {
      title: "Create QuickBooks Unit of Measure Set",
      description:
        "Create a new QuickBooks Unit of Measure set. Define a base unit (conversionRatio=1) and additional units with their conversion ratios. Example: 'Beverage' set — BaseUnit='Each' (ratio=1), 6-Pack (ratio=6), Case (ratio=24). Items assigned to this set can be bought/sold in any of these units.",
      inputSchema: {
        name: z.string().describe("UOM set name (e.g. 'Weight', 'Volume', 'Beverage Sizes')"),
        baseUnitName: z.string().describe("Name of the base unit (the unit with ratio 1.0, e.g. 'Each', 'Pound', 'Gallon')"),
        baseUnitAbbreviation: z.string().optional().describe("Abbreviation for base unit (e.g. 'ea', 'lb', 'gal')"),
        units: z
          .array(UOMUnitSchema)
          .optional()
          .describe("Additional units beyond the base unit with their conversion ratios"),
        active: z.boolean().optional().describe("Whether the UOM set is active (default: true)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const uomUnits = [
        {
          Name: args.baseUnitName,
          ...(args.baseUnitAbbreviation ? { Abbreviation: args.baseUnitAbbreviation } : {}),
          ConversionRatio: 1,
          BaseUnit: true,
        },
        ...((args.units as Array<{ name: string; abbreviation?: string; conversionRatio: number }> | undefined) ?? []).map((u) => ({
          Name: u.name,
          ...(u.abbreviation ? { Abbreviation: u.abbreviation } : {}),
          ConversionRatio: u.conversionRatio,
          BaseUnit: false,
        })),
      ];

      const uomSet: Record<string, unknown> = {
        Name: args.name,
        UOMOfMeasureList: uomUnits,
      };
      if (args.active !== undefined) uomSet.Active = args.active;

      const result = await logger.time(
        "tool.create_unit_of_measure_set",
        () => client.post("/uomset", uomSet),
        { tool: "create_unit_of_measure_set", name: args.name as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
