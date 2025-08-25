import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}
import { storage } from "./storage";
import { loadConfig, saveConfig, resetConfig } from "./config";
import { insertTemplateSchema, insertDocumentSchema, insertProcessingJobSchema } from "@shared/schema";
import { processDocumentWithMistral } from "../client/src/lib/mistral";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ 
  dest: uploadDir,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Templates routes
  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch template" });
    }
  });

  app.post("/api/templates", upload.single('file'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const templateData = {
        name: req.body.name,
        type: req.body.type,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        placeholders: req.body.placeholders ? JSON.parse(req.body.placeholders) : []
      };

      const validatedData = insertTemplateSchema.parse(templateData);
      const template = await storage.createTemplate(validatedData);
      
      res.status(201).json(template);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to create template", error: error.message });
    }
  });

  // Documents routes
  app.get("/api/documents", async (req, res) => {
    try {
      const documents = await storage.getDocuments();
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents", upload.single('file'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const documentData = {
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.path
      };

      const validatedData = insertDocumentSchema.parse(documentData);
      const document = await storage.createDocument(validatedData);
      
      res.status(201).json(document);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to upload document", error: error.message });
    }
  });

  // Processing jobs routes
  app.get("/api/processing-jobs", async (req, res) => {
    try {
      const jobs = await storage.getProcessingJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch processing jobs" });
    }
  });

  app.get("/api/processing-jobs/:id", async (req, res) => {
    try {
      const job = await storage.getProcessingJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Processing job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch processing job" });
    }
  });

  app.post("/api/processing-jobs", async (req, res) => {
    try {
      const jobData = insertProcessingJobSchema.parse(req.body);
      const job = await storage.createProcessingJob(jobData);
      
      // Start processing in background
      processDocumentInBackground(job.id);
      
      res.status(201).json(job);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to create processing job", error: error.message });
    }
  });

  app.patch("/api/processing-jobs/:id", async (req, res) => {
    try {
      const updatedJob = await storage.updateProcessingJob(req.params.id, req.body);
      if (!updatedJob) {
        return res.status(404).json({ message: "Processing job not found" });
      }
      res.json(updatedJob);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to update processing job", error: error.message });
    }
  });

  // Configuration endpoints
  app.get("/api/config", async (req, res) => {
    try {
      const config = loadConfig();
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to load configuration", error: error.message });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      saveConfig(req.body);
      res.json({ message: "Configuration saved successfully" });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to save configuration", error: error.message });
    }
  });

  app.post("/api/config/reset", async (req, res) => {
    try {
      const defaultConfig = resetConfig();
      res.json({ message: "Configuration reset to defaults", config: defaultConfig });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to reset configuration", error: error.message });
    }
  });

  // Process document endpoint
  app.post("/api/process-document", async (req, res) => {
    try {
      const { documentId, templateId } = req.body;
      
      const document = await storage.getDocument(documentId);
      const template = await storage.getTemplate(templateId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Create processing job
      const job = await storage.createProcessingJob({
        documentId,
        templateId,
        status: 'pending'
      });

      // Start processing
      processDocumentInBackground(job.id);
      
      res.status(201).json(job);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to start document processing", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function processDocumentInBackground(jobId: string) {
  try {
    const job = await storage.getProcessingJob(jobId);
    if (!job) return;

    // Update status to processing
    await storage.updateProcessingJob(jobId, { status: 'processing' });

    const document = await storage.getDocument(job.documentId);
    const template = await storage.getTemplate(job.templateId);
    
    if (!document || !template) {
      await storage.updateProcessingJob(jobId, { 
        status: 'failed', 
        errorMessage: 'Document or template not found' 
      });
      return;
    }

    const startTime = Date.now();
    
    // Process with Mistral AI
    const result = await processDocumentWithMistral(document.filePath, template.placeholders as string[]);
    
    const processingTime = Math.floor((Date.now() - startTime) / 1000);
    
    // Update job with results
    await storage.updateProcessingJob(jobId, {
      status: 'completed',
      ocrText: result.extractedText,
      extractedData: result.keyValuePairs,
      accuracy: result.accuracy,
      tokensExtracted: result.tokensExtracted,
      processingTime
    });
    
  } catch (error: any) {
    console.error('Processing error:', error);
    await storage.updateProcessingJob(jobId, {
      status: 'failed',
      errorMessage: error.message
    });
  }
}
