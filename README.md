# Timeweb MCP Server

Model Context Protocol (MCP) server for [Timeweb Cloud](https://timeweb.cloud) API integration.

![npm](https://img.shields.io/npm/v/timeweb-mcp-server)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- Full Timeweb Cloud API support
- Cloud servers management (create, delete, start, stop, reboot)
- Database clusters (PostgreSQL, MySQL, MongoDB, Redis, ClickHouse)
- Kubernetes clusters
- S3-compatible object storage
- Domains and DNS management
- SSH keys management
- Floating IPs
- Account and billing info

## Installation

### Via npx (recommended)

```bash
npx timeweb-mcp-server
```

### Global install

```bash
npm install -g timeweb-mcp-server
timeweb-mcp-server
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TIMEWEB_CLOUD_TOKEN` | API token from Timeweb Cloud panel | Yes |

Get your API token at: https://timeweb.cloud/my/api-keys

### Claude Code Integration

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "timeweb": {
      "command": "npx",
      "args": ["-y", "timeweb-mcp-server"],
      "env": {
        "TIMEWEB_CLOUD_TOKEN": "your-api-token"
      }
    }
  }
}
```

Or use with Claude Code plugin [tw-deploy](https://github.com/webkoth/claude-code-plugins).

## Available Tools

### Servers
- `timeweb_list_servers` - List all cloud servers
- `timeweb_get_server` - Get server details
- `timeweb_create_server` - Create new server
- `timeweb_delete_server` - Delete server
- `timeweb_server_action` - Start/stop/reboot server

### Databases
- `timeweb_list_databases` - List database clusters
- `timeweb_get_database` - Get database details
- `timeweb_create_database` - Create database cluster
- `timeweb_delete_database` - Delete database cluster

### Kubernetes
- `timeweb_list_k8s_clusters` - List K8s clusters
- `timeweb_get_k8s_cluster` - Get cluster details
- `timeweb_create_k8s_cluster` - Create K8s cluster
- `timeweb_delete_k8s_cluster` - Delete cluster
- `timeweb_get_kubeconfig` - Get kubeconfig

### S3 Storage
- `timeweb_list_s3_storages` - List S3 buckets
- `timeweb_create_s3_storage` - Create S3 bucket
- `timeweb_delete_s3_storage` - Delete S3 bucket

### Domains & DNS
- `timeweb_list_domains` - List domains
- `timeweb_get_domain` - Get domain details
- `timeweb_check_domain` - Check domain availability
- `timeweb_list_dns_records` - List DNS records
- `timeweb_create_dns_record` - Create DNS record
- `timeweb_delete_dns_record` - Delete DNS record

### SSH Keys
- `timeweb_list_ssh_keys` - List SSH keys
- `timeweb_get_ssh_key` - Get SSH key details
- `timeweb_create_ssh_key` - Create SSH key
- `timeweb_delete_ssh_key` - Delete SSH key
- `timeweb_add_ssh_key_to_server` - Add SSH key to server

### Floating IPs
- `timeweb_list_floating_ips` - List floating IPs
- `timeweb_get_floating_ip` - Get floating IP details
- `timeweb_create_floating_ip` - Create floating IP
- `timeweb_delete_floating_ip` - Delete floating IP
- `timeweb_bind_floating_ip` - Bind IP to resource
- `timeweb_unbind_floating_ip` - Unbind IP

### Account
- `timeweb_get_account_status` - Account info
- `timeweb_get_finances` - Balance and costs
- `timeweb_get_service_prices` - Pricing info

### Presets & Locations
- `timeweb_list_server_presets` - Server configurations
- `timeweb_list_database_presets` - Database configurations
- `timeweb_list_s3_presets` - S3 configurations
- `timeweb_list_os` - Available OS images
- `timeweb_list_locations` - Datacenter locations
- `timeweb_list_k8s_versions` - K8s versions

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

Minas Sarkisyan ([@webkoth](https://github.com/webkoth))
