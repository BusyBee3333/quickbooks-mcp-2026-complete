// Time Activities tools: list_time_activities, create_time_activity, get_time_activity
// Time activities track billable/non-billable hours for employees or vendors
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_time_activities ────────────────────────────────────────────────────
  server.registerTool(
    "list_time_activities",
    {
      title: "List QuickBooks Time Activities",
      description:
        "List QuickBooks Online time activities (time entries) with optional filters by employee, customer, or date range. Returns hours, billable status, and description. Supports pagination.",
      inputSchema: {
        employeeId: z.string().optional().describe("Filter by employee ID"),
        customerId: z.string().optional().describe("Filter by customer ID"),
        txnDateAfter: z.string().optional().describe("Filter entries after date (YYYY-MM-DD)"),
        txnDateBefore: z.string().optional().describe("Filter entries before date (YYYY-MM-DD)"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'TxnDate DESC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.employeeId) whereParts.push(`EmployeeRef = '${args.employeeId}'`);
      if (args.customerId) whereParts.push(`CustomerRef = '${args.customerId}'`);
      if (args.txnDateAfter) whereParts.push(`TxnDate >= '${args.txnDateAfter}'`);
      if (args.txnDateBefore) whereParts.push(`TxnDate <= '${args.txnDateBefore}'`);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_time_activities",
        () => client.query(
          "TimeActivity",
          where,
          args.startPosition ?? 1,
          args.maxResults ?? 100,
          args.orderBy as string | undefined
        ),
        { tool: "list_time_activities" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_time_activity ───────────────────────────────────────────────────────
  server.registerTool(
    "get_time_activity",
    {
      title: "Get QuickBooks Time Activity",
      description:
        "Get full details for a QuickBooks time activity (time entry) by ID. Returns employee/vendor, customer, hours, billable status, hourly rate, and description.",
      inputSchema: {
        timeActivityId: z.string().describe("QuickBooks time activity ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_time_activity",
        () => client.get(`/timeactivity/${args.timeActivityId}`),
        { tool: "get_time_activity", timeActivityId: args.timeActivityId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_time_activity ────────────────────────────────────────────────────
  server.registerTool(
    "create_time_activity",
    {
      title: "Create QuickBooks Time Activity",
      description:
        "Create a new time activity (time entry) in QuickBooks Online. Can be for an employee or vendor. Requires either employeeId or vendorId, plus hours. Optionally billable to a customer.",
      inputSchema: {
        txnDate: z.string().describe("Date of the time entry (YYYY-MM-DD)"),
        hours: z.number().min(0).describe("Hours worked (e.g. 2.5 for 2h 30m)"),
        employeeId: z.string().optional().describe("Employee ID (use for employee time entries)"),
        vendorId: z.string().optional().describe("Vendor ID (use for contractor/vendor time entries)"),
        customerId: z.string().optional().describe("Customer ID to bill time against"),
        itemId: z.string().optional().describe("Service item ID"),
        classId: z.string().optional().describe("Class ID for segmentation"),
        departmentId: z.string().optional().describe("Department ID"),
        description: z.string().optional().describe("Description of work performed"),
        billableStatus: z
          .enum(["Billable", "NotBillable", "HasBeenBilled"])
          .optional()
          .describe("Billable status (default: Billable when customerId provided)"),
        hourlyRate: z.number().optional().describe("Hourly billing rate (overrides employee default)"),
        breakHours: z.number().optional().describe("Break time in hours to subtract"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const nameOf = args.employeeId ? "EmployeeRef" : "VendorRef";
      const nameId = (args.employeeId || args.vendorId) as string;

      const activity: Record<string, unknown> = {
        TxnDate: args.txnDate,
        Hours: Math.floor(args.hours as number),
        Minutes: Math.round(((args.hours as number) % 1) * 60),
        NameOf: args.employeeId ? "Employee" : "Vendor",
        [nameOf]: { value: nameId },
      };

      if (args.customerId) activity.CustomerRef = { value: args.customerId };
      if (args.itemId) activity.ItemRef = { value: args.itemId };
      if (args.classId) activity.ClassRef = { value: args.classId };
      if (args.departmentId) activity.DepartmentRef = { value: args.departmentId };
      if (args.description) activity.Description = args.description;
      if (args.hourlyRate !== undefined) activity.HourlyRate = args.hourlyRate;
      if (args.breakHours !== undefined) activity.BreakHours = Math.floor(args.breakHours as number);

      if (args.billableStatus) {
        activity.BillableStatus = args.billableStatus;
      } else if (args.customerId) {
        activity.BillableStatus = "Billable";
      }

      const result = await logger.time(
        "tool.create_time_activity",
        () => client.post("/timeactivity", activity),
        { tool: "create_time_activity" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
