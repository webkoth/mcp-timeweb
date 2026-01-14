import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, buildPaginationResponse } from "../services/api.js";
import { paginationSchema, responseFormatSchema, idSchema } from "../schemas/common.js";
import { ResponseFormat, Project } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

function formatProject(project: Project): string {
  return `## ${project.name} (ID: ${project.id})
- **Description:** ${project.description || "None"}
- **Avatar ID:** ${project.avatar_id || "Default"}
- **Default:** ${project.is_default ? "Yes" : "No"}`;
}

export function registerProjectTools(server: McpServer): void {
  // List projects
  server.tool(
    "timeweb_list_projects",
    "List all projects in the account for organizing resources",
    {
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ projects: Project[]; meta?: { total?: number } }>(
        "GET",
        "/api/v1/projects",
        { limit, offset }
      );

      const projects = response.projects || [];
      const total = response.meta?.total || projects.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ projects, total, limit, offset }, null, 2) }]
        };
      }

      if (projects.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No projects found." }]
        };
      }

      const text = `# Projects

${buildPaginationResponse(total, limit, offset)}

${projects.map(formatProject).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get project details
  server.tool(
    "timeweb_get_project",
    "Get detailed information about a specific project",
    {
      project_id: idSchema("Project ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const projectId = args.project_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ project: Project }>("GET", `/api/v1/projects/${projectId}`);
      const project = response.project;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: formatProject(project) }]
      };
    }
  );

  // Create project
  server.tool(
    "timeweb_create_project",
    "Create a new project for organizing resources",
    {
      name: z.string().describe("Project name"),
      description: z.string().optional().describe("Project description"),
      avatar_id: z.string().optional().describe("Avatar image ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        name: args.name
      };

      if (args.description) body.description = args.description;
      if (args.avatar_id) body.avatar_id = args.avatar_id;

      const response = await makeApiRequest<{ project: Project }>("POST", "/api/v1/projects", undefined, body);
      const project = response.project;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Project Created Successfully\n\n${formatProject(project)}` }]
      };
    }
  );

  // Delete project
  server.tool(
    "timeweb_delete_project",
    "Delete a project (resources must be moved or deleted first)",
    {
      project_id: idSchema("Project ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const projectId = args.project_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v1/projects/${projectId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_project_id: projectId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Project ${projectId} has been deleted successfully.` }]
      };
    }
  );
}
