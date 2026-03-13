// Employees tools: list_employees, get_employee, create_employee, update_employee
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── list_employees ──────────────────────────────────────────────────────────
  server.registerTool(
    "list_employees",
    {
      title: "List QuickBooks Employees",
      description:
        "List QuickBooks Online employees with optional filters. Returns display name, email, hire date, and active status. Supports pagination. Use when looking up employee IDs for time activities.",
      inputSchema: {
        active: z.boolean().optional().describe("Filter by active status"),
        where: z.string().optional().describe("Additional QBO WHERE clause"),
        startPosition: z.number().int().min(1).optional().describe("Pagination offset, 1-indexed (default 1)"),
        maxResults: z.number().int().min(1).max(1000).optional().describe("Max results (default 100)"),
        orderBy: z.string().optional().describe("Sort field (e.g. 'DisplayName ASC')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const whereParts: string[] = [];
      if (args.active !== undefined) whereParts.push(`Active = ${args.active}`);
      if (args.where) whereParts.push(args.where as string);
      const where = whereParts.length ? whereParts.join(" AND ") : undefined;

      const result = await logger.time(
        "tool.list_employees",
        () => client.query(
          "Employee",
          where,
          args.startPosition ?? 1,
          args.maxResults ?? 100,
          args.orderBy as string | undefined
        ),
        { tool: "list_employees" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── get_employee ────────────────────────────────────────────────────────────
  server.registerTool(
    "get_employee",
    {
      title: "Get QuickBooks Employee",
      description:
        "Get full details for a QuickBooks employee by ID. Returns all fields including contact info, hire date, SSN (last 4), and payroll information.",
      inputSchema: {
        employeeId: z.string().describe("QuickBooks employee ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const result = await logger.time(
        "tool.get_employee",
        () => client.get(`/employee/${args.employeeId}`),
        { tool: "get_employee", employeeId: args.employeeId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── create_employee ─────────────────────────────────────────────────────────
  server.registerTool(
    "create_employee",
    {
      title: "Create QuickBooks Employee",
      description:
        "Create a new employee in QuickBooks Online. Required: givenName and familyName. Returns the created employee with assigned ID.",
      inputSchema: {
        givenName: z.string().describe("Employee first name"),
        familyName: z.string().describe("Employee last name"),
        displayName: z.string().optional().describe("Display name (auto-generated from first/last if omitted)"),
        email: z.string().email().optional().describe("Employee email address"),
        phone: z.string().optional().describe("Primary phone number"),
        mobile: z.string().optional().describe("Mobile phone number"),
        hireDate: z.string().optional().describe("Hire date (YYYY-MM-DD)"),
        releasedDate: z.string().optional().describe("Termination date (YYYY-MM-DD)"),
        billRate: z.number().optional().describe("Billing rate per hour"),
        addressLine1: z.string().optional().describe("Address line 1"),
        addressCity: z.string().optional().describe("City"),
        addressState: z.string().optional().describe("State/province"),
        addressPostalCode: z.string().optional().describe("Postal/ZIP code"),
        addressCountry: z.string().optional().describe("Country"),
        employeeNumber: z.string().optional().describe("Employee number / ID"),
        ssn: z.string().optional().describe("Social Security Number (masked in QBO)"),
        gender: z.enum(["Male", "Female"]).optional().describe("Gender"),
        birthDate: z.string().optional().describe("Birth date (YYYY-MM-DD)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const employee: Record<string, unknown> = {
        GivenName: args.givenName,
        FamilyName: args.familyName,
      };

      if (args.displayName) employee.DisplayName = args.displayName;
      if (args.email) employee.PrimaryEmailAddr = { Address: args.email };
      if (args.phone) employee.PrimaryPhone = { FreeFormNumber: args.phone };
      if (args.mobile) employee.Mobile = { FreeFormNumber: args.mobile };
      if (args.hireDate) employee.HiredDate = args.hireDate;
      if (args.releasedDate) employee.ReleasedDate = args.releasedDate;
      if (args.billRate !== undefined) employee.BillRate = args.billRate;
      if (args.employeeNumber) employee.EmployeeNumber = args.employeeNumber;
      if (args.ssn) employee.SSN = args.ssn;
      if (args.gender) employee.Gender = args.gender;
      if (args.birthDate) employee.BirthDate = args.birthDate;

      if (args.addressLine1) {
        employee.PrimaryAddr = {
          Line1: args.addressLine1,
          ...(args.addressCity ? { City: args.addressCity } : {}),
          ...(args.addressState ? { CountrySubDivisionCode: args.addressState } : {}),
          ...(args.addressPostalCode ? { PostalCode: args.addressPostalCode } : {}),
          ...(args.addressCountry ? { Country: args.addressCountry } : {}),
        };
      }

      const result = await logger.time(
        "tool.create_employee",
        () => client.post("/employee", employee),
        { tool: "create_employee" }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );

  // ── update_employee ─────────────────────────────────────────────────────────
  server.registerTool(
    "update_employee",
    {
      title: "Update QuickBooks Employee",
      description:
        "Update an existing QuickBooks employee. Requires employeeId and syncToken (from get_employee). Only provided fields are updated (sparse update).",
      inputSchema: {
        employeeId: z.string().describe("Employee ID (from list_employees or get_employee)"),
        syncToken: z.string().describe("SyncToken from get_employee (required for optimistic locking)"),
        givenName: z.string().optional().describe("New first name"),
        familyName: z.string().optional().describe("New last name"),
        displayName: z.string().optional().describe("New display name"),
        email: z.string().email().optional().describe("New email address"),
        phone: z.string().optional().describe("New phone number"),
        hireDate: z.string().optional().describe("New hire date (YYYY-MM-DD)"),
        releasedDate: z.string().optional().describe("Termination date (YYYY-MM-DD)"),
        billRate: z.number().optional().describe("New billing rate per hour"),
        active: z.boolean().optional().describe("Set to false to deactivate employee"),
        employeeNumber: z.string().optional().describe("New employee number"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const employee: Record<string, unknown> = {
        Id: args.employeeId,
        SyncToken: args.syncToken,
        sparse: true,
      };

      if (args.givenName) employee.GivenName = args.givenName;
      if (args.familyName) employee.FamilyName = args.familyName;
      if (args.displayName) employee.DisplayName = args.displayName;
      if (args.email) employee.PrimaryEmailAddr = { Address: args.email };
      if (args.phone) employee.PrimaryPhone = { FreeFormNumber: args.phone };
      if (args.hireDate) employee.HiredDate = args.hireDate;
      if (args.releasedDate) employee.ReleasedDate = args.releasedDate;
      if (args.billRate !== undefined) employee.BillRate = args.billRate;
      if (args.active !== undefined) employee.Active = args.active;
      if (args.employeeNumber) employee.EmployeeNumber = args.employeeNumber;

      const result = await logger.time(
        "tool.update_employee",
        () => client.post("/employee", employee),
        { tool: "update_employee", employeeId: args.employeeId as string }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
  );
}
