#!/usr/bin/env node
/**
 * Timeweb Cloud MCP Server
 *
 * This server provides tools to interact with Timeweb Cloud API, including:
 * - Cloud Servers management
 * - Database clusters (MySQL, PostgreSQL, Redis, MongoDB)
 * - Kubernetes clusters
 * - S3 Object Storage
 * - Domains and DNS management
 * - SSH Keys and Floating IPs
 * - Projects and Locations
 * - Account and billing information
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeApiClient } from "./services/api.js";

// Import tool registrations
import { registerAccountTools } from "./tools/account.js";
import { registerServerTools } from "./tools/servers.js";
import { registerDatabaseTools } from "./tools/databases.js";
import { registerKubernetesTools } from "./tools/kubernetes.js";
import { registerStorageTools } from "./tools/storage.js";
import { registerDomainTools } from "./tools/domains.js";
import { registerSshKeyTools } from "./tools/ssh-keys.js";
import { registerFloatingIpTools } from "./tools/floating-ips.js";
import { registerLocationTools } from "./tools/locations.js";
import { registerProjectTools } from "./tools/projects.js";

// Server version
const VERSION = "1.0.0";

/**
 * Main function to start the MCP server
 */
async function main(): Promise<void> {
  // Check for API token
  const token = process.env.TIMEWEB_CLOUD_TOKEN;

  if (!token) {
    console.error("ERROR: TIMEWEB_CLOUD_TOKEN environment variable is required.");
    console.error("");
    console.error("To get your API token:");
    console.error("1. Go to https://timeweb.cloud/my/api-keys");
    console.error("2. Create a new API token");
    console.error("3. Set it as environment variable:");
    console.error("   export TIMEWEB_CLOUD_TOKEN='your-token-here'");
    console.error("");
    process.exit(1);
  }

  // Initialize API client
  initializeApiClient(token);

  // Create MCP server
  const server = new McpServer({
    name: "timeweb-mcp-server",
    version: VERSION
  });

  // Register all tools
  registerAccountTools(server);
  registerServerTools(server);
  registerDatabaseTools(server);
  registerKubernetesTools(server);
  registerStorageTools(server);
  registerDomainTools(server);
  registerSshKeyTools(server);
  registerFloatingIpTools(server);
  registerLocationTools(server);
  registerProjectTools(server);

  // Start the server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Timeweb Cloud MCP Server v${VERSION} started`);
  console.error("Available tool categories:");
  console.error("  - Account & Billing (timeweb_get_account_status, timeweb_get_finances, ...)");
  console.error("  - Cloud Servers (timeweb_list_servers, timeweb_create_server, ...)");
  console.error("  - Databases (timeweb_list_databases, timeweb_create_database, ...)");
  console.error("  - Kubernetes (timeweb_list_k8s_clusters, timeweb_create_k8s_cluster, ...)");
  console.error("  - S3 Storage (timeweb_list_s3_storages, timeweb_create_s3_storage, ...)");
  console.error("  - Domains (timeweb_list_domains, timeweb_list_dns_records, ...)");
  console.error("  - SSH Keys (timeweb_list_ssh_keys, timeweb_create_ssh_key, ...)");
  console.error("  - Floating IPs (timeweb_list_floating_ips, timeweb_bind_floating_ip, ...)");
  console.error("  - Locations (timeweb_list_locations)");
  console.error("  - Projects (timeweb_list_projects, timeweb_create_project, ...)");
}

// Run the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
