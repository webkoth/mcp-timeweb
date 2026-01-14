import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, buildPaginationResponse } from "../services/api.js";
import { paginationSchema, responseFormatSchema } from "../schemas/common.js";
import { ResponseFormat, Domain, DnsRecord } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

function formatDomain(domain: Domain): string {
  return `## ${domain.fqdn} (ID: ${domain.id})
- **Linked IP:** ${domain.linked_ip || "None"}
- **Subdomains:** ${domain.subdomains?.length || 0}
- **Auto-Renew:** ${domain.is_autoprolong_enabled ? "Yes" : "No"}
- **Privacy:** ${domain.is_whois_privacy_enabled ? "Enabled" : "Disabled"}
- **Expiration:** ${domain.expiration_date || "N/A"}`;
}

function formatDnsRecord(record: DnsRecord): string {
  return `- **${record.type}** ${record.subdomain || "@"} → ${record.value} (TTL: ${record.ttl || "default"})`;
}

export function registerDomainTools(server: McpServer): void {
  // List domains
  server.tool(
    "timeweb_list_domains",
    "List all domains in the account",
    {
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ domains: Domain[]; meta?: { total?: number } }>(
        "GET",
        "/api/v1/domains",
        { limit, offset }
      );

      const domains = response.domains || [];
      const total = response.meta?.total || domains.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ domains, total, limit, offset }, null, 2) }]
        };
      }

      if (domains.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No domains found." }]
        };
      }

      const text = `# Domains

${buildPaginationResponse(total, limit, offset)}

${domains.map(formatDomain).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get domain details
  server.tool(
    "timeweb_get_domain",
    "Get detailed information about a specific domain",
    {
      fqdn: z.string().describe("Fully qualified domain name (e.g., example.com)"),
      format: responseFormatSchema
    },
    async (args) => {
      const fqdn = args.fqdn as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ domain: Domain }>("GET", `/api/v1/domains/${fqdn}`);
      const domain = response.domain;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(domain, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: formatDomain(domain) }]
      };
    }
  );

  // Check domain availability
  server.tool(
    "timeweb_check_domain",
    "Check if a domain is available for registration",
    {
      fqdn: z.string().describe("Fully qualified domain name to check (e.g., example.com)"),
      format: responseFormatSchema
    },
    async (args) => {
      const fqdn = args.fqdn as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ is_domain_available: boolean; suggestions?: string[] }>(
        "GET",
        `/api/v1/check-domain/${fqdn}`
      );

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(response, null, 2) }]
        };
      }

      let text = `# Domain Availability: ${fqdn}

**Available:** ${response.is_domain_available ? "Yes ✓" : "No ✗"}`;

      if (response.suggestions && response.suggestions.length > 0) {
        text += `\n\n## Suggestions\n${response.suggestions.map(s => `- ${s}`).join("\n")}`;
      }

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // List DNS records
  server.tool(
    "timeweb_list_dns_records",
    "List DNS records for a domain",
    {
      fqdn: z.string().describe("Fully qualified domain name"),
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const fqdn = args.fqdn as string;
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ dns_records: DnsRecord[]; meta?: { total?: number } }>(
        "GET",
        `/api/v1/domains/${fqdn}/dns-records`,
        { limit, offset }
      );

      const records = response.dns_records || [];
      const total = response.meta?.total || records.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ records, total, limit, offset }, null, 2) }]
        };
      }

      if (records.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No DNS records found for ${fqdn}.` }]
        };
      }

      const text = `# DNS Records for ${fqdn}

${buildPaginationResponse(total, limit, offset)}

${records.map(formatDnsRecord).join("\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Create DNS record
  server.tool(
    "timeweb_create_dns_record",
    "Create a new DNS record for a domain",
    {
      fqdn: z.string().describe("Fully qualified domain name"),
      type: z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"]).describe("DNS record type"),
      value: z.string().describe("Record value (IP address, hostname, etc.)"),
      subdomain: z.string().optional().describe("Subdomain (leave empty for root domain)"),
      priority: z.number().optional().describe("Priority (for MX and SRV records)"),
      ttl: z.number().optional().describe("Time to live in seconds"),
      format: responseFormatSchema
    },
    async (args) => {
      const fqdn = args.fqdn as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        type: args.type,
        value: args.value
      };

      if (args.subdomain) body.subdomain = args.subdomain;
      if (args.priority !== undefined) body.priority = args.priority;
      if (args.ttl !== undefined) body.ttl = args.ttl;

      const response = await makeApiRequest<{ dns_record: DnsRecord }>(
        "POST",
        `/api/v1/domains/${fqdn}/dns-records`,
        undefined,
        body
      );
      const record = response.dns_record;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(record, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# DNS Record Created\n\n${formatDnsRecord(record)}` }]
      };
    }
  );

  // Delete DNS record
  server.tool(
    "timeweb_delete_dns_record",
    "Delete a DNS record",
    {
      fqdn: z.string().describe("Fully qualified domain name"),
      record_id: z.number().describe("DNS record ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const fqdn = args.fqdn as string;
      const recordId = args.record_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v1/domains/${fqdn}/dns-records/${recordId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_record_id: recordId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `DNS record ${recordId} has been deleted successfully.` }]
      };
    }
  );
}
