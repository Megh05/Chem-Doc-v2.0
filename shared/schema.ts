import { z } from "zod";

// Type definitions for our entities
export interface User {
  id: string;
  username: string;
  password: string;
}

export interface Template {
  id: string;
  name: string;
  type: string; // 'CoA', 'TDS', 'MDMS'
  fileName: string;
  fileSize: number;
  placeholders: string[]; // array of placeholder names
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  createdAt: Date;
}

export interface ProcessingJob {
  id: string;
  documentId: string;
  templateId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  ocrText?: string | null;
  extractedData?: Record<string, any> | null; // key-value pairs
  accuracy?: number | null; // percentage
  tokensExtracted?: number | null;
  processingTime?: number | null; // seconds
  errorMessage?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
}

export interface SavedDocument {
  id: string;
  name: string;
  templateId: string;
  originalDocumentId: string;
  finalData: Record<string, any>;
  createdAt: Date;
}

// Zod schemas for validation
export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const insertTemplateSchema = z.object({
  name: z.string(),
  type: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  placeholders: z.array(z.string()),
});

export const insertDocumentSchema = z.object({
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  filePath: z.string(),
});

export const insertProcessingJobSchema = z.object({
  documentId: z.string(),
  templateId: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  ocrText: z.string().nullable().optional(),
  extractedData: z.record(z.any()).nullable().optional(),
  accuracy: z.number().nullable().optional(),
  tokensExtracted: z.number().nullable().optional(),
  processingTime: z.number().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
});

export const insertSavedDocumentSchema = z.object({
  name: z.string(),
  templateId: z.string(),
  originalDocumentId: z.string(),
  finalData: z.record(z.any()),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertProcessingJob = z.infer<typeof insertProcessingJobSchema>;
export type InsertSavedDocument = z.infer<typeof insertSavedDocumentSchema>;
