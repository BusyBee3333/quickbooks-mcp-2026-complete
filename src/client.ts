// QuickBooks Online API v3 Client
// Auth: OAuth 2.0 with automatic token refresh
// Base URL: https://quickbooks.api.intuit.com/v3/company/{realmId}

import { logger } from "./logger.js";

const PRODUCTION_BASE = "https://quickbooks.api.intuit.com";
const SANDBOX_BASE = "https://sandbox-quickbooks.api.intuit.com";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000;

// ============================================
// CIRCUIT BREAKER
// ============================================
type CircuitState = "closed" | "open" | "half-open";

class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenLock = false;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(failureThreshold = 5, resetTimeoutMs = 60_000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  canExecute(): boolean {
    if (this.state === "closed") return true;
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        if (!this.halfOpenLock) {
          this.halfOpenLock = true;
          this.state = "half-open";
          logger.info("circuit_breaker.half_open");
          return true;
        }
        return false;
      }
      return false;
    }
    return false;
  }

  recordSuccess(): void {
    this.halfOpenLock = false;
    if (this.state !== "closed") {
      logger.info("circuit_breaker.closed", { previousFailures: this.failureCount });
    }
    this.failureCount = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.halfOpenLock = false;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold || this.state === "half-open") {
      this.state = "open";
      logger.warn("circuit_breaker.open", { failureCount: this.failureCount });
    }
  }
}

// ============================================
// TOKEN MANAGER — OAuth 2.0 refresh
// ============================================
interface TokenState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
}

class TokenManager {
  private state: TokenState;
  private clientId: string;
  private clientSecret: string;
  private refreshing = false;
  private refreshPromise: Promise<void> | null = null;

  constructor(clientId: string, clientSecret: string, refreshToken: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.state = {
      accessToken: "", // Will be populated on first refresh
      refreshToken,
      expiresAt: 0,    // Already expired — triggers immediate refresh
    };
  }

  async getAccessToken(): Promise<string> {
    // If token expires in less than 60 seconds, refresh it
    if (Date.now() >= this.state.expiresAt - 60_000) {
      await this.refresh();
    }
    return this.state.accessToken;
  }

  private async refresh(): Promise<void> {
    // Prevent concurrent refreshes
    if (this.refreshing && this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshing = true;
    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshing = false;
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<void> {
    logger.info("oauth.token_refresh.start");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
      const response = await fetch(TOKEN_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.state.refreshToken,
        }).toString(),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OAuth token refresh failed: ${response.status} ${response.statusText} — ${body}`);
      }

      const data = await response.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        token_type: string;
      };

      this.state = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.state.refreshToken, // Rotate if provided
        expiresAt: Date.now() + data.expires_in * 1000,
      };

      logger.info("oauth.token_refresh.done", {
        expiresIn: data.expires_in,
        expiresAt: new Date(this.state.expiresAt).toISOString(),
      });
    } catch (error) {
      logger.error("oauth.token_refresh.error", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  getCurrentRefreshToken(): string {
    return this.state.refreshToken;
  }
}

// ============================================
// QB API CLIENT
// ============================================
export class QuickBooksClient {
  private baseUrl: string;
  private realmId: string;
  private tokenManager: TokenManager;
  private timeoutMs: number;
  private circuitBreaker: CircuitBreaker;

  constructor(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
    realmId: string,
    environment: "production" | "sandbox" = "production",
    timeoutMs = DEFAULT_TIMEOUT_MS
  ) {
    const apiBase = environment === "sandbox" ? SANDBOX_BASE : PRODUCTION_BASE;
    this.baseUrl = `${apiBase}/v3/company/${realmId}`;
    this.realmId = realmId;
    this.tokenManager = new TokenManager(clientId, clientSecret, refreshToken);
    this.timeoutMs = timeoutMs;
    this.circuitBreaker = new CircuitBreaker();
  }

  async request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    if (!this.circuitBreaker.canExecute()) {
      throw new Error("Circuit breaker is open — QuickBooks API is temporarily unavailable. Try again in 60 seconds.");
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
      const requestId = logger.requestId();
      const start = performance.now();

      try {
        // Get fresh access token (auto-refreshes if expired)
        const accessToken = await this.tokenManager.getAccessToken();

        const url = `${this.baseUrl}${path}`;
        logger.debug("api_request.start", {
          requestId,
          method: options.method || "GET",
          path,
          attempt: attempt + 1,
        });

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
            ...options.headers,
          },
        });

        const durationMs = Math.round(performance.now() - start);

        // Token expired — refresh and retry
        if (response.status === 401) {
          logger.warn("api_request.token_expired", { requestId, path });
          // Force token refresh by clearing expiry
          continue;
        }

        // Rate limit
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
          logger.warn("api_request.rate_limited", { requestId, retryAfter, path });
          await this.delay(retryAfter * 1000);
          continue;
        }

        // Server errors — retry
        if (response.status >= 500) {
          this.circuitBreaker.recordFailure();
          lastError = new Error(`QuickBooks server error: ${response.status} ${response.statusText}`);
          logger.warn("api_request.server_error", { requestId, durationMs, status: response.status, path });
          const backoff = RETRY_BASE_DELAY * Math.pow(2, attempt);
          await this.delay(backoff + Math.random() * backoff * 0.5);
          continue;
        }

        // Client errors — don't retry
        if (!response.ok) {
          let errorBody = "";
          try { errorBody = await response.text(); } catch {}
          let errorMessage = `QuickBooks API error ${response.status}: ${response.statusText}`;
          try {
            const parsed = JSON.parse(errorBody);
            const fault = parsed.Fault || parsed.fault;
            if (fault?.Error?.length) {
              errorMessage += ` — ${fault.Error.map((e: { Message: string; Detail: string }) => `${e.Message}: ${e.Detail}`).join("; ")}`;
            }
          } catch {}
          logger.error("api_request.client_error", { requestId, durationMs, status: response.status, path });
          throw new Error(errorMessage);
        }

        this.circuitBreaker.recordSuccess();
        logger.debug("api_request.done", { requestId, durationMs, status: response.status, path });

        if (response.status === 204) return { success: true } as T;
        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          this.circuitBreaker.recordFailure();
          lastError = new Error(`Request timeout after ${this.timeoutMs}ms: ${path}`);
          logger.error("api_request.timeout", { path, timeoutMs: this.timeoutMs });
          continue;
        }
        if (error instanceof Error && !error.message.startsWith("QuickBooks server error")) {
          throw error;
        }
        lastError = error instanceof Error ? error : new Error(String(error));
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  async post<T = unknown>(path: string, data: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(data) });
  }

  // QuickBooks uses a unified /query endpoint for reading entities
  // Syntax: SELECT * FROM EntityName WHERE field = 'value' STARTPOSITION x MAXRESULTS y
  async query<T = unknown>(
    entity: string,
    where?: string,
    startPosition = 1,
    maxResults = 100,
    orderBy?: string
  ): Promise<{ QueryResponse: T; time: string }> {
    let sql = `SELECT * FROM ${entity}`;
    if (where) sql += ` WHERE ${where}`;
    if (orderBy) sql += ` ORDERBY ${orderBy}`;
    sql += ` STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;

    const encodedQuery = encodeURIComponent(sql);
    return this.get<{ QueryResponse: T; time: string }>(`/query?query=${encodedQuery}`);
  }

  async healthCheck(): Promise<{ reachable: boolean; authenticated: boolean; latencyMs: number; error?: string }> {
    const start = performance.now();
    try {
      // Try to get a fresh token
      const accessToken = await this.tokenManager.getAccessToken();
      // Validate by querying company info
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(`${this.baseUrl}/companyinfo/${this.realmId}`, {
          signal: controller.signal,
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Accept": "application/json",
          },
        });
        const latencyMs = Math.round(performance.now() - start);
        return {
          reachable: true,
          authenticated: response.status !== 401 && response.status !== 403,
          latencyMs,
          ...(response.status >= 400 ? { error: `HTTP ${response.status}` } : {}),
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      return {
        reachable: false,
        authenticated: false,
        latencyMs: Math.round(performance.now() - start),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
