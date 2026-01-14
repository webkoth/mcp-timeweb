import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makeApiRequest, formatCurrency } from "../services/api.js";
import { responseFormatSchema } from "../schemas/common.js";
import { ResponseFormat, AccountStatus, Finances } from "../types.js";

export function registerAccountTools(server: McpServer): void {
  // Get account status
  server.tool(
    "timeweb_get_account_status",
    "Get current account status including company info, verification status, and restrictions",
    {
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ status: AccountStatus }>("GET", "/api/v1/account/status");
      const status = response.status;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }]
        };
      }

      const text = `# Account Status

**Company:** ${status.company_info?.name || "N/A"}
**INN:** ${status.company_info?.inn || "N/A"}
**Email Verified:** ${status.is_email_verified ? "Yes" : "No"}
**YM Client ID:** ${status.ym_client_id || "N/A"}

## Restrictions
- **Servers Limit:** ${status.restrictions?.servers_limit ?? "Unlimited"}
- **Blocked:** ${status.restrictions?.is_blocked ? "Yes" : "No"}
- **Send Billing Alerts:** ${status.restrictions?.is_send_billing_letters ? "Yes" : "No"}
- **Technical Works:** ${status.restrictions?.is_technical_works ? "Yes" : "No"}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get finances
  server.tool(
    "timeweb_get_finances",
    "Get account finances including balance, discount, hourly cost, and payment history",
    {
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ finances: Finances }>("GET", "/api/v1/account/finances");
      const finances = response.finances;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(finances, null, 2) }]
        };
      }

      const text = `# Account Finances

**Balance:** ${formatCurrency(finances.balance)}
**Currency:** ${finances.currency}
**Discount End Date:** ${finances.discount_end_date_at || "N/A"}
**Discount Percent:** ${finances.discount_percent}%
**Hourly Cost:** ${formatCurrency(finances.hourly_cost)}
**Hourly Fee:** ${formatCurrency(finances.hourly_fee)}
**Monthly Cost:** ${formatCurrency(finances.monthly_cost)}
**Total Paid:** ${formatCurrency(finances.total_paid)}
**Hours Left:** ${finances.hours_left ?? "N/A"}
**Auto Payment Enabled:** ${finances.autopay_card_info ? "Yes" : "No"}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get service prices
  server.tool(
    "timeweb_get_service_prices",
    "Get pricing for all available services",
    {
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ prices: Record<string, unknown> }>("GET", "/api/v1/prices");

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(response.prices, null, 2) }]
        };
      }

      const text = `# Service Prices

\`\`\`json
${JSON.stringify(response.prices, null, 2)}
\`\`\``;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );
}
