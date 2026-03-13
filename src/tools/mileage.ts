// Mileage tracking tools: list, get, create, update mileage records
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_mileage_records ───────────────────────────────────────────────────
  server.registerTool(
    "list_mileage_records",
    {
      title: "List Mileage Records",
      description:
        "List vehicle mileage records tracked in QuickBooks. Returns trip details including date, miles, vehicle, purpose, and reimbursable amount. Use for mileage expense reporting, tax deduction calculation, and travel policy compliance.",
      inputSchema: {
        where: z.string().optional().describe("QBO query WHERE clause (e.g. \"TxnDate >= '2024-01-01'\")"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default: 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default: 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.list_mileage_records",
        () => client.query("VehicleMileage", args.where as string | undefined, args.startPosition ?? 1, args.maxResults ?? 100),
        { tool: "list_mileage_records" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── get_mileage_record ─────────────────────────────────────────────────────
  server.registerTool(
    "get_mileage_record",
    {
      title: "Get Mileage Record",
      description:
        "Get full details for a specific mileage record by ID. Returns trip date, total miles, vehicle, start/end location, business purpose, billable flag, customer/job, and calculated reimbursement amount.",
      inputSchema: {
        mileageId: z.string().describe("Mileage record ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_mileage_record",
        () => client.get(`/vehiclemileage/${args.mileageId}`),
        { tool: "get_mileage_record", mileageId: args.mileageId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── create_mileage_record ──────────────────────────────────────────────────
  server.registerTool(
    "create_mileage_record",
    {
      title: "Create Mileage Record",
      description:
        "Create a new vehicle mileage record for business trip tracking. Records the trip date, miles driven, vehicle used, and business purpose. Can be marked as billable to a customer for expense reimbursement. Use for IRS mileage deduction tracking.",
      inputSchema: {
        vehicleId: z.string().describe("Vehicle ID (from list of vehicles in QBO)"),
        tripDate: z.string().describe("Trip date (YYYY-MM-DD)"),
        totalMiles: z.number().describe("Total miles driven on the trip"),
        startOdometer: z.number().optional().describe("Odometer reading at trip start"),
        endOdometer: z.number().optional().describe("Odometer reading at trip end"),
        billable: z.boolean().optional().describe("Whether trip is billable to a customer"),
        customerId: z.string().optional().describe("Customer/job ID to bill the mileage to"),
        purpose: z.string().optional().describe("Business purpose of the trip"),
        employeeId: z.string().optional().describe("Employee ID for the driver"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const body: Record<string, unknown> = {
        VehicleRef: { value: args.vehicleId },
        TxnDate: args.tripDate,
        TotalMiles: args.totalMiles,
      };
      if (args.startOdometer !== undefined) body.StartOdometer = args.startOdometer;
      if (args.endOdometer !== undefined) body.EndOdometer = args.endOdometer;
      if (args.billable !== undefined) body.Billable = args.billable;
      if (args.customerId) body.CustomerRef = { value: args.customerId };
      if (args.purpose) body.MileageRateRef = { value: args.purpose };
      if (args.employeeId) body.EmployeeRef = { value: args.employeeId };
      const result = await logger.time(
        "tool.create_mileage_record",
        () => client.post("/vehiclemileage", body),
        { tool: "create_mileage_record" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── update_mileage_record ──────────────────────────────────────────────────
  server.registerTool(
    "update_mileage_record",
    {
      title: "Update Mileage Record",
      description:
        "Update an existing mileage record. Correct trip dates, miles, vehicle assignment, customer billing, or business purpose. Requires mileageId and syncToken from get_mileage_record.",
      inputSchema: {
        mileageId: z.string().describe("Mileage record ID"),
        syncToken: z.string().describe("SyncToken from get_mileage_record"),
        tripDate: z.string().optional().describe("Corrected trip date (YYYY-MM-DD)"),
        totalMiles: z.number().optional().describe("Corrected total miles"),
        billable: z.boolean().optional().describe("Update billable flag"),
        customerId: z.string().optional().describe("Update customer/job ID"),
        vehicleId: z.string().optional().describe("Update vehicle ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const body: Record<string, unknown> = {
        Id: args.mileageId,
        SyncToken: args.syncToken,
        sparse: true,
      };
      if (args.tripDate) body.TxnDate = args.tripDate;
      if (args.totalMiles !== undefined) body.TotalMiles = args.totalMiles;
      if (args.billable !== undefined) body.Billable = args.billable;
      if (args.customerId) body.CustomerRef = { value: args.customerId };
      if (args.vehicleId) body.VehicleRef = { value: args.vehicleId };
      const result = await logger.time(
        "tool.update_mileage_record",
        () => client.post("/vehiclemileage", body),
        { tool: "update_mileage_record", mileageId: args.mileageId as string }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );
}
