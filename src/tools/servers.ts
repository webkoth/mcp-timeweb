import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, formatBytes, buildPaginationResponse } from "../services/api.js";
import { paginationSchema, responseFormatSchema, idSchema } from "../schemas/common.js";
import { ResponseFormat, Server, ServerPreset, OsImage, ServerStatistics } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

function formatServer(srv: Server): string {
  return `## ${srv.name} (ID: ${srv.id})
- **Status:** ${srv.status}
- **Location:** ${srv.location}
- **OS:** ${srv.os?.name || "N/A"} ${srv.os?.version || ""}
- **CPU:** ${srv.configurator?.cpu || srv.cpu || "N/A"} cores
- **RAM:** ${srv.configurator?.ram ? formatBytes(srv.configurator.ram * 1024 * 1024) : formatBytes(srv.ram * 1024 * 1024)}
- **Disk:** ${srv.configurator?.disk ? formatBytes(srv.configurator.disk * 1024 * 1024) : "N/A"}
- **Main IP:** ${srv.main_ipv4 || "N/A"}
- **Bandwidth:** ${srv.bandwidth ? formatBytes(srv.bandwidth) + "/s" : "N/A"}
- **Created:** ${srv.created_at}`;
}

export function registerServerTools(server: McpServer): void {
  // List servers
  server.tool(
    "timeweb_list_servers",
    "List all cloud servers in the account with pagination support",
    {
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ servers: Server[]; meta?: { total?: number } }>(
        "GET",
        "/api/v1/servers",
        { limit, offset }
      );

      const servers = response.servers || [];
      const total = response.meta?.total || servers.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ servers, total, limit, offset }, null, 2) }]
        };
      }

      if (servers.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No servers found." }]
        };
      }

      const text = `# Cloud Servers

${buildPaginationResponse(total, limit, offset)}

${servers.map(formatServer).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get server details
  server.tool(
    "timeweb_get_server",
    "Get detailed information about a specific server",
    {
      server_id: idSchema("Server ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const serverId = args.server_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ server: Server }>("GET", `/api/v1/servers/${serverId}`);
      const srv = response.server;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(srv, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: formatServer(srv) }]
      };
    }
  );

  // Create server
  server.tool(
    "timeweb_create_server",
    "Create a new cloud server with specified configuration",
    {
      name: z.string().describe("Server name"),
      os_id: z.number().describe("Operating system ID"),
      preset_id: z.number().optional().describe("Server preset ID (use instead of custom config)"),
      cpu: z.number().optional().describe("Number of CPU cores (if not using preset)"),
      ram: z.number().optional().describe("RAM in MB (if not using preset)"),
      disk: z.number().optional().describe("Disk size in MB (if not using preset)"),
      bandwidth: z.number().optional().describe("Bandwidth in Mbps"),
      location: z.enum(["ru-1", "ru-2", "ru-3", "pl-1", "kz-1", "nl-1"]).optional().describe("Server location"),
      ssh_keys_ids: z.array(z.number()).optional().describe("SSH key IDs to add"),
      is_ddos_guard: z.boolean().optional().describe("Enable DDoS protection"),
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        name: args.name,
        os_id: args.os_id
      };

      if (args.preset_id) {
        body.preset_id = args.preset_id;
      } else {
        if (args.cpu) body.configurator = { ...((body.configurator as object) || {}), cpu: args.cpu };
        if (args.ram) body.configurator = { ...((body.configurator as object) || {}), ram: args.ram };
        if (args.disk) body.configurator = { ...((body.configurator as object) || {}), disk: args.disk };
      }

      if (args.bandwidth) body.bandwidth = args.bandwidth;
      if (args.location) body.location = args.location;
      if (args.ssh_keys_ids) body.ssh_keys_ids = args.ssh_keys_ids;
      if (args.is_ddos_guard !== undefined) body.is_ddos_guard = args.is_ddos_guard;

      const response = await makeApiRequest<{ server: Server }>("POST", "/api/v1/servers", undefined, body);
      const srv = response.server;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(srv, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Server Created Successfully\n\n${formatServer(srv)}` }]
      };
    }
  );

  // Server action (start, stop, reboot, etc.)
  server.tool(
    "timeweb_server_action",
    "Perform an action on a server (start, stop, reboot, reinstall, clone, etc.)",
    {
      server_id: idSchema("Server ID"),
      action: z.enum(["start", "stop", "reboot", "shutdown", "reset_password", "reinstall", "clone", "hard_shutdown"]).describe("Action to perform"),
      format: responseFormatSchema
    },
    async (args) => {
      const serverId = args.server_id as number;
      const action = args.action as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("POST", `/api/v1/servers/${serverId}/${action}`);

      const text = `Action **${action}** initiated successfully on server ${serverId}.`;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, server_id: serverId, action }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Delete server
  server.tool(
    "timeweb_delete_server",
    "Delete a cloud server permanently",
    {
      server_id: idSchema("Server ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const serverId = args.server_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v1/servers/${serverId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_server_id: serverId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Server ${serverId} has been deleted successfully.` }]
      };
    }
  );

  // List OS images
  server.tool(
    "timeweb_list_os",
    "List available operating system images for server creation",
    {
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ os: OsImage[] }>("GET", "/api/v1/os/servers");
      const images = response.os || [];

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(images, null, 2) }]
        };
      }

      if (images.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No OS images found." }]
        };
      }

      const text = `# Available Operating Systems

${images.map(os => `- **${os.name}** (ID: ${os.id}) - ${os.version || "latest"}`).join("\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // List server presets
  server.tool(
    "timeweb_list_server_presets",
    "List available server configuration presets",
    {
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ server_presets: ServerPreset[] }>("GET", "/api/v1/presets/servers");
      const presets = response.server_presets || [];

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(presets, null, 2) }]
        };
      }

      if (presets.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No presets found." }]
        };
      }

      const text = `# Server Presets

${presets.map(p => `## ${p.description || "Preset"} (ID: ${p.id})
- **CPU:** ${p.cpu} cores
- **RAM:** ${formatBytes(p.ram * 1024 * 1024)}
- **Disk:** ${formatBytes(p.disk * 1024 * 1024)} (${p.disk_type})
- **Bandwidth:** ${p.bandwidth} Mbps
- **Price:** ${p.price} ${p.currency}/month
- **Location:** ${p.location}`).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get server logs
  server.tool(
    "timeweb_get_server_logs",
    "Get logs from a cloud server",
    {
      server_id: idSchema("Server ID"),
      limit: z.number().int().min(1).max(1000).optional().describe("Maximum number of log lines to return (default: 100, max: 1000)"),
      order: z.enum(["asc", "desc"]).optional().describe("Sort order (default: desc - newest first)"),
      format: responseFormatSchema
    },
    async (args) => {
      const serverId = args.server_id as number;
      const limit = args.limit || 100;
      const order = args.order || "desc";
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ server_logs: Array<{ logged_at: string; message: string }> }>(
        "GET",
        `/api/v1/servers/${serverId}/logs`,
        { limit, order }
      );

      const logs = response.server_logs || [];

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ logs, server_id: serverId, count: logs.length }, null, 2) }]
        };
      }

      if (logs.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No logs found for server ${serverId}.` }]
        };
      }

      const text = `# Server Logs (Server ${serverId})

**Total entries:** ${logs.length}

\`\`\`
${logs.map(log => `[${log.logged_at}] ${log.message}`).join("\n")}
\`\`\``;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get server statistics
  server.tool(
    "timeweb_get_server_statistics",
    "Get resource usage statistics for a cloud server (CPU, RAM, Disk, Network)",
    {
      server_id: idSchema("Server ID"),
      date_from: z.string().optional().describe("Start date for statistics in ISO format (e.g., '2024-01-01T00:00:00Z')"),
      date_to: z.string().optional().describe("End date for statistics in ISO format"),
      format: responseFormatSchema
    },
    async (args) => {
      const serverId = args.server_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const params: Record<string, unknown> = {};
      if (args.date_from) params.date_from = args.date_from;
      if (args.date_to) params.date_to = args.date_to;

      const response = await makeApiRequest<{ server_statistics: ServerStatistics }>(
        "GET",
        `/api/v1/servers/${serverId}/statistics`,
        Object.keys(params).length > 0 ? params : undefined
      );

      const stats = response.server_statistics;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ statistics: stats, server_id: serverId }, null, 2) }]
        };
      }

      // Calculate averages for markdown output
      const avgCpu = stats.cpu?.length > 0
        ? (stats.cpu.reduce((sum, c) => sum + c.percent, 0) / stats.cpu.length).toFixed(1)
        : "N/A";
      const avgRam = stats.ram?.length > 0
        ? (stats.ram.reduce((sum, r) => sum + r.percent, 0) / stats.ram.length).toFixed(1)
        : "N/A";
      const avgDisk = stats.disk?.length > 0
        ? (stats.disk.reduce((sum, d) => sum + d.percent, 0) / stats.disk.length).toFixed(1)
        : "N/A";

      const latestRam = stats.ram?.[stats.ram.length - 1];
      const latestDisk = stats.disk?.[stats.disk.length - 1];

      const text = `# Server Statistics (Server ${serverId})

## Summary
- **Average CPU Usage:** ${avgCpu}%
- **Average RAM Usage:** ${avgRam}%${latestRam ? ` (${formatBytes(latestRam.used * 1024 * 1024)} / ${formatBytes(latestRam.total * 1024 * 1024)})` : ""}
- **Average Disk Usage:** ${avgDisk}%${latestDisk ? ` (${formatBytes(latestDisk.used * 1024 * 1024)} / ${formatBytes(latestDisk.total * 1024 * 1024)})` : ""}

## Data Points
- **CPU samples:** ${stats.cpu?.length || 0}
- **RAM samples:** ${stats.ram?.length || 0}
- **Disk samples:** ${stats.disk?.length || 0}
- **Network RX samples:** ${stats.network_rx?.length || 0}
- **Network TX samples:** ${stats.network_tx?.length || 0}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );
}
