import { z } from "zod";
import { ResponseFormat } from "../types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

// Common pagination schema fields (for spreading into tool schemas)
export const paginationSchema = {
  limit: z.number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .optional()
    .describe("Maximum number of results to return (1-100)"),
  offset: z.number()
    .int()
    .min(0)
    .optional()
    .describe("Number of results to skip for pagination")
};

// Common response format schema field
export const responseFormatSchema = z.nativeEnum(ResponseFormat)
  .optional()
  .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable");

// Helper to create ID schema with custom description
export function idSchema(description: string) {
  return z.number().int().positive().describe(description);
}

// Helper to create string ID schema with custom description
export function stringIdSchema(description: string) {
  return z.string().min(1).describe(description);
}

// Common pagination schema object
export const PaginationSchema = z.object({
  limit: z.number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .default(DEFAULT_LIMIT)
    .describe("Maximum number of results to return (1-100)"),
  offset: z.number()
    .int()
    .min(0)
    .default(0)
    .describe("Number of results to skip for pagination")
}).strict();

// Common response format schema object
export const ResponseFormatSchema = z.object({
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable")
}).strict();

// Combined pagination and response format
export const PaginatedResponseSchema = PaginationSchema.merge(ResponseFormatSchema);

// ID parameter schema
export const IdParamSchema = z.object({
  id: z.number()
    .int()
    .positive()
    .describe("Resource ID")
}).strict();

// String ID parameter schema (for UUIDs)
export const StringIdParamSchema = z.object({
  id: z.string()
    .min(1)
    .describe("Resource ID")
}).strict();

// Search schema
export const SearchSchema = z.object({
  search: z.string()
    .min(1)
    .max(200)
    .optional()
    .describe("Search string to filter results")
}).strict();

// Sort schema
export const SortSchema = z.object({
  sort: z.string()
    .optional()
    .describe("Field to sort by (prefix with '-' for descending order)")
}).strict();

// Type inference helpers
export type PaginationInput = z.infer<typeof PaginationSchema>;
export type ResponseFormatInput = z.infer<typeof ResponseFormatSchema>;
export type PaginatedResponseInput = z.infer<typeof PaginatedResponseSchema>;
export type IdParamInput = z.infer<typeof IdParamSchema>;
export type StringIdParamInput = z.infer<typeof StringIdParamSchema>;
