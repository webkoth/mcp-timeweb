import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makeApiRequest } from "../services/api.js";
import { responseFormatSchema } from "../schemas/common.js";
import { ResponseFormat, Location } from "../types.js";

function formatLocation(location: Location): string {
  return `## ${location.description || location.id}
- **ID:** ${location.id}
- **Country:** ${location.country || "N/A"}
- **City:** ${location.city || "N/A"}`;
}

export function registerLocationTools(server: McpServer): void {
  // List locations
  server.tool(
    "timeweb_list_locations",
    "List all available datacenter locations for provisioning resources",
    {
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ locations: Location[] }>("GET", "/api/v2/locations");
      const locations = response.locations || [];

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(locations, null, 2) }]
        };
      }

      if (locations.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No locations found." }]
        };
      }

      const text = `# Available Datacenter Locations

${locations.map(formatLocation).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );
}
