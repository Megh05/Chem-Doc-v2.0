import { useState } from "react";
import { Edit3, RotateCcw, Download, Eye, CheckCircle, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { ProcessingJob, Template } from "@shared/schema";

interface DataExtractionProps {
  job: ProcessingJob;
  template: Template | undefined;
}

export default function DataExtraction({ job, template }: DataExtractionProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Record<string, any>>(job.extractedData as Record<string, any> || {});
  const { toast } = useToast();

  const handleEdit = (field: string, value: string) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
    setEditingField(null);
    toast({
      title: "Field updated",
      description: `${field} has been updated successfully`,
    });
  };

  const handleGenerateDocument = () => {
    toast({
      title: "Document generated",
      description: "Your document has been generated and is ready for download",
    });
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
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Template Preview</h4>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 min-h-96">
            <div className="text-center mb-4">
              <h3 className="font-bold text-gray-900">ACME Chemical Corp</h3>
              <p className="text-sm text-gray-600">Certificate of Analysis</p>
            </div>

            <div className="space-y-3 text-sm">
              {extractedFields.slice(0, 6).map(([field, value]) => (
                <div key={field} className="flex justify-between">
                  <span className="font-medium">{formatFieldName(field)}:</span>
                  {value ? (
                    <span className="text-primary-600 font-medium" data-testid={`preview-${field}`}>
                      {value}
                    </span>
                  ) : (
                    <span
                      className="text-warning-600 bg-warning-100 px-2 py-1 rounded text-xs"
                      data-testid={`preview-missing-${field}`}
                    >
                      {`{${field}}`}
                    </span>
                  )}
                </div>
              ))}
              
              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Test Results and additional data fields will be populated here...
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex space-x-2">
            <Button
              className="flex-1"
              onClick={handleGenerateDocument}
              data-testid="button-generate-document"
            >
              <Download className="w-4 h-4 mr-2" />
              Generate Document
            </Button>
            <Button variant="outline" data-testid="button-full-preview">
              <Eye className="w-4 h-4 mr-2" />
              Full Preview
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
