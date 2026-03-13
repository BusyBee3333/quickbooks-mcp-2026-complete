// App Connections: subscription info, extended company config, feature detection
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { QuickBooksClient } from "../client.js";
import { logger } from "../logger.js";

export function registerTools(server: McpServer, client: QuickBooksClient): void {
  // ── get_company_info_extended ──────────────────────────────────────────────
  server.registerTool(
    "get_company_info_extended",
    {
      title: "Get Extended Company Information",
      description:
        "Get comprehensive company profile information including legal name, EIN/tax ID, fiscal year settings, industry type, address, contact info, and feature flags. More detailed than get_company_info — returns the full CompanyInfo object. Use for company setup verification, onboarding, and integration configuration.",
      inputSchema: {
        minorVersion: z.string().optional().describe("Minor API version (e.g. '65')"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const params = args.minorVersion ? new URLSearchParams({ minorversion: args.minorVersion as string }) : new URLSearchParams();
      const result = await logger.time(
        "tool.get_company_info_extended",
        () => client.query("CompanyInfo", undefined, 1, 1),
        { tool: "get_company_info_extended" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── get_preferences_extended ───────────────────────────────────────────────
  server.registerTool(
    "get_preferences_extended",
    {
      title: "Get Extended Preferences",
      description:
        "Get all QuickBooks company preferences including feature flags, default settings, accounting preferences (cash vs accrual), sales form settings, and expense tracking options. Returns the complete preferences object. Use to audit company configuration and determine which features are enabled (classes, locations, multicurrency, etc.).",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (_args) => {
      const result = await logger.time(
        "tool.get_preferences_extended",
        () => client.get(`/preferences`),
        { tool: "get_preferences_extended" }
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
    }
  );

  // ── get_subscription_plan ──────────────────────────────────────────────────
  server.registerTool(
    "get_subscription_plan",
    {
      title: "Get QuickBooks Subscription Plan",
      description:
        "Get information about the QuickBooks Online subscription plan by examining enabled features from company preferences. Determines if the company has Simple Start, Essentials, Plus, or Advanced features enabled. Use before attempting to use plan-gated features like Classes (Plus+), Locations (Plus+), or Projects (Advanced).",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    async (_args) => {
      const [prefsResult, infoResult] = await Promise.all([
        logger.time("tool.get_subscription_plan.prefs", () => client.get("/preferences"), { tool: "get_subscription_plan" }),
        logger.time("tool.get_subscription_plan.info", () => client.query("CompanyInfo", undefined, 1, 1), { tool: "get_subscription_plan" }),
      ]);
      const prefs = prefsResult as Record<string, unknown>;
      const prefObj = (prefs.Preferences || prefs) as Record<string, unknown>;
      const accountingInfo = prefObj.AccountingInfoPrefs as Record<string, unknown> | undefined;
      const salesForm = prefObj.SalesFormsPrefs as Record<string, unknown> | undefined;
      const productService = prefObj.ProductAndServicesPrefs as Record<string, unknown> | undefined;

      const featureDetection = {
        trackClasses: (salesForm as Record<string, unknown> | undefined)?.TrackClasses ?? false,
        trackDepartments: (salesForm as Record<string, unknown> | undefined)?.TrackDepartments ?? false,
        trackInventory: (productService as Record<string, unknown> | undefined)?.QuantityOnHand ?? false,
        useMulticurrency: (accountingInfo as Record<string, unknown> | undefined)?.UseMultiCurrency ?? false,
        classAssignedToTransactions: (accountingInfo as Record<string, unknown> | undefined)?.ClassAssignedToAccount ?? false,
        estimatedPlanLevel: "Check Intuit Developer Portal for exact subscription tier — features above indicate Plus+ capability",
        fullPreferences: prefObj,
        companyInfo: infoResult,
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(featureDetection, null, 2) }], structuredContent: featureDetection };
    }
  );
}
