#!/usr/bin/env node
// QuickBooks Online MCP Server — Production Quality
// V2: 171 tools covering the full QBO API surface — 50 tool modules
// Transport: stdio (default) or HTTP (MCP_TRANSPORT=http)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { QuickBooksClient } from "./client.js";
import { logger } from "./logger.js";

// ── Original tool groups ──────────────────────────────────────────────────────
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

// ── Round 2 tool groups ───────────────────────────────────────────────────────
import { registerTools as registerCreditMemosTools } from "./tools/credit_memos.js";
import { registerTools as registerSalesReceiptsTools } from "./tools/sales_receipts.js";
import { registerTools as registerJournalEntriesTools } from "./tools/journal_entries.js";
import { registerTools as registerCreditCardChargesTools } from "./tools/credit_card_charges.js";
import { registerTools as registerDepositsTools } from "./tools/deposits.js";
import { registerTools as registerTransfersTools } from "./tools/transfers.js";
import { registerTools as registerBudgetsTools } from "./tools/budgets.js";
import { registerTools as registerRecurringTransactionsTools } from "./tools/recurring_transactions.js";
import { registerTools as registerAttachmentsTools } from "./tools/attachments.js";
import { registerTools as registerPreferencesTools } from "./tools/preferences.js";
import { registerTools as registerCompanyInfoTools } from "./tools/company_info.js";

// ── Round 3 tool groups (V2 expansion — 23 new modules) ──────────────────────
import { registerTools as registerBatchTools } from "./tools/batch.js";
import { registerTools as registerCdcTools } from "./tools/cdc.js";
import { registerTools as registerRefundReceiptsTools } from "./tools/refund_receipts.js";
import { registerTools as registerVendorCreditsTools } from "./tools/vendor_credits.js";
import { registerTools as registerBillPaymentTools } from "./tools/bill_payment.js";
import { registerTools as registerPurchaseTools } from "./tools/purchase.js";
import { registerTools as registerPaymentMethodsTools } from "./tools/payment_methods.js";
import { registerTools as registerTermTools } from "./tools/term.js";
import { registerTools as registerQueryTools } from "./tools/query.js";
import { registerTools as registerTaxAgencyTools } from "./tools/tax_agency.js";
import { registerTools as registerExchangeRatesTools } from "./tools/exchange_rates.js";
import { registerTools as registerCustomerTypeTools } from "./tools/customer_type.js";
import { registerTools as registerInventoryAdjustmentTools } from "./tools/inventory_adjustment.js";
import { registerTools as registerTaxReportsTools } from "./tools/tax_reports.js";
import { registerTools as registerCreditCardPaymentsTools } from "./tools/credit_card_payments.js";
import { registerTools as registerCompanyCurrencyTools } from "./tools/company_currency.js";
import { registerTools as registerUnitOfMeasureTools } from "./tools/unit_of_measure.js";
import { registerTools as registerCustomerStatementTools } from "./tools/customer_statement.js";
import { registerTools as registerJournalCodesTools } from "./tools/journal_codes.js";
import { registerTools as registerTimeReportsTools } from "./tools/time_reports.js";
import { registerTools as registerPaymentApplicationTools } from "./tools/payment_application.js";
import { registerTools as registerCompanySnapshotTools } from "./tools/company_snapshot.js";
import { registerTools as registerAccountOperationsTools } from "./tools/account_operations.js";

const MCP_NAME = "quickbooks";
const MCP_VERSION = "2.0.0";

// Tool count breakdown:
//   Round 1 (60): health(1) + customers(4) + invoices(6) + payments(3) + bills(5)
//                 + accounts(2) + reports(6) + vendors(4) + items(5) + estimates(4)
//                 + purchase_orders(4) + employees(4) + classes(3) + departments(3)
//                 + time_activities(3) + tax(3)
//   Round 2 new tools (38):
//     credit_memos(4) + sales_receipts(4) + journal_entries(3) + credit_card_charges(3)
//     + deposits(3) + transfers(3) + budgets(2) + recurring_transactions(2)
//     + attachments(4) + preferences(2) + company_info(2) + new_reports(9)
//   TOTAL: 171 (V2: +70 tools across 23 new modules)

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
  // Round 1 — original 60 tools
  registerHealthTools(server, client);          //  1: health_check
  registerCustomersTools(server, client);       //  4: list_customers, get_customer, create_customer, update_customer
  registerInvoicesTools(server, client);        //  6: list_invoices, get_invoice, create_invoice, update_invoice, send_invoice, delete_invoice
  registerPaymentsTools(server, client);        //  3: list_payments, get_payment, create_payment
  registerBillsTools(server, client);           //  5: list_bills, get_bill, create_bill, update_bill, delete_bill
  registerAccountsTools(server, client);        //  2: list_accounts, get_account
  registerReportsTools(server, client);         // 15: profit_loss_report, balance_sheet_report, profit_and_loss_detail,
                                                //     accounts_receivable_aging, accounts_payable_aging, customer_balance_detail,
                                                //     vendor_balance_detail, trial_balance, general_ledger, transaction_list,
                                                //     inventory_valuation_summary, sales_by_customer_summary,
                                                //     sales_by_product_service_summary, aged_payables, cash_flow
  registerVendorsTools(server, client);         //  4: list_vendors, get_vendor, create_vendor, update_vendor
  registerItemsTools(server, client);           //  5: list_items, get_item, create_item, update_item, delete_item
  registerEstimatesTools(server, client);       //  4: list_estimates, get_estimate, create_estimate, convert_estimate_to_invoice
  registerPurchaseOrdersTools(server, client);  //  4: list_purchase_orders, get_purchase_order, create_purchase_order, update_purchase_order
  registerEmployeesTools(server, client);       //  4: list_employees, get_employee, create_employee, update_employee
  registerClassesTools(server, client);         //  3: list_classes, get_class, create_class
  registerDepartmentsTools(server, client);     //  3: list_departments, get_department, create_department
  registerTimeActivitiesTools(server, client);  //  3: list_time_activities, get_time_activity, create_time_activity
  registerTaxTools(server, client);             //  3: list_tax_codes, list_tax_rates, get_tax_code

  // Round 2 — new 38 tools
  registerCreditMemosTools(server, client);         //  4: list_credit_memos, get_credit_memo, create_credit_memo, void_credit_memo
  registerSalesReceiptsTools(server, client);       //  4: list_sales_receipts, get_sales_receipt, create_sales_receipt, void_sales_receipt
  registerJournalEntriesTools(server, client);      //  3: list_journal_entries, get_journal_entry, create_journal_entry
  registerCreditCardChargesTools(server, client);   //  3: list_credit_card_charges, get_credit_card_charge, create_credit_card_charge
  registerDepositsTools(server, client);            //  3: list_deposits, get_deposit, create_deposit
  registerTransfersTools(server, client);           //  3: list_transfers, get_transfer, create_transfer
  registerBudgetsTools(server, client);             //  2: list_budgets, get_budget
  registerRecurringTransactionsTools(server, client); //  2: list_recurring_transactions, get_recurring_transaction
  registerAttachmentsTools(server, client);         //  4: list_attachments, upload_attachment, get_attachment, delete_attachment
  registerPreferencesTools(server, client);         //  2: get_preferences, update_preferences
  registerCompanyInfoTools(server, client);         //  2: get_company_info, update_company_info

  // Round 3 — V2 expansion (23 new modules, ~70 new tools)
  registerBatchTools(server, client);               //  2: batch_write, batch_query
  registerCdcTools(server, client);                 //  2: cdc_query, cdc_poll
  registerRefundReceiptsTools(server, client);      //  4: list_refund_receipts, get_refund_receipt, create_refund_receipt, void_refund_receipt
  registerVendorCreditsTools(server, client);       //  4: list_vendor_credits, get_vendor_credit, create_vendor_credit, delete_vendor_credit
  registerBillPaymentTools(server, client);         //  5: list_bill_payments, get_bill_payment, create_bill_payment_check, create_bill_payment_credit_card, delete_bill_payment
  registerPurchaseTools(server, client);            //  4: list_purchases, get_purchase, create_purchase, delete_purchase
  registerPaymentMethodsTools(server, client);      //  4: list_payment_methods, get_payment_method, create_payment_method, update_payment_method
  registerTermTools(server, client);                //  4: list_terms, get_term, create_term, update_term
  registerQueryTools(server, client);               //  3: custom_query, count_query, query_all_pages
  registerTaxAgencyTools(server, client);           //  3: list_tax_agencies, get_tax_agency, create_tax_agency
  registerExchangeRatesTools(server, client);       //  3: get_exchange_rate, list_exchange_rates, update_exchange_rate
  registerCustomerTypeTools(server, client);        //  3: list_customer_types, get_customer_type, create_customer_type
  registerInventoryAdjustmentTools(server, client); //  4: list_inventory_adjustments, get_inventory_adjustment, create_inventory_adjustment, delete_inventory_adjustment
  registerTaxReportsTools(server, client);          //  7: tax_summary_report, sales_tax_liability_report, expenses_by_vendor_summary, account_list_report, class_sales_report, department_profit_loss_report, budget_vs_actuals_report
  registerCreditCardPaymentsTools(server, client);  //  3: list_credit_card_payments, get_credit_card_payment, create_credit_card_payment
  registerCompanyCurrencyTools(server, client);     //  4: list_company_currencies, get_company_currency, create_company_currency, update_company_currency
  registerUnitOfMeasureTools(server, client);       //  3: list_unit_of_measure_sets, get_unit_of_measure_set, create_unit_of_measure_set
  registerCustomerStatementTools(server, client);   //  4: customer_balance_summary, vendor_balance_summary, accounts_receivable_aging_detail, send_customer_statement
  registerJournalCodesTools(server, client);        //  4: list_journal_codes, get_journal_code, create_journal_code, update_journal_code
  registerTimeReportsTools(server, client);         //  5: time_activities_by_employee, payroll_summary_report, payroll_detail_report, customer_income_report, estimates_report
  registerPaymentApplicationTools(server, client);  //  4: apply_credit_memo_to_invoice, apply_vendor_credit_to_bill, void_payment, void_bill
  registerCompanySnapshotTools(server, client);     //  5: company_snapshot, purchases_by_product_service, open_purchase_orders_report, missing_checks_report, unbilled_time_report
  registerAccountOperationsTools(server, client);   //  5: create_account, update_account, list_inactive_accounts, list_bank_accounts, list_credit_card_accounts

  const TOTAL_TOOLS = 171;

  logger.info("server.tools_registered", {
    count: TOTAL_TOOLS,
    tools: [
      // Health (1)
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
      // Reports (15 — 6 original + 9 new)
      "profit_loss_report", "balance_sheet_report", "profit_and_loss_detail",
      "accounts_receivable_aging", "accounts_payable_aging", "customer_balance_detail",
      "vendor_balance_detail", "trial_balance", "general_ledger", "transaction_list",
      "inventory_valuation_summary", "sales_by_customer_summary",
      "sales_by_product_service_summary", "aged_payables", "cash_flow",
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
      // Credit Memos (4)
      "list_credit_memos", "get_credit_memo", "create_credit_memo", "void_credit_memo",
      // Sales Receipts (4)
      "list_sales_receipts", "get_sales_receipt", "create_sales_receipt", "void_sales_receipt",
      // Journal Entries (3)
      "list_journal_entries", "get_journal_entry", "create_journal_entry",
      // Credit Card Charges (3)
      "list_credit_card_charges", "get_credit_card_charge", "create_credit_card_charge",
      // Deposits (3)
      "list_deposits", "get_deposit", "create_deposit",
      // Transfers (3)
      "list_transfers", "get_transfer", "create_transfer",
      // Budgets (2)
      "list_budgets", "get_budget",
      // Recurring Transactions (2)
      "list_recurring_transactions", "get_recurring_transaction",
      // Attachments (4)
      "list_attachments", "upload_attachment", "get_attachment", "delete_attachment",
      // Preferences (2)
      "get_preferences", "update_preferences",
      // Company Info (2)
      "get_company_info", "update_company_info",
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
        totalTools: 171,
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
