import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, formatBytes, buildPaginationResponse } from "../services/api.js";
import { paginationSchema, responseFormatSchema, idSchema } from "../schemas/common.js";
import { ResponseFormat, App } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

// App Deploy interface
interface AppDeploy {
  id: number;
  status: string;
  created_at: string;
  commit: {
    id: string;
    message: string;
  } | null;
}

// App Statistics interface
interface AppStatistics {
  cpu: { percent: number; timestamp: string }[];
  ram: { percent: number; used: number; total: number; timestamp: string }[];
  disk: { percent: number; used: number; total: number; timestamp: string }[];
  network_rx: { bytes: number; timestamp: string }[];
  network_tx: { bytes: number; timestamp: string }[];
}

function formatApp(app: App): string {
  return `## ${app.name} (ID: ${app.id})
- **Type:** ${app.type}
- **Status:** ${app.status}
- **Framework:** ${app.framework?.name || "N/A"}
- **Repository:** ${app.repository?.full_name || "N/A"}
- **Branch:** ${app.branch || "N/A"}
- **Last Commit:** ${app.commit?.message?.substring(0, 50) || "N/A"}
- **Preset:** ${app.preset?.name || "N/A"} (${app.preset?.cpu || 0} CPU, ${app.preset?.ram ? formatBytes(app.preset.ram * 1024 * 1024) : "N/A"} RAM)
- **Domains:** ${app.domains?.length > 0 ? app.domains.join(", ") : "N/A"}
- **Created:** ${app.created_at}`;
}

function formatDeploy(deploy: AppDeploy): string {
  return `- **Deploy ${deploy.id}:** ${deploy.status} | ${deploy.commit?.message?.substring(0, 40) || "N/A"} | ${deploy.created_at}`;
}

export function registerAppTools(server: McpServer): void {
  // List apps
  server.tool(
    "timeweb_list_apps",
    "List all PaaS applications in the account",
    {
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ apps: App[]; meta?: { total?: number } }>(
        "GET",
        "/api/v1/apps",
        { limit, offset }
      );

      const apps = response.apps || [];
      const total = response.meta?.total || apps.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ apps, total, limit, offset }, null, 2) }]
        };
      }

      if (apps.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No applications found." }]
        };
      }

      const text = `# PaaS Applications

${buildPaginationResponse(total, limit, offset)}

${apps.map(formatApp).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get app details
  server.tool(
    "timeweb_get_app",
    "Get detailed information about a specific PaaS application",
    {
      app_id: idSchema("Application ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const appId = args.app_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ app: App }>("GET", `/api/v1/apps/${appId}`);
      const app = response.app;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(app, null, 2) }]
        };
      }

      let text = formatApp(app);
      if (app.envs && app.envs.length > 0) {
        text += `\n\n### Environment Variables\n${app.envs.map(e => `- \`${e.key}\``).join("\n")}`;
      }

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Create app
  server.tool(
    "timeweb_create_app",
    "Create a new PaaS application from GitHub repository",
    {
      name: z.string().describe("Application name"),
      type: z.enum(["nodejs", "python", "php", "go", "ruby", "static"]).describe("Application type"),
      preset_id: idSchema("Preset ID for resources"),
      repository_id: idSchema("GitHub repository ID (from connected account)"),
      branch: z.string().optional().describe("Git branch to deploy (default: main)"),
      build_command: z.string().optional().describe("Build command (e.g., 'npm run build')"),
      run_command: z.string().optional().describe("Run command (e.g., 'npm start')"),
      envs: z.record(z.string()).optional().describe("Environment variables as key-value pairs"),
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        name: args.name,
        type: args.type,
        preset_id: args.preset_id,
        repository_id: args.repository_id
      };

      if (args.branch) body.branch = args.branch;
      if (args.build_command) body.build_cmd = args.build_command;
      if (args.run_command) body.run_cmd = args.run_command;
      if (args.envs) {
        body.envs = Object.entries(args.envs).map(([key, value]) => ({ key, value }));
      }

      const response = await makeApiRequest<{ app: App }>("POST", "/api/v1/apps", undefined, body);
      const app = response.app;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(app, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Application Created Successfully\n\n${formatApp(app)}` }]
      };
    }
  );

  // Update app
  server.tool(
    "timeweb_update_app",
    "Update a PaaS application settings",
    {
      app_id: idSchema("Application ID"),
      name: z.string().optional().describe("New application name"),
      preset_id: idSchema("New preset ID for resources").optional(),
      branch: z.string().optional().describe("New git branch"),
      build_command: z.string().optional().describe("New build command"),
      run_command: z.string().optional().describe("New run command"),
      envs: z.record(z.string()).optional().describe("Environment variables (replaces all)"),
      format: responseFormatSchema
    },
    async (args) => {
      const appId = args.app_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {};

      if (args.name) body.name = args.name;
      if (args.preset_id) body.preset_id = args.preset_id;
      if (args.branch) body.branch = args.branch;
      if (args.build_command) body.build_cmd = args.build_command;
      if (args.run_command) body.run_cmd = args.run_command;
      if (args.envs) {
        body.envs = Object.entries(args.envs).map(([key, value]) => ({ key, value }));
      }

      const response = await makeApiRequest<{ app: App }>("PATCH", `/api/v1/apps/${appId}`, undefined, body);
      const app = response.app;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(app, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Application Updated Successfully\n\n${formatApp(app)}` }]
      };
    }
  );

  // Delete app
  server.tool(
    "timeweb_delete_app",
    "Delete a PaaS application permanently",
    {
      app_id: idSchema("Application ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const appId = args.app_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v1/apps/${appId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_app_id: appId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Application ${appId} has been deleted successfully.` }]
      };
    }
  );

  // App action (start, stop, restart)
  server.tool(
    "timeweb_app_action",
    "Perform an action on a PaaS application (start, stop, restart)",
    {
      app_id: idSchema("Application ID"),
      action: z.enum(["start", "stop", "restart"]).describe("Action to perform"),
      format: responseFormatSchema
    },
    async (args) => {
      const appId = args.app_id as number;
      const action = args.action as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("POST", `/api/v1/apps/${appId}/action/${action}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, app_id: appId, action }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Action **${action}** initiated on application ${appId}.` }]
      };
    }
  );

  // Get app logs
  server.tool(
    "timeweb_get_app_logs",
    "Get logs from a PaaS application",
    {
      app_id: idSchema("Application ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const appId = args.app_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ logs: string }>(
        "GET",
        `/api/v1/apps/${appId}/logs`
      );

      const logs = response.logs || "";

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ logs, app_id: appId }, null, 2) }]
        };
      }

      if (!logs) {
        return {
          content: [{ type: "text" as const, text: `No logs available for application ${appId}.` }]
        };
      }

      const text = `# Application Logs (App ${appId})

\`\`\`
${logs}
\`\`\``;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get app statistics
  server.tool(
    "timeweb_get_app_statistics",
    "Get resource usage statistics for a PaaS application",
    {
      app_id: idSchema("Application ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const appId = args.app_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ statistics: AppStatistics }>(
        "GET",
        `/api/v1/apps/${appId}/statistics`
      );

      const stats = response.statistics;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ statistics: stats, app_id: appId }, null, 2) }]
        };
      }

      const avgCpu = stats.cpu?.length > 0
        ? (stats.cpu.reduce((sum, c) => sum + c.percent, 0) / stats.cpu.length).toFixed(1)
        : "N/A";
      const avgRam = stats.ram?.length > 0
        ? (stats.ram.reduce((sum, r) => sum + r.percent, 0) / stats.ram.length).toFixed(1)
        : "N/A";

      const text = `# Application Statistics (App ${appId})

- **Average CPU Usage:** ${avgCpu}%
- **Average RAM Usage:** ${avgRam}%
- **CPU samples:** ${stats.cpu?.length || 0}
- **RAM samples:** ${stats.ram?.length || 0}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Deploy app
  server.tool(
    "timeweb_deploy_app",
    "Trigger a new deployment for a PaaS application",
    {
      app_id: idSchema("Application ID"),
      commit_id: z.string().optional().describe("Specific commit ID to deploy (latest if not specified)"),
      format: responseFormatSchema
    },
    async (args) => {
      const appId = args.app_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {};
      if (args.commit_id) body.commit_id = args.commit_id;

      const response = await makeApiRequest<{ deploy: AppDeploy }>(
        "POST",
        `/api/v1/apps/${appId}/deploy`,
        undefined,
        body
      );
      const deploy = response.deploy;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(deploy, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Deployment Started\n\n${formatDeploy(deploy)}\n\n*Use timeweb_list_app_deploys to check progress.*` }]
      };
    }
  );

  // List app deploys
  server.tool(
    "timeweb_list_app_deploys",
    "List deployment history for a PaaS application",
    {
      app_id: idSchema("Application ID"),
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const appId = args.app_id as number;
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ deploys: AppDeploy[]; meta?: { total?: number } }>(
        "GET",
        `/api/v1/apps/${appId}/deploys`,
        { limit, offset }
      );

      const deploys = response.deploys || [];
      const total = response.meta?.total || deploys.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ deploys, total, limit, offset, app_id: appId }, null, 2) }]
        };
      }

      if (deploys.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No deployments found for application ${appId}.` }]
        };
      }

      const text = `# Deployment History (App ${appId})

${buildPaginationResponse(total, limit, offset)}

${deploys.map(formatDeploy).join("\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get deploy logs
  server.tool(
    "timeweb_get_deploy_logs",
    "Get logs for a specific deployment",
    {
      app_id: idSchema("Application ID"),
      deploy_id: idSchema("Deployment ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const appId = args.app_id as number;
      const deployId = args.deploy_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ logs: string }>(
        "GET",
        `/api/v1/apps/${appId}/deploy/${deployId}/logs`
      );

      const logs = response.logs || "";

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ logs, app_id: appId, deploy_id: deployId }, null, 2) }]
        };
      }

      if (!logs) {
        return {
          content: [{ type: "text" as const, text: `No logs available for deployment ${deployId}.` }]
        };
      }

      const text = `# Deployment Logs (Deploy ${deployId})

\`\`\`
${logs}
\`\`\``;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Stop deploy
  server.tool(
    "timeweb_stop_deploy",
    "Stop a running deployment",
    {
      app_id: idSchema("Application ID"),
      deploy_id: idSchema("Deployment ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const appId = args.app_id as number;
      const deployId = args.deploy_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("POST", `/api/v1/apps/${appId}/deploy/${deployId}/stop`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, app_id: appId, deploy_id: deployId, action: "stopped" }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Deployment ${deployId} has been stopped.` }]
      };
    }
  );
}
