import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, buildPaginationResponse } from "../services/api.js";
import { paginationSchema, responseFormatSchema, stringIdSchema } from "../schemas/common.js";
import { ResponseFormat, Vpc } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

// VPC Service interface
interface VpcService {
  id: number;
  type: string;
  name: string;
  status: string;
  ip: string | null;
}

function formatVpc(vpc: Vpc): string {
  return `## ${vpc.name} (ID: ${vpc.id})
- **Subnet:** ${vpc.subnet_v4}
- **Location:** ${vpc.location}
- **Availability Zone:** ${vpc.availability_zone}
- **Description:** ${vpc.description || "N/A"}
- **Default:** ${vpc.is_default ? "Yes" : "No"}
- **Created:** ${vpc.created_at}`;
}

function formatVpcService(service: VpcService): string {
  return `- **${service.name}** (ID: ${service.id}) - ${service.type} | Status: ${service.status} | IP: ${service.ip || "N/A"}`;
}

export function registerVpcTools(server: McpServer): void {
  // List VPCs
  server.tool(
    "timeweb_list_vpcs",
    "List all Virtual Private Clouds (VPCs) in the account",
    {
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ vpcs: Vpc[]; meta?: { total?: number } }>(
        "GET",
        "/api/v2/vpcs",
        { limit, offset }
      );

      const vpcs = response.vpcs || [];
      const total = response.meta?.total || vpcs.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ vpcs, total, limit, offset }, null, 2) }]
        };
      }

      if (vpcs.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No VPCs found." }]
        };
      }

      const text = `# Virtual Private Clouds (VPCs)

${buildPaginationResponse(total, limit, offset)}

${vpcs.map(formatVpc).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get VPC details
  server.tool(
    "timeweb_get_vpc",
    "Get detailed information about a specific VPC",
    {
      vpc_id: stringIdSchema("VPC ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const vpcId = args.vpc_id as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ vpc: Vpc }>("GET", `/api/v2/vpcs/${vpcId}`);
      const vpc = response.vpc;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(vpc, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: formatVpc(vpc) }]
      };
    }
  );

  // Create VPC
  server.tool(
    "timeweb_create_vpc",
    "Create a new Virtual Private Cloud (VPC)",
    {
      name: z.string().describe("VPC name"),
      subnet_v4: z.string().optional().describe("IPv4 subnet in CIDR notation (e.g., '10.0.0.0/24'). Auto-assigned if not provided."),
      location: z.enum(["ru-1", "ru-2", "ru-3", "pl-1", "kz-1", "nl-1"]).optional().describe("VPC location"),
      description: z.string().optional().describe("VPC description"),
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        name: args.name
      };

      if (args.subnet_v4) body.subnet_v4 = args.subnet_v4;
      if (args.location) body.location = args.location;
      if (args.description) body.description = args.description;

      const response = await makeApiRequest<{ vpc: Vpc }>("POST", "/api/v2/vpcs", undefined, body);
      const vpc = response.vpc;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(vpc, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# VPC Created Successfully\n\n${formatVpc(vpc)}` }]
      };
    }
  );

  // Update VPC
  server.tool(
    "timeweb_update_vpc",
    "Update an existing VPC",
    {
      vpc_id: stringIdSchema("VPC ID"),
      name: z.string().optional().describe("New VPC name"),
      description: z.string().optional().describe("New VPC description"),
      format: responseFormatSchema
    },
    async (args) => {
      const vpcId = args.vpc_id as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {};

      if (args.name) body.name = args.name;
      if (args.description) body.description = args.description;

      const response = await makeApiRequest<{ vpc: Vpc }>("PATCH", `/api/v2/vpcs/${vpcId}`, undefined, body);
      const vpc = response.vpc;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(vpc, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# VPC Updated Successfully\n\n${formatVpc(vpc)}` }]
      };
    }
  );

  // Delete VPC
  server.tool(
    "timeweb_delete_vpc",
    "Delete a VPC permanently (must not have any attached services)",
    {
      vpc_id: stringIdSchema("VPC ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const vpcId = args.vpc_id as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v2/vpcs/${vpcId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_vpc_id: vpcId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `VPC ${vpcId} has been deleted successfully.` }]
      };
    }
  );

  // List VPC services
  server.tool(
    "timeweb_list_vpc_services",
    "List all services (servers, databases, etc.) attached to a VPC",
    {
      vpc_id: stringIdSchema("VPC ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const vpcId = args.vpc_id as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ services: VpcService[] }>(
        "GET",
        `/api/v2/vpcs/${vpcId}/services`
      );

      const services = response.services || [];

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ services, vpc_id: vpcId }, null, 2) }]
        };
      }

      if (services.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No services attached to VPC ${vpcId}.` }]
        };
      }

      const text = `# VPC Services (VPC ${vpcId})

**Total:** ${services.length} services

${services.map(formatVpcService).join("\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );
}
