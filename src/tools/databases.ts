import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, formatBytes, buildPaginationResponse } from "../services/api.js";
import { paginationSchema, responseFormatSchema, idSchema } from "../schemas/common.js";
import { ResponseFormat, DatabaseCluster, DatabasePreset } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

function formatDatabase(db: DatabaseCluster): string {
  return `## ${db.name} (ID: ${db.id})
- **Type:** ${db.type}
- **Status:** ${db.status}
- **Location:** ${db.location}
- **Host:** ${db.host || "N/A"}
- **Port:** ${db.port || "N/A"}
- **Admin Login:** ${db.admin?.login || "N/A"}
- **Created:** ${db.created_at}`;
}

export function registerDatabaseTools(server: McpServer): void {
  // List databases
  server.tool(
    "timeweb_list_databases",
    "List all database clusters in the account",
    {
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ dbs: DatabaseCluster[]; meta?: { total?: number } }>(
        "GET",
        "/api/v1/dbs",
        { limit, offset }
      );

      const databases = response.dbs || [];
      const total = response.meta?.total || databases.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ databases, total, limit, offset }, null, 2) }]
        };
      }

      if (databases.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No databases found." }]
        };
      }

      const text = `# Database Clusters

${buildPaginationResponse(total, limit, offset)}

${databases.map(formatDatabase).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get database details
  server.tool(
    "timeweb_get_database",
    "Get detailed information about a specific database cluster",
    {
      db_id: idSchema("Database cluster ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const dbId = args.db_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ db: DatabaseCluster }>("GET", `/api/v1/dbs/${dbId}`);
      const db = response.db;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(db, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: formatDatabase(db) }]
      };
    }
  );

  // Create database
  server.tool(
    "timeweb_create_database",
    "Create a new database cluster",
    {
      name: z.string().describe("Database name"),
      type: z.enum(["mysql", "mysql5", "postgres", "redis", "mongodb", "clickhouse"]).describe("Database type"),
      preset_id: z.number().describe("Database preset ID"),
      login: z.string().optional().describe("Admin login (default: admin)"),
      password: z.string().optional().describe("Admin password (auto-generated if not provided)"),
      hash_type: z.enum(["caching_sha2", "mysql_native"]).optional().describe("MySQL password hash type"),
      location: z.enum(["ru-1", "ru-2", "ru-3", "pl-1", "kz-1", "nl-1"]).optional().describe("Database location"),
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        name: args.name,
        type: args.type,
        preset_id: args.preset_id
      };

      if (args.login) body.login = args.login;
      if (args.password) body.password = args.password;
      if (args.hash_type) body.hash_type = args.hash_type;
      if (args.location) body.location = args.location;

      const response = await makeApiRequest<{ db: DatabaseCluster }>("POST", "/api/v1/dbs", undefined, body);
      const db = response.db;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(db, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Database Created Successfully\n\n${formatDatabase(db)}` }]
      };
    }
  );

  // Delete database
  server.tool(
    "timeweb_delete_database",
    "Delete a database cluster permanently",
    {
      db_id: idSchema("Database cluster ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const dbId = args.db_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v1/dbs/${dbId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_db_id: dbId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Database cluster ${dbId} has been deleted successfully.` }]
      };
    }
  );

  // List database presets
  server.tool(
    "timeweb_list_database_presets",
    "List available database configuration presets",
    {
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ databases_presets: DatabasePreset[] }>("GET", "/api/v1/presets/dbs");
      const presets = response.databases_presets || [];

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(presets, null, 2) }]
        };
      }

      if (presets.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No database presets found." }]
        };
      }

      const text = `# Database Presets

${presets.map(p => `## ${p.description || "Preset"} (ID: ${p.id})
- **Type:** ${p.type}
- **CPU:** ${p.cpu} cores
- **RAM:** ${formatBytes(p.ram * 1024 * 1024)}
- **Disk:** ${formatBytes(p.disk * 1024 * 1024)}
- **Price:** ${p.price} ${p.currency}/month
- **Location:** ${p.location}`).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );
}
