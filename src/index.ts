#!/usr/bin/env node
// QuickBooks Online MCP Server — Production Quality
// 20 tools covering customers, invoices, payments, bills, accounts, and financial reports
// Transport: stdio (default) or HTTP (MCP_TRANSPORT=http)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { QuickBooksClient } from "./client.js";
import { logger } from "./logger.js";

// Tool group registrars
import { registerTools as registerHealthTools } from "./tools/health.js";
import { registerTools as registerCustomersTools } from "./tools/customers.js";
import { registerTools as registerInvoicesTools } from "./tools/invoices.js";
import { registerTools as registerPaymentsTools } from "./tools/payments.js";
import { registerTools as registerBillsTools } from "./tools/bills.js";
import { registerTools as registerAccountsTools } from "./tools/accounts.js";
import { registerTools as registerReportsTools } from "./tools/reports.js";
import { registerTools as registerVendorsTools } from "./tools/vendors.js";
import { registerTools as registerItemsTools } from "./tools/items.js";
import { registerTools as registerEstimatesTools } from "./tools/estimates.js";
import { registerTools as registerPurchaseOrdersTools } from "./tools/purchase_orders.js";
import { registerTools as registerEmployeesTools } from "./tools/employees.js";
import { registerTools as registerClassesTools } from "./tools/classes.js";
import { registerTools as registerDepartmentsTools } from "./tools/departments.js";
import { registerTools as registerTimeActivitiesTools } from "./tools/time_activities.js";
import { registerTools as registerTaxTools } from "./tools/tax.js";

const MCP_NAME = "quickbooks";
const MCP_VERSION = "1.0.0";

async function main() {
  // ── Validate environment ─────────────────────────────────────────────────
  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  const refreshToken = process.env.QB_REFRESH_TOKEN;
  const realmId = process.env.QB_REALM_ID;

  if (!clientId || !clientSecret || !refreshToken || !realmId) {
    const missing = [
      !clientId && "QB_CLIENT_ID",
      !clientSecret && "QB_CLIENT_SECRET",
      !refreshToken && "QB_REFRESH_TOKEN",
      !realmId && "QB_REALM_ID",
    ].filter(Boolean);
    logger.error("startup.missing_env", { missing });
    console.error(`Error: Missing required environment variables: ${missing.join(", ")}`);
    console.error("Copy .env.example to .env and fill in your QuickBooks OAuth credentials.");
    console.error("  QB_CLIENT_ID      — from https://developer.intuit.com");
    console.error("  QB_CLIENT_SECRET  — from https://developer.intuit.com");
    console.error("  QB_REFRESH_TOKEN  — obtained after initial OAuth flow");
    console.error("  QB_REALM_ID       — your QuickBooks company ID");
    process.exit(1);
  }

  const environment = (process.env.QB_ENVIRONMENT as "production" | "sandbox") || "production";

  // ── Initialize client ────────────────────────────────────────────────────
  const client = new QuickBooksClient(
    clientId,
    clientSecret,
    refreshToken,
    realmId,
    environment
  );

  // ── Create MCP server ────────────────────────────────────────────────────
  const server = new McpServer({
    name: `${MCP_NAME}-mcp`,
    version: MCP_VERSION,
  });

  // ── Register all tool groups ─────────────────────────────────────────────
  registerHealthTools(server, client);          //  1: health_check
  registerCustomersTools(server, client);       //  4: list_customers, get_customer, create_customer, update_customer
  registerInvoicesTools(server, client);        //  6: list_invoices, get_invoice, create_invoice, update_invoice, send_invoice, delete_invoice
  registerPaymentsTools(server, client);        //  3: list_payments, get_payment, create_payment
  registerBillsTools(server, client);           //  5: list_bills, get_bill, create_bill, update_bill, delete_bill
  registerAccountsTools(server, client);        //  2: list_accounts, get_account
  registerReportsTools(server, client);         //  6: profit_loss_report, balance_sheet_report, profit_and_loss_detail, accounts_receivable_aging, accounts_payable_aging, customer_balance_detail
  registerVendorsTools(server, client);         //  4: list_vendors, get_vendor, create_vendor, update_vendor
  registerItemsTools(server, client);           //  5: list_items, get_item, create_item, update_item, delete_item
  registerEstimatesTools(server, client);       //  4: list_estimates, get_estimate, create_estimate, convert_estimate_to_invoice
  registerPurchaseOrdersTools(server, client);  //  4: list_purchase_orders, get_purchase_order, create_purchase_order, update_purchase_order
  registerEmployeesTools(server, client);       //  4: list_employees, get_employee, create_employee, update_employee
  registerClassesTools(server, client);         //  3: list_classes, get_class, create_class
  registerDepartmentsTools(server, client);     //  3: list_departments, get_department, create_department
  registerTimeActivitiesTools(server, client);  //  3: list_time_activities, get_time_activity, create_time_activity
  registerTaxTools(server, client);             //  3: list_tax_codes, list_tax_rates, get_tax_code
  // Total: 60 tools

  logger.info("server.tools_registered", {
    count: 60,
    tools: [
      // Core
      "health_check",
      // Customers (4)
      "list_customers", "get_customer", "create_customer", "update_customer",
      // Invoices (6)
      "list_invoices", "get_invoice", "create_invoice", "update_invoice", "send_invoice", "delete_invoice",
      // Payments (3)
      "list_payments", "get_payment", "create_payment",
      // Bills (5)
      "list_bills", "get_bill", "create_bill", "update_bill", "delete_bill",
      // Accounts (2)
      "list_accounts", "get_account",
      // Reports (6)
      "profit_loss_report", "balance_sheet_report", "profit_and_loss_detail",
      "accounts_receivable_aging", "accounts_payable_aging", "customer_balance_detail",
      // Vendors (4)
      "list_vendors", "get_vendor", "create_vendor", "update_vendor",
      // Items (5)
      "list_items", "get_item", "create_item", "update_item", "delete_item",
      // Estimates (4)
      "list_estimates", "get_estimate", "create_estimate", "convert_estimate_to_invoice",
      // Purchase Orders (4)
      "list_purchase_orders", "get_purchase_order", "create_purchase_order", "update_purchase_order",
      // Employees (4)
      "list_employees", "get_employee", "create_employee", "update_employee",
      // Classes (3)
      "list_classes", "get_class", "create_class",
      // Departments (3)
      "list_departments", "get_department", "create_department",
      // Time Activities (3)
      "list_time_activities", "get_time_activity", "create_time_activity",
      // Tax (3)
      "list_tax_codes", "list_tax_rates", "get_tax_code",
    ],
  });

  // ── Start transport ──────────────────────────────────────────────────────
  const transportMode = process.env.MCP_TRANSPORT || "stdio";

  if (transportMode === "http") {
    await startHttpTransport(server);
  } else {
    await startStdioTransport(server);
  }
}

async function startStdioTransport(server: McpServer) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("server.started", { transport: "stdio", name: MCP_NAME, version: MCP_VERSION });
}

async function startHttpTransport(server: McpServer) {
  // Dynamic import to keep HTTP deps out of stdio startup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const httpMod = await import("@modelcontextprotocol/sdk/server/streamableHttp.js") as any;
  const TransportClass = httpMod.StreamableHTTPServerTransport
    || httpMod.NodeStreamableHTTPServerTransport;

  if (!TransportClass) {
    throw new Error("HTTP transport class not found in MCP SDK. Ensure @modelcontextprotocol/sdk >=1.26.0");
  }

  const { createServer } = await import("http");
  const { randomUUID } = await import("crypto");

  const port = parseInt(process.env.MCP_HTTP_PORT || "3000", 10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessions = new Map<string, any>();
  const sessionActivity = new Map<string, number>();
  const SESSION_TTL_MS = 30 * 60 * 1000;

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, lastActive] of sessionActivity.entries()) {
      if (now - lastActive > SESSION_TTL_MS) {
        sessions.delete(id);
        sessionActivity.delete(id);
        logger.info("session.expired", { sessionId: id });
      }
    }
  }, 60_000);

  const httpServer = createServer(async (
    req: import("http").IncomingMessage,
    res: import("http").ServerResponse
  ) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        server: MCP_NAME,
        version: MCP_VERSION,
        activeSessions: sessions.size,
      }));
      return;
    }

    if (url.pathname !== "/mcp") {
      res.writeHead(404);
      res.end();
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (req.method === "POST") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let transport: any;
      if (sessionId && sessions.has(sessionId)) {
        transport = sessions.get(sessionId);
        sessionActivity.set(sessionId, Date.now());
      } else {
        const newId = randomUUID();
        transport = new TransportClass({ sessionIdGenerator: () => newId });
        await server.connect(transport);
        sessions.set(newId, transport);
        sessionActivity.set(newId, Date.now());
        logger.info("session.created", { sessionId: newId });
      }
      await transport.handleRequest(req, res);
    } else if (req.method === "GET" && sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId);
      sessionActivity.set(sessionId, Date.now());
      await transport.handleRequest(req, res);
    } else if (req.method === "DELETE" && sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId);
      await transport.handleRequest(req, res);
      sessions.delete(sessionId);
      sessionActivity.delete(sessionId);
      logger.info("session.deleted", { sessionId });
    } else {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid request or missing session ID" }));
    }
  });

  process.on("SIGTERM", () => {
    clearInterval(cleanupInterval);
    sessions.clear();
    httpServer.close();
  });

  httpServer.listen(port, () => {
    logger.info("server.started", {
      transport: "http",
      name: MCP_NAME,
      version: MCP_VERSION,
      port,
      endpoint: "/mcp",
      health: "/health",
    });
    console.error(`QuickBooks MCP Server listening on http://localhost:${port}/mcp`);
  });
}

main().catch((error) => {
  logger.error("server.fatal", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
