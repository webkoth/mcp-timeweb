import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, formatBytes } from "../services/api.js";
import { responseFormatSchema, idSchema } from "../schemas/common.js";
import { ResponseFormat, ServerDisk } from "../types.js";

function formatDisk(disk: ServerDisk): string {
  return `## Disk ${disk.id} (${disk.system_name})
- **Size:** ${formatBytes(disk.size * 1024 * 1024)}
- **Used:** ${formatBytes(disk.used * 1024 * 1024)} (${disk.size > 0 ? Math.round(disk.used / disk.size * 100) : 0}%)
- **Type:** ${disk.type.toUpperCase()}
- **Status:** ${disk.status}
- **System Disk:** ${disk.is_system ? "Yes" : "No"}
- **Mounted:** ${disk.is_mounted ? "Yes" : "No"}`;
}

export function registerDiskTools(server: McpServer): void {
  // List server disks
  server.tool(
    "timeweb_list_server_disks",
    "List all disks attached to a server",
    {
      server_id: idSchema("Server ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const serverId = args.server_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ server_disks: ServerDisk[] }>(
        "GET",
        `/api/v1/servers/${serverId}/disks`
      );

      const disks = response.server_disks || [];

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ disks, server_id: serverId }, null, 2) }]
        };
      }

      if (disks.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No disks found for server ${serverId}.` }]
        };
      }

      const totalSize = disks.reduce((sum, d) => sum + d.size, 0);
      const totalUsed = disks.reduce((sum, d) => sum + d.used, 0);

      const text = `# Server Disks (Server ${serverId})

**Total:** ${disks.length} disks | ${formatBytes(totalUsed * 1024 * 1024)} / ${formatBytes(totalSize * 1024 * 1024)} used

${disks.map(formatDisk).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get server disk details
  server.tool(
    "timeweb_get_server_disk",
    "Get detailed information about a specific server disk",
    {
      server_id: idSchema("Server ID"),
      disk_id: idSchema("Disk ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const serverId = args.server_id as number;
      const diskId = args.disk_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ server_disk: ServerDisk }>(
        "GET",
        `/api/v1/servers/${serverId}/disks/${diskId}`
      );
      const disk = response.server_disk;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(disk, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: formatDisk(disk) }]
      };
    }
  );

  // Create server disk
  server.tool(
    "timeweb_create_server_disk",
    "Add a new disk to a server",
    {
      server_id: idSchema("Server ID"),
      size: z.number().int().min(5120).describe("Disk size in MB (minimum 5120 MB = 5 GB)"),
      type: z.enum(["nvme", "ssd", "hdd"]).optional().describe("Disk type (default: nvme)"),
      format: responseFormatSchema
    },
    async (args) => {
      const serverId = args.server_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        size: args.size
      };

      if (args.type) body.type = args.type;

      const response = await makeApiRequest<{ server_disk: ServerDisk }>(
        "POST",
        `/api/v1/servers/${serverId}/disks`,
        undefined,
        body
      );
      const disk = response.server_disk;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(disk, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Disk Created Successfully\n\n${formatDisk(disk)}` }]
      };
    }
  );

  // Update server disk
  server.tool(
    "timeweb_update_server_disk",
    "Update a server disk (resize)",
    {
      server_id: idSchema("Server ID"),
      disk_id: idSchema("Disk ID"),
      size: z.number().int().min(5120).describe("New disk size in MB (can only increase)"),
      format: responseFormatSchema
    },
    async (args) => {
      const serverId = args.server_id as number;
      const diskId = args.disk_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        size: args.size
      };

      const response = await makeApiRequest<{ server_disk: ServerDisk }>(
        "PATCH",
        `/api/v1/servers/${serverId}/disks/${diskId}`,
        undefined,
        body
      );
      const disk = response.server_disk;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(disk, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Disk Updated Successfully\n\n${formatDisk(disk)}` }]
      };
    }
  );

  // Delete server disk
  server.tool(
    "timeweb_delete_server_disk",
    "Delete a disk from a server (cannot delete system disk)",
    {
      server_id: idSchema("Server ID"),
      disk_id: idSchema("Disk ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const serverId = args.server_id as number;
      const diskId = args.disk_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v1/servers/${serverId}/disks/${diskId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_disk_id: diskId, server_id: serverId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Disk ${diskId} has been deleted from server ${serverId} successfully.` }]
      };
    }
  );
}
