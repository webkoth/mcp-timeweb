import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { API_BASE_URL, REQUEST_TIMEOUT } from "../constants.js";

// API Client singleton
let apiClient: AxiosInstance | null = null;

/**
 * Initialize the API client with the provided token
 */
export function initializeApiClient(token: string): void {
  apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`
    }
  });
}

/**
 * Get the API client instance
 */
export function getApiClient(): AxiosInstance {
  if (!apiClient) {
    throw new Error("API client not initialized. Set TIMEWEB_CLOUD_TOKEN environment variable.");
  }
  return apiClient;
}

/**
 * Make an API request
 */
export async function makeApiRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  endpoint: string,
  params?: Record<string, unknown>,
  data?: unknown
): Promise<T> {
  const client = getApiClient();

  const config: AxiosRequestConfig = {
    method,
    url: endpoint,
    params,
    data
  };

  const response = await client.request<T>(config);
  return response.data;
}

/**
 * Handle API errors and return user-friendly messages
 */
export function handleApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as { message?: string | string[]; error_code?: string };

      let message = "";
      if (data?.message) {
        message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      }

      switch (status) {
        case 400:
          return `Error: Bad request. ${message || "Please check your parameters."}`;
        case 401:
          return "Error: Authentication failed. Please check your API token.";
        case 403:
          return `Error: Permission denied. ${message || "You don't have access to this resource."}`;
        case 404:
          return `Error: Resource not found. ${message || "Please check the ID is correct."}`;
        case 409:
          return `Error: Conflict. ${message || "The request conflicts with the current state."}`;
        case 423:
          return `Error: Resource locked. ${message || "The resource is locked from this operation."}`;
        case 429:
          return "Error: Rate limit exceeded. Please wait before making more requests.";
        case 500:
          return `Error: Internal server error. ${message || "Please try again later or contact support."}`;
        default:
          return `Error: API request failed with status ${status}. ${message}`;
      }
    } else if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. Please try again.";
    } else if (error.code === "ENOTFOUND") {
      return "Error: Could not connect to Timeweb Cloud API. Check your network connection.";
    }
  }

  return `Error: Unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`;
}

/**
 * Format a date string to human-readable format
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = "RUB"): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency
  }).format(amount);
}

/**
 * Build pagination info string
 */
export function buildPaginationResponse(
  total: number,
  limit: number,
  offset: number
): string {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasMore = offset + limit < total;

  return `Showing ${offset + 1}-${Math.min(offset + limit, total)} of ${total} items (Page ${currentPage}/${totalPages})${hasMore ? "\n*Use offset parameter to see more results.*" : ""}`;
}
