import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { makeApiRequest, buildPaginationResponse } from "../services/api.js";
import { paginationSchema, responseFormatSchema, idSchema } from "../schemas/common.js";
import { ResponseFormat, K8sCluster, K8sVersion } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

function formatK8sCluster(cluster: K8sCluster): string {
  return `## ${cluster.name} (ID: ${cluster.id})
- **Status:** ${cluster.status}
- **Description:** ${cluster.description || "N/A"}
- **Version:** ${cluster.k8s_version}
- **Network Driver:** ${cluster.network_driver}
- **Ingress:** ${cluster.ingress ? "Enabled" : "Disabled"}
- **CPU:** ${cluster.cpu} cores
- **RAM:** ${cluster.ram} MB
- **Disk:** ${cluster.disk} MB
- **Preset ID:** ${cluster.preset_id}
- **Created:** ${cluster.created_at}`;
}

export function registerKubernetesTools(server: McpServer): void {
  // List K8s clusters
  server.tool(
    "timeweb_list_k8s_clusters",
    "List all Kubernetes clusters in the account",
    {
      ...paginationSchema,
      format: responseFormatSchema
    },
    async (args) => {
      const limit = Math.min((args.limit as number) || DEFAULT_LIMIT, MAX_LIMIT);
      const offset = (args.offset as number) || 0;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ clusters: K8sCluster[]; meta?: { total?: number } }>(
        "GET",
        "/api/v1/k8s/clusters",
        { limit, offset }
      );

      const clusters = response.clusters || [];
      const total = response.meta?.total || clusters.length;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ clusters, total, limit, offset }, null, 2) }]
        };
      }

      if (clusters.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No Kubernetes clusters found." }]
        };
      }

      const text = `# Kubernetes Clusters

${buildPaginationResponse(total, limit, offset)}

${clusters.map(formatK8sCluster).join("\n\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );

  // Get K8s cluster details
  server.tool(
    "timeweb_get_k8s_cluster",
    "Get detailed information about a specific Kubernetes cluster",
    {
      cluster_id: idSchema("Kubernetes cluster ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const clusterId = args.cluster_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ cluster: K8sCluster }>("GET", `/api/v1/k8s/clusters/${clusterId}`);
      const cluster = response.cluster;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(cluster, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: formatK8sCluster(cluster) }]
      };
    }
  );

  // Create K8s cluster
  server.tool(
    "timeweb_create_k8s_cluster",
    "Create a new Kubernetes cluster",
    {
      name: z.string().describe("Cluster name"),
      k8s_version: z.string().optional().describe("Kubernetes version (e.g., '1.28')"),
      preset_id: z.number().describe("Node preset ID"),
      worker_groups: z.array(z.object({
        name: z.string().describe("Worker group name"),
        preset_id: z.number().describe("Preset ID for workers"),
        node_count: z.number().describe("Number of worker nodes")
      })).optional().describe("Worker node groups"),
      network_driver: z.enum(["flannel", "cilium"]).optional().describe("Network driver"),
      ingress: z.boolean().optional().describe("Enable ingress controller"),
      description: z.string().optional().describe("Cluster description"),
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const body: Record<string, unknown> = {
        name: args.name,
        preset_id: args.preset_id
      };

      if (args.k8s_version) body.k8s_version = args.k8s_version;
      if (args.worker_groups) body.worker_groups = args.worker_groups;
      if (args.network_driver) body.network_driver = args.network_driver;
      if (args.ingress !== undefined) body.ingress = args.ingress;
      if (args.description) body.description = args.description;

      const response = await makeApiRequest<{ cluster: K8sCluster }>("POST", "/api/v1/k8s/clusters", undefined, body);
      const cluster = response.cluster;

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(cluster, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `# Kubernetes Cluster Created Successfully\n\n${formatK8sCluster(cluster)}` }]
      };
    }
  );

  // Delete K8s cluster
  server.tool(
    "timeweb_delete_k8s_cluster",
    "Delete a Kubernetes cluster permanently",
    {
      cluster_id: idSchema("Kubernetes cluster ID"),
      format: responseFormatSchema
    },
    async (args) => {
      const clusterId = args.cluster_id as number;
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      await makeApiRequest("DELETE", `/api/v1/k8s/clusters/${clusterId}`);

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, deleted_cluster_id: clusterId }, null, 2) }]
        };
      }

      return {
        content: [{ type: "text" as const, text: `Kubernetes cluster ${clusterId} has been deleted successfully.` }]
      };
    }
  );

  // Get kubeconfig
  server.tool(
    "timeweb_get_kubeconfig",
    "Get kubeconfig file for a Kubernetes cluster",
    {
      cluster_id: idSchema("Kubernetes cluster ID")
    },
    async (args) => {
      const clusterId = args.cluster_id as number;

      const response = await makeApiRequest<{ config: string }>("GET", `/api/v1/k8s/clusters/${clusterId}/kubeconfig`);

      return {
        content: [{ type: "text" as const, text: `# Kubeconfig for Cluster ${clusterId}\n\n\`\`\`yaml\n${response.config}\n\`\`\`` }]
      };
    }
  );

  // List K8s versions
  server.tool(
    "timeweb_list_k8s_versions",
    "List available Kubernetes versions",
    {
      format: responseFormatSchema
    },
    async (args) => {
      const format = (args.format as ResponseFormat) || ResponseFormat.MARKDOWN;

      const response = await makeApiRequest<{ k8s_versions: K8sVersion[] }>("GET", "/api/v1/k8s/k8s_versions");
      const versions = response.k8s_versions || [];

      if (format === ResponseFormat.JSON) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(versions, null, 2) }]
        };
      }

      if (versions.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No Kubernetes versions found." }]
        };
      }

      const text = `# Available Kubernetes Versions

${versions.map(v => `- **${v.version}** ${v.is_default ? "(Default)" : ""}`).join("\n")}`;

      return {
        content: [{ type: "text" as const, text }]
      };
    }
  );
}
