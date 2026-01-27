import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, buildPaginationResponse } from "../services/api.js";
import { paginationSchema, responseFormatSchema, idSchema } from "../schemas/common.js";
import { ResponseFormat, FirewallGroup, FirewallRule } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

function formatFirewallGroup(group: FirewallGroup): string {
  return `## ${group.name} (ID: ${group.id})
- **Description:** ${group.description || "N/A"}
- **Default:** ${group.is_default ? "Yes" : "No"}
- **Incoming Policy:** ${group.incoming_traffic_policy}
- **Outgoing Policy:** ${group.outgoing_traffic_policy}
- **Linked Servers:** ${group.server_ids.length > 0 ? group.server_ids.join(", ") : "None"}
- **Created:** ${group.created_at}`;
}

function formatFirewallRule(rule: FirewallRule): string {
  return `- **Rule ${rule.id}:** ${rule.direction.toUpperCase()} | ${rule.protocol.toUpperCase()} | Port: ${rule.port || "all"} | CIDR: ${rule.cidr}${rule.description ? ` | ${rule.description}` : ""}`;
}

export function registerFirewallTools(server: McpServer): void {
  // List firewall groups
  server.tool(
    "timeweb_list_firewall_groups",
    "List all firewall groups in the account",
    {
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ groups: FirewallGroup[]; meta?: { total?: number } }>(
        "GET",
        "/api/v1/firewall/groups",
        { limit, offset }
      );

      const groups = response.groups || [];
      const total = response.meta?.total || groups.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ groups, total, limit, offset }, null, 2) }]
        };
      }

      if (groups.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No firewall groups found." }]
        };
      }

      const text = `# Firewall Groups

${buildPaginationResponse(total, limit, offset)}

${groups.map(formatFirewallGroup).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get firewall group details
  server.tool(
    "timeweb_get_firewall_group",
    "Get detailed information about a specific firewall group",
    {
      group_id: idSchema("Firewall group ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const groupId = args.group_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ group: FirewallGroup }>("GET", `/api/v1/firewall/groups/${groupId}`);
      const group = response.group;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(group, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: formatFirewallGroup(group) }]
      };
    }
  );

  // Create firewall group
  server.tool(
    "timeweb_create_firewall_group",
    "Create a new firewall group",
    {
      name: z.string().describe("Firewall group name"),
      description: z.string().optional().describe("Description of the firewall group"),
      incoming_traffic_policy: z.enum(["allow", "deny"]).optional().describe("Default policy for incoming traffic (default: deny)"),
      outgoing_traffic_policy: z.enum(["allow", "deny"]).optional().describe("Default policy for outgoing traffic (default: allow)"),
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        name: args.name
      };

      if (args.description) body.description = args.description;
      if (args.incoming_traffic_policy) body.incoming_traffic_policy = args.incoming_traffic_policy;
      if (args.outgoing_traffic_policy) body.outgoing_traffic_policy = args.outgoing_traffic_policy;

      const response = await makeApiRequest<{ group: FirewallGroup }>("POST", "/api/v1/firewall/groups", undefined, body);
      const group = response.group;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(group, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Firewall Group Created Successfully\n\n${formatFirewallGroup(group)}` }]
      };
    }
  );

  // Update firewall group
  server.tool(
    "timeweb_update_firewall_group",
    "Update an existing firewall group",
    {
      group_id: idSchema("Firewall group ID"),
      name: z.string().optional().describe("New name for the firewall group"),
      description: z.string().optional().describe("New description"),
      incoming_traffic_policy: z.enum(["allow", "deny"]).optional().describe("Default policy for incoming traffic"),
      outgoing_traffic_policy: z.enum(["allow", "deny"]).optional().describe("Default policy for outgoing traffic"),
      format: responseFormatSchema
    },
    async (args) => {
      const groupId = args.group_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {};

      if (args.name) body.name = args.name;
      if (args.description) body.description = args.description;
      if (args.incoming_traffic_policy) body.incoming_traffic_policy = args.incoming_traffic_policy;
      if (args.outgoing_traffic_policy) body.outgoing_traffic_policy = args.outgoing_traffic_policy;

      const response = await makeApiRequest<{ group: FirewallGroup }>("PATCH", `/api/v1/firewall/groups/${groupId}`, undefined, body);
      const group = response.group;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(group, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Firewall Group Updated Successfully\n\n${formatFirewallGroup(group)}` }]
      };
    }
  );

  // Delete firewall group
  server.tool(
    "timeweb_delete_firewall_group",
    "Delete a firewall group permanently",
    {
      group_id: idSchema("Firewall group ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const groupId = args.group_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v1/firewall/groups/${groupId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_group_id: groupId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Firewall group ${groupId} has been deleted successfully.` }]
      };
    }
  );

  // List firewall rules
  server.tool(
    "timeweb_list_firewall_rules",
    "List all rules in a firewall group",
    {
      group_id: idSchema("Firewall group ID"),
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const groupId = args.group_id as number;
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ rules: FirewallRule[]; meta?: { total?: number } }>(
        "GET",
        `/api/v1/firewall/groups/${groupId}/rules`,
        { limit, offset }
      );

      const rules = response.rules || [];
      const total = response.meta?.total || rules.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ rules, total, limit, offset, group_id: groupId }, null, 2) }]
        };
      }

      if (rules.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No firewall rules found in group ${groupId}.` }]
        };
      }

      const text = `# Firewall Rules (Group ${groupId})

${buildPaginationResponse(total, limit, offset)}

${rules.map(formatFirewallRule).join("\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Create firewall rule
  server.tool(
    "timeweb_create_firewall_rule",
    "Create a new firewall rule in a group",
    {
      group_id: idSchema("Firewall group ID"),
      direction: z.enum(["ingress", "egress"]).describe("Traffic direction (ingress = incoming, egress = outgoing)"),
      protocol: z.enum(["tcp", "udp", "icmp", "any"]).describe("Network protocol"),
      port: z.string().optional().describe("Port or port range (e.g., '22', '80-443', or empty for all)"),
      cidr: z.string().describe("CIDR block (e.g., '0.0.0.0/0' for any, '192.168.1.0/24' for specific subnet)"),
      description: z.string().optional().describe("Rule description"),
      format: responseFormatSchema
    },
    async (args) => {
      const groupId = args.group_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        direction: args.direction,
        protocol: args.protocol,
        cidr: args.cidr
      };

      if (args.port) body.port = args.port;
      if (args.description) body.description = args.description;

      const response = await makeApiRequest<{ rule: FirewallRule }>(
        "POST",
        `/api/v1/firewall/groups/${groupId}/rules`,
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
        content: [{ type: "text" as const, text: `# Firewall Rule Created Successfully\n\n${formatFirewallRule(rule)}` }]
      };
    }
  );

  // Delete firewall rule
  server.tool(
    "timeweb_delete_firewall_rule",
    "Delete a firewall rule from a group",
    {
      group_id: idSchema("Firewall group ID"),
      rule_id: idSchema("Firewall rule ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const groupId = args.group_id as number;
      const ruleId = args.rule_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v1/firewall/groups/${groupId}/rules/${ruleId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_rule_id: ruleId, group_id: groupId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Firewall rule ${ruleId} has been deleted from group ${groupId} successfully.` }]
      };
    }
  );
}
