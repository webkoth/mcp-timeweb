import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, formatBytes, buildPaginationResponse } from "../services/api.js";
import { paginationSchema, responseFormatSchema, stringIdSchema, idSchema } from "../schemas/common.js";
import { ResponseFormat } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

// Custom Image interface
interface CustomImage {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  size: number;
  location: string;
  os: {
    id: number;
    name: string;
    version: string | null;
  } | null;
  disk_id: number | null;
  progress: number;
}

function formatImage(img: CustomImage): string {
  return `## ${img.name} (ID: ${img.id})
- **Status:** ${img.status}${img.progress < 100 ? ` (${img.progress}%)` : ""}
- **Size:** ${formatBytes(img.size)}
- **Location:** ${img.location}
- **OS:** ${img.os?.name || "N/A"} ${img.os?.version || ""}
- **Description:** ${img.description || "N/A"}
- **Created:** ${img.created_at}`;
}

export function registerImageTools(server: McpServer): void {
  // List images
  server.tool(
    "timeweb_list_images",
    "List all custom OS images in the account",
    {
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ images: CustomImage[]; meta?: { total?: number } }>(
        "GET",
        "/api/v1/images",
        { limit, offset }
      );

      const images = response.images || [];
      const total = response.meta?.total || images.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ images, total, limit, offset }, null, 2) }]
        };
      }

      if (images.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No custom images found." }]
        };
      }

      const text = `# Custom OS Images

${buildPaginationResponse(total, limit, offset)}

${images.map(formatImage).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get image details
  server.tool(
    "timeweb_get_image",
    "Get detailed information about a specific custom image",
    {
      image_id: stringIdSchema("Image ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const imageId = args.image_id as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ image: CustomImage }>("GET", `/api/v1/images/${imageId}`);
      const image = response.image;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(image, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: formatImage(image) }]
      };
    }
  );

  // Create image from server disk
  server.tool(
    "timeweb_create_image",
    "Create a custom OS image from a server disk (snapshot)",
    {
      disk_id: idSchema("Server disk ID to create image from"),
      name: z.string().describe("Image name"),
      description: z.string().optional().describe("Image description"),
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        disk_id: args.disk_id,
        name: args.name
      };

      if (args.description) body.description = args.description;

      const response = await makeApiRequest<{ image: CustomImage }>("POST", "/api/v1/images", undefined, body);
      const image = response.image;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(image, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Image Creation Started\n\n${formatImage(image)}\n\n*Note: Image creation may take several minutes. Check status with timeweb_get_image.*` }]
      };
    }
  );

  // Update image
  server.tool(
    "timeweb_update_image",
    "Update a custom image name or description",
    {
      image_id: stringIdSchema("Image ID"),
      name: z.string().optional().describe("New image name"),
      description: z.string().optional().describe("New image description"),
      format: responseFormatSchema
    },
    async (args) => {
      const imageId = args.image_id as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {};

      if (args.name) body.name = args.name;
      if (args.description) body.description = args.description;

      const response = await makeApiRequest<{ image: CustomImage }>("PATCH", `/api/v1/images/${imageId}`, undefined, body);
      const image = response.image;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(image, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Image Updated Successfully\n\n${formatImage(image)}` }]
      };
    }
  );

  // Delete image
  server.tool(
    "timeweb_delete_image",
    "Delete a custom OS image permanently",
    {
      image_id: stringIdSchema("Image ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const imageId = args.image_id as string;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v1/images/${imageId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_image_id: imageId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Image ${imageId} has been deleted successfully.` }]
      };
    }
  );
}
