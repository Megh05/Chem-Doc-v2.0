import { type User, type InsertUser, type Template, type InsertTemplate, type Document, type InsertDocument, type ProcessingJob, type InsertProcessingJob } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Template methods
  getTemplate(id: string): Promise<Template | undefined>;
  getTemplates(): Promise<Template[]>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, template: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(id: string): Promise<boolean>;
  
  // Document methods
  getDocument(id: string): Promise<Document | undefined>;
  getDocuments(): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  deleteDocument(id: string): Promise<boolean>;
  
  // Processing job methods
  getProcessingJob(id: string): Promise<ProcessingJob | undefined>;
  getProcessingJobs(): Promise<ProcessingJob[]>;
  createProcessingJob(job: InsertProcessingJob): Promise<ProcessingJob>;
  updateProcessingJob(id: string, job: Partial<InsertProcessingJob>): Promise<ProcessingJob | undefined>;
  deleteProcessingJob(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private templates: Map<string, Template>;
  private documents: Map<string, Document>;
  private processingJobs: Map<string, ProcessingJob>;

  constructor() {
    this.users = new Map();
    this.templates = new Map();
    this.documents = new Map();
    this.processingJobs = new Map();
    
    // Initialize with sample templates
    this.initializeSampleData();
  }

  private initializeSampleData() {
    const sampleTemplates: Template[] = [
      {
        id: randomUUID(),
        name: "Standard CoA Template v2.1",
        type: "CoA",
        fileName: "standard_coa_template_v2.1.docx",
        fileSize: 45000,
        placeholders: [
          "product_name", "batch_number", "manufacturing_date", "expiration_date",
          "purity", "test_results", "supplier_name", "lot_number", "cas_number",
          "molecular_formula", "molecular_weight", "appearance", "ph_value",
          "moisture_content", "heavy_metals", "residual_solvents", "microbiological_tests",
          "storage_conditions", "shelf_life", "quality_manager", "release_date"
        ],
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      },
      {
        id: randomUUID(),
        name: "TDS Template v1.8",
        type: "TDS",
        fileName: "tds_template_v1.8.docx",
        fileSize: 38000,
        placeholders: [
          "product_name", "chemical_name", "cas_number", "molecular_formula",
          "molecular_weight", "appearance", "melting_point", "boiling_point",
          "density", "solubility", "flash_point", "vapor_pressure", "stability",
          "hazard_classification", "safety_precautions", "storage_requirements",
          "handling_instructions", "first_aid_measures"
        ],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
      {
        id: randomUUID(),
        name: "MDMS Template v1.5",
        type: "MDMS",
        fileName: "mdms_template_v1.5.docx",
        fileSize: 42000,
        placeholders: [
          "product_name", "supplier_name", "material_code", "revision_number",
          "issue_date", "chemical_composition", "physical_properties",
          "mechanical_properties", "thermal_properties", "electrical_properties",
          "environmental_data", "processing_guidelines", "quality_standards",
          "regulatory_compliance", "certifications"
        ],
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      }
    ];

    sampleTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    return this.templates.get(id);
  }

  async getTemplates(): Promise<Template[]> {
    return Array.from(this.templates.values());
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const id = randomUUID();
    const now = new Date();
    const template: Template = { ...insertTemplate, id, createdAt: now, updatedAt: now };
    this.templates.set(id, template);
    return template;
  }

  async updateTemplate(id: string, updateData: Partial<InsertTemplate>): Promise<Template | undefined> {
    const existing = this.templates.get(id);
    if (!existing) return undefined;
    
    const updated: Template = { ...existing, ...updateData, updatedAt: new Date() };
    this.templates.set(id, updated);
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    return this.templates.delete(id);
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const document: Document = { ...insertDocument, id, createdAt: new Date() };
    this.documents.set(id, document);
    return document;
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  async getProcessingJob(id: string): Promise<ProcessingJob | undefined> {
    return this.processingJobs.get(id);
  }

  async getProcessingJobs(): Promise<ProcessingJob[]> {
    return Array.from(this.processingJobs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createProcessingJob(insertJob: InsertProcessingJob): Promise<ProcessingJob> {
    const id = randomUUID();
    const job: ProcessingJob = { 
      ...insertJob, 
      id, 
      status: insertJob.status || 'pending',
      ocrText: insertJob.ocrText || null,
      extractedData: insertJob.extractedData || null,
      accuracy: insertJob.accuracy || null,
      tokensExtracted: insertJob.tokensExtracted || null,
      processingTime: insertJob.processingTime || null,
      errorMessage: insertJob.errorMessage || null,
      createdAt: new Date(), 
      completedAt: null 
    };
    this.processingJobs.set(id, job);
    return job;
  }

  async updateProcessingJob(id: string, updateData: Partial<InsertProcessingJob>): Promise<ProcessingJob | undefined> {
    const existing = this.processingJobs.get(id);
    if (!existing) return undefined;
    
    const updated: ProcessingJob = { 
      ...existing, 
      ...updateData,
      completedAt: updateData.status === 'completed' || updateData.status === 'failed' 
        ? new Date() 
        : existing.completedAt
    };
    this.processingJobs.set(id, updated);
    return updated;
  }

  async deleteProcessingJob(id: string): Promise<boolean> {
    return this.processingJobs.delete(id);
  }
}

export const storage = new MemStorage();
