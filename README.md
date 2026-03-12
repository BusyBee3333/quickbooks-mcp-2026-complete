# QuickBooks MCP Server 2026

Production-quality MCP (Model Context Protocol) server for QuickBooks Online API v3. 20 tools covering customers, invoices, payments, bills, accounts, and financial reports.

## Tools

| Tool | Description |
|------|-------------|
| `health_check` | Validate OAuth credentials and API connectivity |
| `list_customers` | List and filter customers |
| `get_customer` | Get customer details by ID |
| `create_customer` | Create a new customer |
| `update_customer` | Update customer fields |
| `list_invoices` | List invoices by customer, date range |
| `get_invoice` | Get invoice with all line items |
| `create_invoice` | Create invoice with line items |
| `update_invoice` | Update invoice fields or line items |
| `send_invoice` | Send invoice to customer via email |
| `list_payments` | List payments received |
| `get_payment` | Get payment details |
| `create_payment` | Record payment against invoice(s) |
| `list_bills` | List accounts payable bills |
| `get_bill` | Get bill details |
| `create_bill` | Create a new bill |
| `list_accounts` | Chart of accounts |
| `get_account` | Get account details |
| `profit_loss_report` | P&L report for a date range |
| `balance_sheet_report` | Balance sheet as of a date |

## Setup

### 1. Get OAuth credentials

1. Go to https://developer.intuit.com and create an app
2. Set OAuth 2.0 scopes: `com.intuit.quickbooks.accounting`
3. Complete the OAuth flow to get a refresh token
4. Find your company (realm) ID in the QuickBooks URL: `https://app.qbo.intuit.com/app/homepage?realmid=XXXXXXXXX`

### 2. Install and configure

```bash
git clone https://github.com/BusyBee3333/quickbooks-mcp-2026-complete.git
cd quickbooks-mcp-2026-complete
npm install
npm run build
cp .env.example .env
# Edit .env with your credentials
```

### 3. Configure Claude Desktop

```json
{
  "mcpServers": {
    "quickbooks": {
      "command": "node",
      "args": ["/path/to/quickbooks-mcp-2026-complete/dist/index.js"],
      "env": {
        "QB_CLIENT_ID": "your_client_id",
        "QB_CLIENT_SECRET": "your_client_secret",
        "QB_REFRESH_TOKEN": "your_refresh_token",
        "QB_REALM_ID": "your_company_id"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `QB_CLIENT_ID` | ✅ | OAuth 2.0 client ID from Intuit Developer |
| `QB_CLIENT_SECRET` | ✅ | OAuth 2.0 client secret |
| `QB_REFRESH_TOKEN` | ✅ | OAuth 2.0 refresh token (obtained after OAuth flow) |
| `QB_REALM_ID` | ✅ | QuickBooks company ID (from URL) |
| `QB_ENVIRONMENT` | ❌ | `production` (default) or `sandbox` |
| `MCP_TRANSPORT` | ❌ | `stdio` (default) or `http` |
| `MCP_HTTP_PORT` | ❌ | HTTP port when using HTTP transport (default: 3000) |

## Features

- **Auth**: OAuth 2.0 with automatic token refresh — tokens refreshed 60s before expiry, concurrent refresh prevention
- **Pagination**: Offset pagination (`startPosition`, `maxResults`) on all list endpoints, 1-indexed per QBO spec
- **Query API**: All list endpoints use QBO's SQL-like query language with full WHERE clause support
- **Reports API**: P&L and Balance Sheet reports with date range, accounting method, and dimension filtering
- **Sparse Update**: Customer and invoice updates use sparse=true to only modify provided fields
- **Circuit breaker**: Auto-opens after 5 failures, resets after 60s
- **Retry**: 3 attempts with exponential backoff + jitter for server errors
- **Timeout**: 30-second timeout per request
- **Structured output**: All tools return `content` (text) + `structuredContent` (JSON)
- **Transport**: stdio for local, HTTP/SSE for remote/production

## QuickBooks Query Examples

The `where` parameter in list tools accepts QBO SQL WHERE clauses:

```sql
-- Active customers with a balance
"Active = true AND Balance > '0.00'"

-- Overdue invoices
"DueDate < '2025-01-01' AND Balance > '0.00'"

-- Expense accounts only
"AccountType = 'Expense' AND Active = true"
```

## HTTP Transport

```bash
MCP_TRANSPORT=http MCP_HTTP_PORT=3000 node dist/index.js
# Health: GET http://localhost:3000/health
# MCP:    POST http://localhost:3000/mcp
```

## Resources

- [QuickBooks Online API v3 Reference](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account)
- [Intuit Developer Portal](https://developer.intuit.com)
- [QuickBooks OAuth 2.0 Guide](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)
- [QBO Query Language Reference](https://developer.intuit.com/app/developer/qbo/docs/develop/explore-the-quickbooks-online-api/data-queries)
- [MCP Protocol Spec](https://modelcontextprotocol.io)

## License

MIT
