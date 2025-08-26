import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import officegen from "officegen";
import mammoth from "mammoth";
import JSZip from "jszip";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}
import { storage } from "./storage";
import { loadConfig, saveConfig, resetConfig } from "./config";
import { insertTemplateSchema, insertDocumentSchema, insertProcessingJobSchema, insertSavedDocumentSchema } from "@shared/schema";
import { processDocumentWithMistral, extractPlaceholdersFromTemplate, mapExtractedDataToTemplate } from "./lib/mistral";

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

  app.put("/api/templates/:id", async (req, res) => {
    try {
      const updatedTemplate = await storage.updateTemplate(req.params.id, req.body);
      if (!updatedTemplate) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(updatedTemplate);
    } catch (error: any) {
      res.status(400).json({ message: "Failed to update template", error: error.message });
    }
  });

  app.delete("/api/templates/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({ message: "Template deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete template", error: error.message });
    }
  });

  app.get("/api/templates/:id/download", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // For the uploaded templates, look for the file by scanning the uploads directory
      const files = fs.readdirSync(uploadDir);
      let targetFile: string | null = null;

      // First try to find by exact filename
      if (fs.existsSync(path.join(uploadDir, template.fileName))) {
        targetFile = template.fileName;
      } else {
        // For uploaded files, find by scanning directory and matching size
        for (const file of files) {
          const filePath = path.join(uploadDir, file);
          const stats = fs.statSync(filePath);
          if (stats.size === template.fileSize) {
            targetFile = file;
            break;
          }
        }
      }

      if (!targetFile) {
        return res.status(404).json({ message: "Template file not found" });
      }

      const filePath = path.join(uploadDir, targetFile);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${template.fileName}"`);
      res.sendFile(path.resolve(filePath));
    } catch (error: any) {
      res.status(500).json({ message: "Failed to download template", error: error.message });
    }
  });

  // New endpoint to get template preview HTML
  app.get("/api/templates/:id/preview", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Find template file
      const files = fs.readdirSync(uploadDir);
      let targetFile: string | null = null;

      if (fs.existsSync(path.join(uploadDir, template.fileName))) {
        targetFile = template.fileName;
      } else {
        for (const file of files) {
          const filePath = path.join(uploadDir, file);
          const stats = fs.statSync(filePath);
          if (stats.size === template.fileSize) {
            targetFile = file;
            break;
          }
        }
      }

      if (!targetFile) {
        return res.status(404).json({ message: "Template file not found" });
      }

      const templatePath = path.join(uploadDir, targetFile);
      const structure = await parseTemplateStructure(templatePath);
      
      res.json({
        html: structure.html,
        placeholders: template.placeholders
      });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to parse template", error: error.message });
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

  // Intelligent mapping endpoint
  app.post("/api/intelligent-mapping", async (req, res) => {
    try {
      const { extractedData, templateHtml } = req.body;
      
      if (!extractedData || !templateHtml) {
        return res.status(400).json({ message: "Missing extractedData or templateHtml" });
      }

      const config = loadConfig();
      const MISTRAL_API_KEY = config.apiSettings.mistralApiKey || process.env.MISTRAL_API_KEY;
      
      if (!MISTRAL_API_KEY) {
        return res.status(500).json({ message: "Mistral API key not configured" });
      }

      const mappingOrder = await mapExtractedDataToTemplate(
        extractedData,
        templateHtml,
        MISTRAL_API_KEY
      );
      
      res.json(mappingOrder);
    } catch (error: any) {
      console.error('Intelligent mapping error:', error);
      res.status(500).json({ message: "Failed to generate intelligent mapping", error: error.message });
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

      // Find template file
      const files = fs.readdirSync(uploadDir);
      let targetFile: string | null = null;

      if (fs.existsSync(path.join(uploadDir, template.fileName))) {
        targetFile = template.fileName;
      } else {
        for (const file of files) {
          const filePath = path.join(uploadDir, file);
          const stats = fs.statSync(filePath);
          if (stats.size === template.fileSize) {
            targetFile = file;
            break;
          }
        }
      }

      if (!targetFile) {
        return res.status(404).json({ message: "Template file not found" });
      }

      const templatePath = path.join(uploadDir, targetFile);
      const documentData = data || job.extractedData || {};
      
      // Debug: Log the actual data being used
      console.log('🔍 Document data for generation:', JSON.stringify(documentData, null, 2));
      console.log('🔍 Job extracted data:', JSON.stringify(job.extractedData, null, 2));

      if (format === 'pdf') {
        // Generate actual PDF using Puppeteer
        const puppeteer = await import('puppeteer');
        const structure = await parseTemplateStructure(templatePath);
        let htmlContent = structure.html;
        
        // Replace placeholders in HTML with actual data
        console.log('🔍 HTML content before replacement:', htmlContent.substring(0, 200));
        
        Object.keys(documentData).forEach(key => {
          const value = documentData[key] || '';
          console.log(`🔄 Replacing {${key}} with: "${value}"`);
          
          const placeholderPatterns = [
            new RegExp(`\\{${key}\\}`, 'g'),
            new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
            new RegExp(`___${key}___`, 'g'),
            new RegExp(`\\[${key}\\]`, 'g')
          ];
          
          placeholderPatterns.forEach(pattern => {
            const beforeReplace = htmlContent;
            htmlContent = htmlContent.replace(pattern, value);
            if (beforeReplace !== htmlContent) {
              console.log(`✅ Successfully replaced pattern ${pattern} with "${value}"`);
            }
          });
        });
        
        console.log('🔍 HTML content after replacement:', htmlContent.substring(0, 200));
        
        // Add CSS styling for better PDF appearance
        const styledHtmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 40px; 
                line-height: 1.6; 
                color: #333;
              }
              h1, h2, h3 { 
                color: #2c3e50; 
                margin-top: 30px; 
                margin-bottom: 15px;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin: 20px 0;
              }
              th, td { 
                border: 1px solid #ddd; 
                padding: 12px; 
                text-align: left;
              }
              th { 
                background-color: #f5f5f5; 
                font-weight: bold;
              }
              .header { 
                text-align: center; 
                margin-bottom: 30px;
              }
              .field-group { 
                margin: 15px 0;
              }
              .field-label { 
                font-weight: bold; 
                display: inline-block; 
                min-width: 200px;
              }
              .field-value { 
                margin-left: 10px;
              }
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
          </html>
        `;
        
        // Launch Puppeteer and generate PDF
        const browser = await puppeteer.default.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
          const page = await browser.newPage();
          await page.setContent(styledHtmlContent, { waitUntil: 'networkidle0' });
          
          const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: {
              top: '20mm',
              right: '20mm',
              bottom: '20mm',
              left: '20mm'
            },
            printBackground: true
          });
          
          await browser.close();
          
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${template.name}_filled.pdf"`);
          res.send(pdfBuffer);
        } catch (error) {
          await browser.close();
          throw error;
        }
        
      } else if (format === 'docx') {
        // Generate DOCX using the template-based approach
        const filledDocxBuffer = await fillTemplateWithData(templatePath, documentData);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${template.name}_filled.docx"`);
        res.send(filledDocxBuffer);
        
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
        
        // Add dynamic title based on template type
        const documentTitle = template.type === 'TDS' ? 'TECHNICAL DATA SHEET' : 
                             template.type === 'MDMS' ? 'MATERIAL DATA MANAGEMENT SHEET' : 
                             'CERTIFICATE OF ANALYSIS';
        const title = docx.createP();
        title.addText(documentTitle, { font_face: 'Arial', font_size: 16, bold: true });
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

// Helper function to parse DOCX template structure
async function parseTemplateStructure(templatePath: string) {
  try {
    const data = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(data);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    
    if (!documentXml) {
      throw new Error("Could not extract document.xml from DOCX");
    }

    // Extract the raw structure for template preview
    const result = await mammoth.convertToHtml({ path: templatePath });
    const htmlContent = result.value;
    
    return {
      html: htmlContent,
      xml: documentXml,
      messages: result.messages
    };
  } catch (error) {
    console.error('Template parsing error:', error);
    throw error;
  }
}

// Helper function to fill template with extracted data
async function fillTemplateWithData(templatePath: string, extractedData: Record<string, any>) {
  try {
    const templateBuffer = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(templateBuffer);
    
    // Get document.xml content
    const documentXml = await zip.file("word/document.xml")?.async("string");
    if (!documentXml) {
      throw new Error("Could not extract document.xml from DOCX");
    }

    // Replace placeholders in the XML
    let modifiedXml = documentXml;
    Object.keys(extractedData).forEach(key => {
      const value = extractedData[key] || '';
      // Replace various placeholder formats
      const placeholderPatterns = [
        new RegExp(`\\{${key}\\}`, 'g'),
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        new RegExp(`___${key}___`, 'g'),
        new RegExp(`\\[${key}\\]`, 'g')
      ];
      
      placeholderPatterns.forEach(pattern => {
        modifiedXml = modifiedXml.replace(pattern, value);
      });
    });

    // Update the document.xml in the zip
    zip.file("word/document.xml", modifiedXml);
    
    // Generate the modified DOCX
    const modifiedBuffer = await zip.generateAsync({ type: "nodebuffer" });
    return modifiedBuffer;
    
  } catch (error) {
    console.error('Template filling error:', error);
    throw error;
  }
}

function generateHTMLContent(template: any, data: Record<string, any>): string {
  // Generate dynamic HTML based on extracted data without hardcoded templates
  const documentTitle = 'AI-Generated Document';
  
  // Generate dynamic field rows from all extracted data
  const fieldRows = Object.entries(data)
    .filter(([key, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      return `
        <div class="field-row">
          <span class="label">${label}:</span>
          <span class="value">${value}</span>
        </div>
      `;
    }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${documentTitle}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
        .field-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .label { font-weight: bold; }
        .value { color: #2563eb; }
        .footer { text-align: center; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${documentTitle}</div>
      </div>
      
      ${fieldRows}
      
      <div class="footer">
        <strong>Document Generated by AI</strong>
      </div>
    </body>
    </html>
  `;
}

function generateDocxContent(template: any, data: Record<string, any>) {
  // Generate dynamic content from extracted data without template dependencies
  const documentTitle = 'AI-Generated Document';
  
  const content = [
    { text: documentTitle, options: { font_size: 16, bold: true } },
    { text: '\n' }
  ];
  
  // Add all fields from extracted data
  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      content.push({ text: `${label}: ${value}` });
    }
  });
  
  content.push(
    { text: '\n' },
    { text: 'Document Generated by AI', options: { font_size: 12, bold: true } }
  );
  
  return content;
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
    
    // Get template HTML structure for extraction
    let templateHtml = template.html;
    if (!templateHtml) {
      // Parse template file to get HTML structure
      const files = fs.readdirSync(uploadDir);
      let targetFile: string | null = null;

      if (fs.existsSync(path.join(uploadDir, template.fileName))) {
        targetFile = template.fileName;
      } else {
        for (const file of files) {
          const filePath = path.join(uploadDir, file);
          const stats = fs.statSync(filePath);
          if (stats.size === template.fileSize) {
            targetFile = file;
            break;
          }
        }
      }

      if (targetFile) {
        const templatePath = path.join(uploadDir, targetFile);
        const structure = await parseTemplateStructure(templatePath);
        templateHtml = structure.html;
        
        // Update template with HTML for future use
        await storage.updateTemplate(template.id, { html: templateHtml });
      }
    }
    
    console.log('📋 Using template HTML for extraction:', templateHtml?.substring(0, 200) + '...');
    
    // Process with Mistral AI using template-guided extraction 
    const result = await processDocumentWithMistral(document.filePath, templateHtml || '');
    
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
