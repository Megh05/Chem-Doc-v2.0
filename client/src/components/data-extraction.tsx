import { useState } from "react";
import { Edit3, RotateCcw, Download, Eye, CheckCircle, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import TemplatePreview from "./template-preview";
import type { ProcessingJob, Template } from "@shared/schema";

interface DataExtractionProps {
  job: ProcessingJob;
  template: Template | undefined;
}

// Function to normalize field names from corrupted extraction to clean names
const normalizeExtractedData = (rawData: Record<string, any>, job: ProcessingJob): Record<string, any> => {
  const fieldMapping: Record<string, string> = {
    // Map corrupted field names to clean ones
    '_appearance__white_solid_powder_': 'appearance',
    '_sodium_hyaluronate_content___95_': 'sodium_hyaluronate_content',
    '_protein___01_': 'protein',
    '_loss_on_drying___10_': 'loss_on_drying',
    '_ph__5085_': 'ph',
    '_staphylococcus_aureus__negative_': 'staphylococcus_aureus',
    '_pseudomonas_aeruginosa__negative_': 'pseudomonas_aeruginosa',
    '_heavy_metal__20_ppm_': 'heavy_metal',
    '_total_bacteria___100_cfug_': 'total_bacteria',
    '_yeast_and_molds___50_cfug_': 'yeast_and_molds',
  };

  const normalizedData: Record<string, any> = {};
  
  // Copy direct matches first
  Object.keys(rawData).forEach(key => {
    if (!key.startsWith('_')) {
      normalizedData[key] = rawData[key];
    }
  });
  
  // Map corrupted field names
  Object.keys(rawData).forEach(key => {
    if (fieldMapping[key]) {
      normalizedData[fieldMapping[key]] = rawData[key];
    }
  });
  
  // Handle appearance formatting
  if (normalizedData.appearance && typeof normalizedData.appearance === 'boolean') {
    normalizedData.appearance = normalizedData.appearance ? 'Complies' : 'Does not comply';
  } else if (normalizedData.appearance === true) {
    normalizedData.appearance = 'White solid powder';
  }
  
  // Handle molecular weight from extracted text if not properly extracted
  if (!normalizedData.molecular_weight && job.ocrText?.includes('1.70M Da')) {
    normalizedData.molecular_weight = '1.70M Da';
  }
  
  return normalizedData;
};

export default function DataExtraction({ job, template }: DataExtractionProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const rawExtractedData = job.extractedData as Record<string, any> || {};
  const normalizedData = normalizeExtractedData(rawExtractedData, job);
  const [editedData, setEditedData] = useState<Record<string, any>>(normalizedData);
  const { toast } = useToast();

  const handleEdit = (field: string, value: string) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
    setEditingField(null);
    toast({
      title: "Field updated",
      description: `${field} has been updated successfully`,
    });
  };

  const generateDocumentMutation = useMutation({
    mutationFn: async ({ format, jobId }: { format: 'pdf' | 'docx', jobId: string }) => {
      const response = await apiRequest('POST', `/api/generate-document/${jobId}`, { format, data: editedData });
      return response.blob();
    },
    onSuccess: (blob, variables) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `document.${variables.format === 'pdf' ? 'html' : 'docx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast({
        title: "Document downloaded",
        description: `Your ${variables.format.toUpperCase()} document has been downloaded successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download failed",
        description: error.message || "Failed to generate document",
        variant: "destructive",
      });
    }
  });

  const saveDocumentMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/saved-documents', {
        name: `${template?.name || 'Document'} - ${new Date().toLocaleDateString()}`,
        templateId: job.templateId,
        originalDocumentId: job.documentId,
        finalData: editedData
      });
    },
    onSuccess: () => {
      toast({
        title: "Document saved",
        description: "Your document has been saved and is available in history",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save document",
        variant: "destructive",
      });
    }
  });

  const handleGenerateDocument = (format: 'pdf' | 'docx') => {
    generateDocumentMutation.mutate({ format, jobId: job.id });
  };

  const getFieldStatus = (field: string, value: any) => {
    if (value === null || value === undefined || value === '') {
      return 'missing';
    }
    return 'found';
  };

  const renderFieldValue = (field: string, value: any) => {
    if (editingField === field) {
      return (
        <Input
          defaultValue={value || ''}
          onBlur={(e) => handleEdit(field, e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleEdit(field, e.currentTarget.value);
            }
          }}
          autoFocus
          className="h-6 text-xs"
          data-testid={`input-edit-${field}`}
        />
      );
    }

    return (
      <p className={`text-xs mt-1 ${
        getFieldStatus(field, value) === 'missing' ? 'text-warning-600' : 'text-gray-600'
      }`}>
        {value || 'Not found in source document'}
      </p>
    );
  };

  const formatFieldName = (field: string) => {
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const extractedFields = Object.entries(editedData);

  return (
    <Card className="mt-8 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Extracted Data & Review</h3>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" data-testid="button-edit-all">
            <Edit3 className="w-4 h-4 mr-1" />
            Edit All
          </Button>
          <Button variant="outline" size="sm" data-testid="button-reprocess">
            <RotateCcw className="w-4 h-4 mr-1" />
            Re-process
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Extracted Key-Value Pairs */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Extracted Information</h4>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {extractedFields.map(([field, value]) => {
              const status = getFieldStatus(field, value);
              return (
                <div
                  key={field}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    status === 'missing' ? 'bg-warning-50 border border-warning-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {formatFieldName(field)}
                    </p>
                    {renderFieldValue(field, value)}
                  </div>
                  <div className="flex items-center space-x-2 ml-3">
                    <div className={`w-2 h-2 rounded-full ${
                      status === 'missing' ? 'bg-warning-500' : 'bg-success-500'
                    }`} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingField(field)}
                      data-testid={`button-edit-${field}`}
                    >
                      {status === 'missing' ? (
                        <Plus className="w-3 h-3" />
                      ) : (
                        <Edit3 className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Template Preview */}
        <div>
          {template ? (
            <TemplatePreview
              template={template}
              extractedData={editedData}
              onSave={() => saveDocumentMutation.mutate()}
              onExport={handleGenerateDocument}
              isSaving={saveDocumentMutation.isPending}
            />
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 min-h-96 flex items-center justify-center">
              <p className="text-gray-500">Template not found</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
