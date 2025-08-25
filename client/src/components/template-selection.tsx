import { useState } from "react";
import { CheckCircle, FileText, Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Template } from "@shared/schema";

interface TemplateSelectionProps {
  templates: Template[];
  selectedTemplateId: string | null;
  onTemplateSelected: (templateId: string) => void;
  isActive: boolean;
  isCompleted: boolean;
}

export default function TemplateSelection({
  templates,
  selectedTemplateId,
  onTemplateSelected,
  isActive,
  isCompleted
}: TemplateSelectionProps) {
  const [showUpload, setShowUpload] = useState(false);
  
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const formatDate = (date: Date | string) => {
    const now = new Date();
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const diffTime = Math.abs(now.getTime() - dateObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return `${Math.ceil(diffDays / 30)} months ago`;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Step 2: Select Company Template</h3>
        {isCompleted && (
          <div className="flex items-center text-sm text-success-600">
            <CheckCircle className="w-4 h-4 mr-2" />
            Template Selected
          </div>
        )}
      </div>

      <div className="space-y-3 mb-6">
        {templates.map((template) => (
          <div
            key={template.id}
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedTemplateId === template.id
                ? "border-primary-500 bg-primary-50"
                : "border-gray-200 hover:bg-gray-50"
            }`}
            onClick={() => onTemplateSelected(template.id)}
            data-testid={`template-${template.id}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  selectedTemplateId === template.id ? 'bg-primary-100' : 'bg-gray-100'
                }`}>
                  <FileText className={`w-5 h-5 ${
                    selectedTemplateId === template.id ? 'text-primary-600' : 'text-gray-600'
                  }`} />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900" data-testid={`text-template-name-${template.id}`}>
                    {template.name}
                  </p>
                  <p className="text-xs text-gray-600">
                    Last modified {formatDate(template.updatedAt)} • {(template.placeholders as string[]).length} placeholders
                  </p>
                </div>
              </div>
              {selectedTemplateId === template.id && (
                <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {!showUpload ? (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
          onClick={() => setShowUpload(true)}
          data-testid="button-show-upload-template"
        >
          <Plus className="w-6 h-6 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-2">Upload New Template</p>
          <Button variant="ghost" size="sm">
            Browse Files
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-primary-300 rounded-lg p-6 text-center bg-primary-50">
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                console.log('File selected:', file.name);
                // TODO: Handle file upload
              }
            }}
            accept=".docx,.doc"
            className="hidden"
            id="template-upload"
            data-testid="input-template-upload"
          />
          <Button 
            onClick={() => document.getElementById('template-upload')?.click()}
            data-testid="button-upload-template"
          >
            Upload Template
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            Word documents only (.docx, .doc)
          </p>
          <Button 
            variant="ghost" 
            size="sm" 
            className="mt-2"
            onClick={() => setShowUpload(false)}
            data-testid="button-cancel-upload"
          >
            Cancel
          </Button>
        </div>
      )}

      {selectedTemplate && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Info className="w-4 h-4 text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-800">Template Analysis</p>
              <p className="text-xs text-blue-600 mt-1" data-testid="text-template-placeholders">
                Found {(selectedTemplate.placeholders as string[]).length} placeholders: {(selectedTemplate.placeholders as string[]).slice(0, 3).join(', ')}, etc.
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
