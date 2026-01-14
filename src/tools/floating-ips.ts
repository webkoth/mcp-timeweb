import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, buildPaginationResponse } from "../services/api.js";
import { paginationSchema, responseFormatSchema, stringIdSchema } from "../schemas/common.js";
import { ResponseFormat, FloatingIp } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

function formatFloatingIp(ip: FloatingIp): string {
  return `## ${ip.ip} (ID: ${ip.id})
- **Status:** ${ip.is_ddos_guard ? "DDoS Protected" : "Standard"}
- **Bound To:** ${ip.resource_id ? `${ip.resource_type} #${ip.resource_id}` : "Not bound"}
- **Availability Zone:** ${ip.availability_zone || "N/A"}
- **Comment:** ${ip.comment || "None"}
- **Created:** ${ip.created_at}`;
}

export function registerFloatingIpTools(server: McpServer): void {
  // List floating IPs
  server.tool(
    "timeweb_list_floating_ips",
    "List all floating IP addresses in the account",
    {
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ floating_ips: FloatingIp[]; meta?: { total?: number } }>(
        "GET",
        "/api/v1/floating-ips",
        { limit, offset }
      );

      const ips = response.floating_ips || [];
      const total = response.meta?.total || ips.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ floating_ips: ips, total, limit, offset }, null, 2) }]
        };
      }

      if (ips.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No floating IPs found." }]
        };
      }

      const text = `# Floating IP Addresses

${buildPaginationResponse(total, limit, offset)}

${ips.map(formatFloatingIp).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get floating IP details
  server.tool(
    "timeweb_get_floating_ip",
    "Get detailed information about a specific floating IP",
    {
      floating_ip_id: stringIdSchema("Floating IP ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const ipId = args.floating_ip_id as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ floating_ip: FloatingIp }>("GET", `/api/v1/floating-ips/${ipId}`);
      const ip = response.floating_ip;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(ip, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: formatFloatingIp(ip) }]
      };
    }
  );

  // Create floating IP
  server.tool(
    "timeweb_create_floating_ip",
    "Create a new floating IP address",
    {
      availability_zone: z.string().optional().describe("Availability zone (e.g., 'ru-1a')"),
      is_ddos_guard: z.boolean().optional().describe("Enable DDoS protection"),
      comment: z.string().optional().describe("Optional comment"),
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {};
      if (args.availability_zone) body.availability_zone = args.availability_zone;
      if (args.is_ddos_guard !== undefined) body.is_ddos_guard = args.is_ddos_guard;
      if (args.comment) body.comment = args.comment;

      const response = await makeApiRequest<{ floating_ip: FloatingIp }>("POST", "/api/v1/floating-ips", undefined, body);
      const ip = response.floating_ip;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(ip, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Floating IP Created Successfully\n\n${formatFloatingIp(ip)}` }]
      };
    }
  );

  // Delete floating IP
  server.tool(
    "timeweb_delete_floating_ip",
    "Delete a floating IP address",
    {
      floating_ip_id: stringIdSchema("Floating IP ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const ipId = args.floating_ip_id as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v1/floating-ips/${ipId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_floating_ip_id: ipId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Floating IP ${ipId} has been deleted successfully.` }]
      };
    }
  );

  // Bind floating IP to resource
  server.tool(
    "timeweb_bind_floating_ip",
    "Bind a floating IP to a server or other resource",
    {
      floating_ip_id: stringIdSchema("Floating IP ID"),
      resource_type: z.enum(["server", "balancer"]).describe("Type of resource to bind to"),
      resource_id: z.number().describe("ID of the resource to bind to"),
      format: responseFormatSchema
    },
    async (args) => {
      const ipId = args.floating_ip_id as string;
      const resourceType = args.resource_type as string;
      const resourceId = args.resource_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("POST", `/api/v1/floating-ips/${ipId}/bind`, undefined, {
        resource_type: resourceType,
        resource_id: resourceId
      });

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, floating_ip_id: ipId, resource_type: resourceType, resource_id: resourceId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Floating IP ${ipId} has been bound to ${resourceType} ${resourceId} successfully.` }]
      };
    }
  );

  // Unbind floating IP
  server.tool(
    "timeweb_unbind_floating_ip",
    "Unbind a floating IP from its current resource",
    {
      floating_ip_id: stringIdSchema("Floating IP ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const ipId = args.floating_ip_id as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("POST", `/api/v1/floating-ips/${ipId}/unbind`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, floating_ip_id: ipId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Floating IP ${ipId} has been unbound successfully.` }]
      };
    }
  );
}
