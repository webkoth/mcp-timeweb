import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, buildPaginationResponse } from "../services/api.js";
import { paginationSchema, responseFormatSchema, idSchema } from "../schemas/common.js";
import { ResponseFormat, SshKey } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

function formatSshKey(key: SshKey): string {
  return `## ${key.name} (ID: ${key.id})
- **Fingerprint:** ${key.fingerprint || "N/A"}
- **Used By:** ${key.used_by?.length || 0} servers
- **Created:** ${key.created_at}`;
}

export function registerSshKeyTools(server: McpServer): void {
  // List SSH keys
  server.tool(
    "timeweb_list_ssh_keys",
    "List all SSH keys in the account",
    {
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ ssh_keys: SshKey[]; meta?: { total?: number } }>(
        "GET",
        "/api/v1/ssh-keys",
        { limit, offset }
      );

      const keys = response.ssh_keys || [];
      const total = response.meta?.total || keys.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ ssh_keys: keys, total, limit, offset }, null, 2) }]
        };
      }

      if (keys.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No SSH keys found." }]
        };
      }

      const text = `# SSH Keys

${buildPaginationResponse(total, limit, offset)}

${keys.map(formatSshKey).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get SSH key details
  server.tool(
    "timeweb_get_ssh_key",
    "Get detailed information about a specific SSH key",
    {
      ssh_key_id: idSchema("SSH key ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const keyId = args.ssh_key_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ ssh_key: SshKey }>("GET", `/api/v1/ssh-keys/${keyId}`);
      const key = response.ssh_key;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(key, null, 2) }]
        };
      }

      let text = formatSshKey(key);
      if (key.body) {
        text += `\n\n**Public Key:**\n\`\`\`\n${key.body}\n\`\`\``;
      }

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Create SSH key
  server.tool(
    "timeweb_create_ssh_key",
    "Create a new SSH key",
    {
      name: z.string().describe("SSH key name"),
      body: z.string().describe("Public SSH key content (e.g., 'ssh-rsa AAAAB3...')"),
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body = {
        name: args.name,
        body: args.body
      };

      const response = await makeApiRequest<{ ssh_key: SshKey }>("POST", "/api/v1/ssh-keys", undefined, body);
      const key = response.ssh_key;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(key, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# SSH Key Created Successfully\n\n${formatSshKey(key)}` }]
      };
    }
  );

  // Delete SSH key
  server.tool(
    "timeweb_delete_ssh_key",
    "Delete an SSH key",
    {
      ssh_key_id: idSchema("SSH key ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const keyId = args.ssh_key_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v1/ssh-keys/${keyId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_ssh_key_id: keyId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `SSH key ${keyId} has been deleted successfully.` }]
      };
    }
  );

  // Add SSH key to server
  server.tool(
    "timeweb_add_ssh_key_to_server",
    "Add an SSH key to a server for authentication",
    {
      server_id: idSchema("Server ID"),
      ssh_key_id: idSchema("SSH key ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const serverId = args.server_id as number;
      const sshKeyId = args.ssh_key_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("POST", `/api/v1/servers/${serverId}/ssh-keys`, undefined, { ssh_key_id: sshKeyId });

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, server_id: serverId, ssh_key_id: sshKeyId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `SSH key ${sshKeyId} has been added to server ${serverId} successfully.` }]
      };
    }
  );
}
