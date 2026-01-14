import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, formatBytes, buildPaginationResponse } from "../services/api.js";
import { paginationSchema, responseFormatSchema, idSchema } from "../schemas/common.js";
import { ResponseFormat, S3Storage, S3Preset } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

function formatS3Storage(storage: S3Storage): string {
  return `## ${storage.name} (ID: ${storage.id})
- **Status:** ${storage.status}
- **Location:** ${storage.location}
- **Type:** ${storage.type}
- **Disk Used:** ${formatBytes(storage.disk_stats?.used || 0)} / ${formatBytes(storage.disk_stats?.size || 0)}
- **Endpoint:** ${storage.endpoint || "N/A"}
- **Access Key:** ${storage.access_key || "N/A"}
- **Created:** ${storage.created_at}`;
}

export function registerStorageTools(server: McpServer): void {
  // List S3 storages
  server.tool(
    "timeweb_list_s3_storages",
    "List all S3-compatible object storages in the account",
    {
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ buckets: S3Storage[]; meta?: { total?: number } }>(
        "GET",
        "/api/v1/storages/buckets",
        { limit, offset }
      );

      const storages = response.buckets || [];
      const total = response.meta?.total || storages.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ storages, total, limit, offset }, null, 2) }]
        };
      }

      if (storages.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No S3 storages found." }]
        };
      }

      const text = `# S3 Object Storages

${buildPaginationResponse(total, limit, offset)}

${storages.map(formatS3Storage).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Create S3 storage
  server.tool(
    "timeweb_create_s3_storage",
    "Create a new S3-compatible object storage bucket",
    {
      name: z.string().describe("Storage bucket name (must be unique and follow S3 naming rules)"),
      preset_id: z.number().describe("Storage preset ID"),
      type: z.enum(["private", "public"]).optional().describe("Storage type (default: private)"),
      location: z.enum(["ru-1", "ru-2", "ru-3", "pl-1", "kz-1", "nl-1"]).optional().describe("Storage location"),
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        name: args.name,
        preset_id: args.preset_id
      };

      if (args.type) body.type = args.type;
      if (args.location) body.location = args.location;

      const response = await makeApiRequest<{ bucket: S3Storage }>("POST", "/api/v1/storages/buckets", undefined, body);
      const storage = response.bucket;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(storage, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# S3 Storage Created Successfully\n\n${formatS3Storage(storage)}` }]
      };
    }
  );

  // Delete S3 storage
  server.tool(
    "timeweb_delete_s3_storage",
    "Delete an S3 storage bucket permanently",
    {
      bucket_id: idSchema("S3 bucket ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const bucketId = args.bucket_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v1/storages/buckets/${bucketId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_bucket_id: bucketId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `S3 storage bucket ${bucketId} has been deleted successfully.` }]
      };
    }
  );

  // List S3 presets
  server.tool(
    "timeweb_list_s3_presets",
    "List available S3 storage configuration presets",
    {
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ storages_presets: S3Preset[] }>("GET", "/api/v1/presets/storages");
      const presets = response.storages_presets || [];

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(presets, null, 2) }]
        };
      }

      if (presets.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No S3 storage presets found." }]
        };
      }

      const text = `# S3 Storage Presets

${presets.map(p => `## ${p.description || "Preset"} (ID: ${p.id})
- **Disk:** ${formatBytes(p.disk * 1024 * 1024)}
- **Price:** ${p.price} ${p.currency}/month
- **Location:** ${p.location}`).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );
}
