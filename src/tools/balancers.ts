import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, buildPaginationResponse } from "../services/api.js";
import { paginationSchema, responseFormatSchema, idSchema } from "../schemas/common.js";
import { ResponseFormat, Balancer, BalancerRule, BalancerPreset } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

function formatBalancer(bal: Balancer): string {
  return `## ${bal.name} (ID: ${bal.id})
- **Status:** ${bal.status}
- **Algorithm:** ${bal.algo}
- **IP:** ${bal.ip || "Not assigned"}
- **Local IP:** ${bal.local_ip || "N/A"}
- **Port:** ${bal.port}
- **Sticky Sessions:** ${bal.is_sticky ? "Yes" : "No"}
- **Use Proxy:** ${bal.is_use_proxy ? "Yes" : "No"}
- **SSL:** ${bal.is_ssl ? "Yes" : "No"}
- **Keepalive:** ${bal.is_keepalive ? "Yes" : "No"}
- **Health Check:** inter=${bal.inter}ms, fall=${bal.fall}, rise=${bal.rise}, timeout=${bal.timeout}ms
- **Preset ID:** ${bal.preset_id}
- **Availability Zone:** ${bal.availability_zone}
- **Created:** ${bal.created_at}
- **Rules:** ${bal.rules.length}`;
}

function formatBalancerRule(rule: BalancerRule): string {
  return `- **Rule ${rule.id}:** ${rule.balancer_proto.toUpperCase()}:${rule.balancer_port} → ${rule.server_proto.toUpperCase()}:${rule.server_port}`;
}

function formatBalancerPreset(preset: BalancerPreset): string {
  return `## Preset ${preset.id}
- **Description:** ${preset.description || "N/A"}
- **Bandwidth:** ${preset.bandwidth} Mbps
- **Replicas:** ${preset.replica_count}
- **RPS:** ${preset.request_per_second || "Unlimited"}
- **Price:** ${preset.price} ${preset.currency}/month
- **Location:** ${preset.location}`;
}

export function registerBalancerTools(server: McpServer): void {
  // List balancers
  server.tool(
    "timeweb_list_balancers",
    "List all load balancers in the account",
    {
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ balancers: Balancer[]; meta?: { total?: number } }>(
        "GET",
        "/api/v1/balancers",
        { limit, offset }
      );

      const balancers = response.balancers || [];
      const total = response.meta?.total || balancers.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ balancers, total, limit, offset }, null, 2) }]
        };
      }

      if (balancers.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No load balancers found." }]
        };
      }

      const text = `# Load Balancers

${buildPaginationResponse(total, limit, offset)}

${balancers.map(formatBalancer).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get balancer details
  server.tool(
    "timeweb_get_balancer",
    "Get detailed information about a specific load balancer",
    {
      balancer_id: idSchema("Load balancer ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const balancerId = args.balancer_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ balancer: Balancer }>("GET", `/api/v1/balancers/${balancerId}`);
      const balancer = response.balancer;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(balancer, null, 2) }]
        };
      }

      let text = formatBalancer(balancer);
      if (balancer.rules.length > 0) {
        text += `\n\n### Rules\n${balancer.rules.map(formatBalancerRule).join("\n")}`;
      }

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Create balancer
  server.tool(
    "timeweb_create_balancer",
    "Create a new load balancer",
    {
      name: z.string().describe("Load balancer name"),
      preset_id: idSchema("Preset ID for the balancer configuration"),
      algo: z.enum(["roundrobin", "leastconn"]).optional().describe("Load balancing algorithm (default: roundrobin)"),
      port: z.number().int().min(1).max(65535).optional().describe("Main port (default: 80)"),
      is_sticky: z.boolean().optional().describe("Enable sticky sessions"),
      is_use_proxy: z.boolean().optional().describe("Use proxy protocol"),
      is_ssl: z.boolean().optional().describe("Enable SSL"),
      is_keepalive: z.boolean().optional().describe("Enable keepalive"),
      inter: z.number().int().optional().describe("Health check interval in milliseconds"),
      timeout: z.number().int().optional().describe("Connection timeout in milliseconds"),
      fall: z.number().int().optional().describe("Number of failures before marking as down"),
      rise: z.number().int().optional().describe("Number of successes before marking as up"),
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        name: args.name,
        preset_id: args.preset_id
      };

      if (args.algo) body.algo = args.algo;
      if (args.port) body.port = args.port;
      if (args.is_sticky !== undefined) body.is_sticky = args.is_sticky;
      if (args.is_use_proxy !== undefined) body.is_use_proxy = args.is_use_proxy;
      if (args.is_ssl !== undefined) body.is_ssl = args.is_ssl;
      if (args.is_keepalive !== undefined) body.is_keepalive = args.is_keepalive;
      if (args.inter) body.inter = args.inter;
      if (args.timeout) body.timeout = args.timeout;
      if (args.fall) body.fall = args.fall;
      if (args.rise) body.rise = args.rise;

      const response = await makeApiRequest<{ balancer: Balancer }>("POST", "/api/v1/balancers", undefined, body);
      const balancer = response.balancer;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(balancer, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Load Balancer Created Successfully\n\n${formatBalancer(balancer)}` }]
      };
    }
  );

  // Update balancer
  server.tool(
    "timeweb_update_balancer",
    "Update an existing load balancer",
    {
      balancer_id: idSchema("Load balancer ID"),
      name: z.string().optional().describe("New name for the balancer"),
      algo: z.enum(["roundrobin", "leastconn"]).optional().describe("Load balancing algorithm"),
      port: z.number().int().min(1).max(65535).optional().describe("Main port"),
      is_sticky: z.boolean().optional().describe("Enable sticky sessions"),
      is_use_proxy: z.boolean().optional().describe("Use proxy protocol"),
      is_ssl: z.boolean().optional().describe("Enable SSL"),
      is_keepalive: z.boolean().optional().describe("Enable keepalive"),
      inter: z.number().int().optional().describe("Health check interval in milliseconds"),
      timeout: z.number().int().optional().describe("Connection timeout in milliseconds"),
      fall: z.number().int().optional().describe("Number of failures before marking as down"),
      rise: z.number().int().optional().describe("Number of successes before marking as up"),
      format: responseFormatSchema
    },
    async (args) => {
      const balancerId = args.balancer_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {};

      if (args.name) body.name = args.name;
      if (args.algo) body.algo = args.algo;
      if (args.port) body.port = args.port;
      if (args.is_sticky !== undefined) body.is_sticky = args.is_sticky;
      if (args.is_use_proxy !== undefined) body.is_use_proxy = args.is_use_proxy;
      if (args.is_ssl !== undefined) body.is_ssl = args.is_ssl;
      if (args.is_keepalive !== undefined) body.is_keepalive = args.is_keepalive;
      if (args.inter) body.inter = args.inter;
      if (args.timeout) body.timeout = args.timeout;
      if (args.fall) body.fall = args.fall;
      if (args.rise) body.rise = args.rise;

      const response = await makeApiRequest<{ balancer: Balancer }>("PATCH", `/api/v1/balancers/${balancerId}`, undefined, body);
      const balancer = response.balancer;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(balancer, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Load Balancer Updated Successfully\n\n${formatBalancer(balancer)}` }]
      };
    }
  );

  // Delete balancer
  server.tool(
    "timeweb_delete_balancer",
    "Delete a load balancer permanently",
    {
      balancer_id: idSchema("Load balancer ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const balancerId = args.balancer_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v1/balancers/${balancerId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_balancer_id: balancerId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Load balancer ${balancerId} has been deleted successfully.` }]
      };
    }
  );

  // List balancer rules
  server.tool(
    "timeweb_list_balancer_rules",
    "List all rules for a load balancer",
    {
      balancer_id: idSchema("Load balancer ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const balancerId = args.balancer_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ rules: BalancerRule[] }>(
        "GET",
        `/api/v1/balancers/${balancerId}/rules`
      );

      const rules = response.rules || [];

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ rules, balancer_id: balancerId }, null, 2) }]
        };
      }

      if (rules.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No rules found for balancer ${balancerId}.` }]
        };
      }

      const text = `# Balancer Rules (Balancer ${balancerId})

${rules.map(formatBalancerRule).join("\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Create balancer rule
  server.tool(
    "timeweb_create_balancer_rule",
    "Create a new rule for a load balancer",
    {
      balancer_id: idSchema("Load balancer ID"),
      balancer_proto: z.enum(["http", "http2", "https", "tcp"]).describe("Protocol on balancer side"),
      balancer_port: z.number().int().min(1).max(65535).describe("Port on balancer side"),
      server_proto: z.enum(["http", "http2", "https", "tcp"]).describe("Protocol on server side"),
      server_port: z.number().int().min(1).max(65535).describe("Port on server side"),
      format: responseFormatSchema
    },
    async (args) => {
      const balancerId = args.balancer_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        balancer_proto: args.balancer_proto,
        balancer_port: args.balancer_port,
        server_proto: args.server_proto,
        server_port: args.server_port
      };

      const response = await makeApiRequest<{ rule: BalancerRule }>(
        "POST",
        `/api/v1/balancers/${balancerId}/rules`,
        undefined,
        body
      );
      const rule = response.rule;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(rule, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Balancer Rule Created Successfully\n\n${formatBalancerRule(rule)}` }]
      };
    }
  );

  // List balancer presets
  server.tool(
    "timeweb_list_balancer_presets",
    "List available load balancer configuration presets",
    {
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ balancers_presets: BalancerPreset[] }>("GET", "/api/v1/presets/balancers");
      const presets = response.balancers_presets || [];

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(presets, null, 2) }]
        };
      }

      if (presets.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No balancer presets found." }]
        };
      }

      const text = `# Load Balancer Presets

${presets.map(formatBalancerPreset).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );
}
