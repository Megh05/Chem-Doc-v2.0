import { useState, useEffect } from "react";
import { Download, Eye, Save, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Template } from "@shared/schema";

// Intelligent mapping function to match extracted data to template placeholders
function intelligentlyMapPlaceholders(templateHtml: string, extractedData: Record<string, any>): any[] {
  // Split HTML around {} placeholders to get context
  const parts = templateHtml.split(/\{\}/);
  const contexts: string[] = [];
  
  // Extract context before each placeholder
  for (let i = 0; i < parts.length - 1; i++) {
    const beforeContext = parts[i].slice(-200); // Last 200 chars before placeholder
    const afterContext = parts[i + 1].slice(0, 200); // First 200 chars after placeholder
    contexts.push(beforeContext + afterContext);
  }
  
  const mappedValues: any[] = [];
  
  // For each placeholder position, find the best matching extracted value
  contexts.forEach((context, index) => {
    let bestMatch = null;
    let bestScore = 0;
    
    Object.entries(extractedData).forEach(([key, value]) => {
      const score = calculateMatchScore(context, key, value);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = value;
      }
    });
    
    mappedValues.push(bestMatch);
  });
  
  return mappedValues;
}

// Calculate how well a field matches a template context
function calculateMatchScore(context: string, fieldKey: string, fieldValue: any): number {
  let score = 0;
  const lowerContext = context.toLowerCase();
  const cleanKey = fieldKey.replace(/_/g, ' ').toLowerCase();
  
  // Direct keyword matching
  const keywords = [
    { pattern: /batch.*number|lot.*number/i, keys: ['batch_number', 'batch', 'lot'] },
    { pattern: /manufacturing.*date|production.*date/i, keys: ['manufacturing_date', 'production_date'] },
    { pattern: /expiry.*date|expiration.*date|retest.*date/i, keys: ['expiry_date', 'expiration_date'] },
    { pattern: /product.*name/i, keys: ['product_name'] },
    { pattern: /inci.*name/i, keys: ['inci_name'] },
    { pattern: /appearance/i, keys: ['appearance'] },
    { pattern: /molecular.*weight/i, keys: ['molecular_weight'] },
    { pattern: /sodium.*hyaluronate.*content/i, keys: ['sodium_hyaluronate_content'] },
    { pattern: /protein/i, keys: ['protein'] },
    { pattern: /loss.*on.*drying/i, keys: ['loss_on_drying'] },
    { pattern: /ph/i, keys: ['ph'] },
    { pattern: /staphylococcus.*aureus/i, keys: ['staphylococcus_aureus'] },
    { pattern: /pseudomonas.*aeruginosa/i, keys: ['pseudomonas_aeruginosa'] },
    { pattern: /heavy.*metal/i, keys: ['heavy_metal'] },
    { pattern: /total.*bacteria/i, keys: ['total_bacteria'] },
    { pattern: /yeast.*and.*molds?/i, keys: ['yeast_and_molds'] },
    { pattern: /issued.*date|issue.*date/i, keys: ['issued_date'] },
    { pattern: /test.*result|conclusion/i, keys: ['test_result'] }
  ];
  
  // Check if context matches any pattern and field key matches
  keywords.forEach(({ pattern, keys }) => {
    if (pattern.test(lowerContext)) {
      keys.forEach(key => {
        if (cleanKey.includes(key) || fieldKey.includes(key)) {
          score += 100; // High score for direct pattern + key match
        }
      });
    }
  });
  
  // Additional scoring based on field key components in context
  const keyWords = cleanKey.split(' ');
  keyWords.forEach(word => {
    if (word.length > 2 && lowerContext.includes(word)) {
      score += 20;
    }
  });
  
  // Value type matching (boost score for appropriate value types)
  if (typeof fieldValue === 'boolean' && lowerContext.includes('negative')) {
    score += 15;
  }
  if (typeof fieldValue === 'number' && /[0-9%]/.test(lowerContext)) {
    score += 10;
  }
  if (typeof fieldValue === 'string' && fieldValue.includes('Date') && lowerContext.includes('date')) {
    score += 25;
  }
  
  return score;
}

interface TemplatePreviewProps {
  template: Template;
  extractedData: Record<string, any>;
  onSave?: () => void;
  onExport?: (format: 'pdf' | 'docx') => void;
  isSaving?: boolean;
}

export default function TemplatePreview({ 
  template, 
  extractedData, 
  onSave,
  onExport,
  isSaving = false
}: TemplatePreviewProps) {
  const [showFullPreview, setShowFullPreview] = useState(false);

  // Fetch the actual template structure
  const { data: templateStructure, isLoading: isLoadingStructure } = useQuery<{html: string; placeholders: string[]}>({
    queryKey: [`/api/templates/${template.id}/preview`],
    enabled: !!template.id,
  });

  const renderTemplateContent = () => {
    if (isLoadingStructure) {
      return (
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      );
    }

    if (templateStructure?.html) {
      // Use the actual template HTML structure and fill in the extracted values
      let filledHtml = templateStructure.html;
      
      // Intelligently map placeholders by analyzing the template context
      const mappedValues = intelligentlyMapPlaceholders(templateStructure.html, extractedData);
      
      // Replace {} placeholders in sequence with the intelligently mapped values
      let placeholderIndex = 0;
      filledHtml = filledHtml.replace(/\{\}/g, () => {
        if (placeholderIndex < mappedValues.length) {
          const value = mappedValues[placeholderIndex];
          placeholderIndex++;
          
          // Format the value appropriately
          if (value === null || value === undefined || value === '') {
            return '<span class="preview-highlight-empty">—</span>';
          }
          
          let formattedValue = '';
          if (typeof value === 'boolean') {
            formattedValue = value ? 'Complies' : 'Non-compliant';
          } else if (typeof value === 'number') {
            formattedValue = value.toString();
          } else {
            formattedValue = value.toString();
          }
          
          // Wrap filled values with highlight class for preview
          return `<span class="preview-highlight-filled">${formattedValue}</span>`;
        }
        return '<span class="preview-highlight-empty">—</span>';
      });
      
      // Also handle any named placeholders that might exist
      const allPlaceholders = new Set([
        ...Object.keys(extractedData),
        ...(template.placeholders || [])
      ]);

      allPlaceholders.forEach(key => {
        const value = extractedData[key] || '';
        const placeholderPatterns = [
          new RegExp(`\\{${key}\\}`, 'g'),
          new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
          new RegExp(`___${key}___`, 'g'),
          new RegExp(`\\[${key}\\]`, 'g')
        ];
        
        placeholderPatterns.forEach(pattern => {
          filledHtml = filledHtml.replace(pattern, value);
        });
      });

      return (
        <div>
          <style dangerouslySetInnerHTML={{
            __html: `
              .preview-highlight-filled {
                background-color: #dbeafe;
                color: #1e40af;
                padding: 2px 4px;
                border-radius: 4px;
                font-weight: 600;
                border: 1px solid #93c5fd;
              }
              .preview-highlight-empty {
                background-color: #fef3c7;
                color: #d97706;
                padding: 2px 4px;
                border-radius: 4px;
                font-style: italic;
                border: 1px solid #fbbf24;
              }
            `
          }} />
          <div 
            className="template-content prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: filledHtml }}
            style={{
              fontFamily: 'Arial, sans-serif',
              lineHeight: '1.6',
              color: '#333'
            }}
          />
        </div>
      );
    }

    // Fallback to dynamic rendering if template structure not available
    return (
      <div className="space-y-6">
        <div className="text-center border-b border-gray-200 pb-4">
          <h1 className="text-xl font-bold text-gray-900 uppercase">
            {template.type === 'TDS' ? 'TECHNICAL DATA SHEET' : 
             template.type === 'MDMS' ? 'MATERIAL DATA MANAGEMENT SHEET' : 
             'CERTIFICATE OF ANALYSIS'}
          </h1>
        </div>

        <div className="space-y-3">
          {template.placeholders.map((placeholder: string) => {
            const label = placeholder
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (l: string) => l.toUpperCase());

            return (
              <div key={placeholder} className="flex justify-between items-center">
                <span className="font-medium text-gray-700">{label}:</span>
                <span className="text-primary-600 font-medium" data-testid={`preview-${placeholder}`}>
                  {extractedData[placeholder] || `{${placeholder}}`}
                </span>
              </div>
            );
          })}
        </div>

        <div className="text-center border-t border-gray-200 pt-4">
          <p className="font-medium text-gray-900">Document Generated by ChemDoc AI</p>
        </div>
      </div>
    );
  };

  if (showFullPreview) {
    return (
      <Card className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Full Document Preview</h3>
          <Button 
            variant="outline" 
            onClick={() => setShowFullPreview(false)}
            data-testid="button-close-preview"
          >
            Close Preview
          </Button>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6 shadow-sm">
          {renderTemplateContent()}
        </div>

        <div className="flex space-x-2 justify-center">
          <Button 
            onClick={onSave}
            disabled={isSaving}
            data-testid="button-save-document"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Document'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-export-dropdown">
                <Download className="w-4 h-4 mr-2" />
                Export
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onExport?.('pdf')} data-testid="menu-export-pdf">
                <Download className="w-4 h-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport?.('docx')} data-testid="menu-export-docx">
                <Download className="w-4 h-4 mr-2" />
                Export as Word
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 mb-4">Template Preview</h4>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 min-h-96">
        {renderTemplateContent()}
      </div>

      <div className="mt-4 flex space-x-2">
        <Button
          onClick={onSave}
          disabled={isSaving}
          data-testid="button-save-document"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Document'}
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" data-testid="button-export-dropdown">
              <Download className="w-4 h-4 mr-2" />
              Export
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onExport?.('pdf')} data-testid="menu-export-pdf">
              <Download className="w-4 h-4 mr-2" />
              Export as PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport?.('docx')} data-testid="menu-export-docx">
              <Download className="w-4 h-4 mr-2" />
              Export as Word
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button 
          variant="outline" 
          onClick={() => setShowFullPreview(true)}
          data-testid="button-full-preview"
        >
          <Eye className="w-4 h-4 mr-2" />
          Full Preview
        </Button>
      </div>
    </div>
  );
}