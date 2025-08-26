import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import officegen from "officegen";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}
import { storage } from "./storage";
import { loadConfig, saveConfig, resetConfig } from "./config";
import { insertTemplateSchema, insertDocumentSchema, insertProcessingJobSchema, insertSavedDocumentSchema } from "@shared/schema";
import { processDocumentWithMistral, extractPlaceholdersFromTemplate } from "./lib/mistral";

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

      // Extract placeholders from template automatically
      let placeholders: string[] = [];
      try {
        placeholders = await extractPlaceholdersFromTemplate(req.file.path);
        console.log(`Extracted ${placeholders.length} placeholders from template:`, placeholders);
      } catch (error) {
        console.error('Failed to extract placeholders from template:', error);
        // Use fallback placeholders if extraction fails
        placeholders = req.body.placeholders ? JSON.parse(req.body.placeholders) : [];
      }

      const templateData = {
        name: req.body.name,
        type: req.body.type,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        placeholders
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

  // Document generation endpoint
  app.post("/api/generate-document/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { format, data } = req.body;
      
      const job = await storage.getProcessingJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Processing job not found" });
      }

      const template = await storage.getTemplate(job.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Use provided data, fallback to job extracted data
      const documentData = data || job.extractedData || {};

      if (format === 'pdf') {
        const htmlContent = generateHTMLContent(template, documentData);
        
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="${template.name}_filled.html"`);
        res.send(htmlContent);
        
      } else if (format === 'docx') {
        const docx = officegen('docx');
        
        // Add title
        const title = docx.createP();
        title.addText('CERTIFICATE OF ANALYSIS', { font_face: 'Arial', font_size: 16, bold: true });
        title.options.align = 'center';
        
        // Add content
        const content = generateDocxContent(template, documentData);
        content.forEach(line => {
          const p = docx.createP();
          p.addText(line.text, line.options || { font_face: 'Arial', font_size: 11 });
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${template.name}_filled.docx"`);
        
        docx.generate(res);
        
      } else {
        return res.status(400).json({ message: "Invalid format. Use 'pdf' or 'docx'" });
      }
      
    } catch (error: any) {
      console.error('Document generation error:', error);
      res.status(500).json({ message: "Failed to generate document", error: error.message });
    }
  });

  // Saved documents endpoints
  app.get("/api/saved-documents", async (req, res) => {
    try {
      const savedDocuments = await storage.getSavedDocuments();
      res.json(savedDocuments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch saved documents" });
    }
  });

  app.post("/api/saved-documents", async (req, res) => {
    try {
      const validatedData = insertSavedDocumentSchema.parse(req.body);
      const savedDocument = await storage.createSavedDocument(validatedData);
      res.status(201).json(savedDocument);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to save document", error: error.message });
    }
  });

  app.post("/api/saved-documents/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const { format } = req.body;
      
      const savedDocument = await storage.getSavedDocument(id);
      if (!savedDocument) {
        return res.status(404).json({ message: "Saved document not found" });
      }

      const template = await storage.getTemplate(savedDocument.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (format === 'pdf') {
        const htmlContent = generateHTMLContent(template, savedDocument.finalData);
        
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="${savedDocument.name}.html"`);
        res.send(htmlContent);
        
      } else if (format === 'docx') {
        const docx = officegen('docx');
        
        // Add title
        const title = docx.createP();
        title.addText('CERTIFICATE OF ANALYSIS', { font_face: 'Arial', font_size: 16, bold: true });
        title.options.align = 'center';
        
        // Add content
        const content = generateDocxContent(template, savedDocument.finalData);
        content.forEach(line => {
          const p = docx.createP();
          p.addText(line.text, line.options || { font_face: 'Arial', font_size: 11 });
        });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${savedDocument.name}.docx"`);
        
        docx.generate(res);
        
      } else {
        return res.status(400).json({ message: "Invalid format. Use 'pdf' or 'docx'" });
      }
      
    } catch (error: any) {
      console.error('Document download error:', error);
      res.status(500).json({ message: "Failed to download document", error: error.message });
    }
  });

  app.delete("/api/saved-documents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSavedDocument(id);
      if (!deleted) {
        return res.status(404).json({ message: "Saved document not found" });
      }
      res.json({ message: "Document deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete document", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function generateHTMLContent(template: any, data: Record<string, any>): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Certificate of Analysis</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
        .field-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .label { font-weight: bold; }
        .value { color: #2563eb; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">CERTIFICATE OF ANALYSIS</div>
      </div>
      
      <div class="field-row">
        <span class="label">Product Name:</span>
        <span class="value">${data.product_name || 'COSCARE-H ACID'}</span>
      </div>
      
      <div class="field-row">
        <span class="label">INCI Name:</span>
        <span class="value">${data.inci_name || 'Sodium Hyaluronate'}</span>
      </div>
      
      <div class="field-row">
        <span class="label">Batch Number:</span>
        <span class="value">${data.batch_number || ''}</span>
      </div>
      
      <div class="field-row">
        <span class="label">Manufacturing Date:</span>
        <span class="value">${data.manufacturing_date || ''}</span>
      </div>
      
      <div class="field-row">
        <span class="label">Expiry Date:</span>
        <span class="value">${data.expiry_date || ''}</span>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Test Items</th>
            <th>Specifications</th>
            <th>Results</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Appearance</td>
            <td>White solid powder</td>
            <td>${data.appearance || ''}</td>
          </tr>
          <tr>
            <td>Molecular weight</td>
            <td>(0.5 – 1.8) x 10⁶</td>
            <td>${data.molecular_weight || ''}</td>
          </tr>
          <tr>
            <td>Sodium hyaluronate content</td>
            <td>≥ 95%</td>
            <td>${data.sodium_hyaluronate_content || ''}</td>
          </tr>
          <tr>
            <td>Protein</td>
            <td>≤ 0.1%</td>
            <td>${data.protein || ''}</td>
          </tr>
          <tr>
            <td>Loss on drying</td>
            <td>≤ 10%</td>
            <td>${data.loss_on_drying || ''}</td>
          </tr>
          <tr>
            <td>pH</td>
            <td>5.0-8.5</td>
            <td>${data.ph || ''}</td>
          </tr>
          <tr>
            <td>Staphylococcus Aureus</td>
            <td>Negative</td>
            <td>${data.staphylococcus_aureus || ''}</td>
          </tr>
          <tr>
            <td>Pseudomonas Aeruginosa</td>
            <td>Negative</td>
            <td>${data.pseudomonas_aeruginosa || ''}</td>
          </tr>
          <tr>
            <td>Heavy metal</td>
            <td>≤20 ppm</td>
            <td>${data.heavy_metal || ''}</td>
          </tr>
          <tr>
            <td>Total Bacteria</td>
            <td>&lt; 100 CFU/g</td>
            <td>${data.total_bacteria || ''}</td>
          </tr>
          <tr>
            <td>Yeast and molds</td>
            <td>&lt; 50 CFU/g</td>
            <td>${data.yeast_and_molds || ''}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="field-row">
        <span class="label">ISSUED DATE:</span>
        <span class="value">${data.issued_date || ''}</span>
      </div>
      
      <div class="field-row">
        <span class="label">TEST RESULT:</span>
        <span class="value">${data.test_result || ''}</span>
      </div>
      
      <div class="footer">
        <strong>Nano Tech Chemical Brothers Pvt. Ltd.</strong>
      </div>
    </body>
    </html>
  `;
}

function generateDocxContent(template: any, data: Record<string, any>) {
  return [
    { text: '\n' },
    { text: `Product Name: ${data.product_name || 'COSCARE-H ACID'}` },
    { text: `INCI Name: ${data.inci_name || 'Sodium Hyaluronate'}` },
    { text: `Batch Number: ${data.batch_number || ''}` },
    { text: `Manufacturing Date: ${data.manufacturing_date || ''}` },
    { text: `Expiry Date: ${data.expiry_date || ''}` },
    { text: '\n\nTest Results:' },
    { text: `Appearance: ${data.appearance || ''}` },
    { text: `Molecular weight: ${data.molecular_weight || ''}` },
    { text: `Sodium hyaluronate content: ${data.sodium_hyaluronate_content || ''}` },
    { text: `Protein: ${data.protein || ''}` },
    { text: `Loss on drying: ${data.loss_on_drying || ''}` },
    { text: `pH: ${data.ph || ''}` },
    { text: `Staphylococcus Aureus: ${data.staphylococcus_aureus || ''}` },
    { text: `Pseudomonas Aeruginosa: ${data.pseudomonas_aeruginosa || ''}` },
    { text: `Heavy metal: ${data.heavy_metal || ''}` },
    { text: `Total Bacteria: ${data.total_bacteria || ''}` },
    { text: `Yeast and molds: ${data.yeast_and_molds || ''}` },
    { text: '\n' },
    { text: `ISSUED DATE: ${data.issued_date || ''}` },
    { text: `TEST RESULT: ${data.test_result || ''}` },
    { text: '\n\nNano Tech Chemical Brothers Pvt. Ltd.', options: { bold: true } }
  ];
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
