import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Template } from "@shared/schema";

interface TemplatePreviewProps {
  template: Template;
  extractedData: Record<string, any>;
  onDownload?: (format: 'pdf' | 'docx') => void;
}

export default function TemplatePreview({ 
  template, 
  extractedData, 
  onDownload 
}: TemplatePreviewProps) {
  const [showFullPreview, setShowFullPreview] = useState(false);

  const renderTemplateContent = () => {
    // Generate template content based on the template type
    const getTemplateStructure = () => {
      if (template.type === 'CoA') {
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center border-b border-gray-200 pb-4">
              <h1 className="text-xl font-bold text-gray-900 uppercase">
                CERTIFICATE OF ANALYSIS
              </h1>
            </div>

            {/* Product Information */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">Product Name:</span>
                <span className="text-primary-600 font-medium" data-testid="preview-product_name">
                  {extractedData.product_name || '{product_name}'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">INCI Name:</span>
                <span className="text-primary-600 font-medium" data-testid="preview-inci_name">
                  {extractedData.inci_name || '{inci_name}'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">Batch Number:</span>
                <span className="text-primary-600 font-medium" data-testid="preview-batch_number">
                  {extractedData.batch_number || '{batch_number}'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">Manufacturing Date:</span>
                <span className="text-primary-600 font-medium" data-testid="preview-manufacturing_date">
                  {extractedData.manufacturing_date || '{manufacturing_date}'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">Expiry Date:</span>
                <span className="text-primary-600 font-medium" data-testid="preview-expiry_date">
                  {extractedData.expiry_date || '{expiry_date}'}
                </span>
              </div>
            </div>

            {/* Test Results Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-r border-gray-200">Test Items</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700 border-r border-gray-200">Specifications</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Results</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2 border-r border-gray-200">Appearance</td>
                    <td className="px-4 py-2 border-r border-gray-200">White solid powder</td>
                    <td className="px-4 py-2 text-primary-600 font-medium">
                      {extractedData.appearance || '{appearance}'}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2 border-r border-gray-200">Molecular weight</td>
                    <td className="px-4 py-2 border-r border-gray-200">(0.5 – 1.8) x 10⁶</td>
                    <td className="px-4 py-2 text-primary-600 font-medium">
                      {extractedData.molecular_weight || '{molecular_weight}'}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2 border-r border-gray-200">Sodium hyaluronate content</td>
                    <td className="px-4 py-2 border-r border-gray-200">≥ 95%</td>
                    <td className="px-4 py-2 text-primary-600 font-medium">
                      {extractedData.sodium_hyaluronate_content || '{sodium_hyaluronate_content}'}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2 border-r border-gray-200">Protein</td>
                    <td className="px-4 py-2 border-r border-gray-200">≤ 0.1%</td>
                    <td className="px-4 py-2 text-primary-600 font-medium">
                      {extractedData.protein || '{protein}'}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2 border-r border-gray-200">Loss on drying</td>
                    <td className="px-4 py-2 border-r border-gray-200">≤ 10%</td>
                    <td className="px-4 py-2 text-primary-600 font-medium">
                      {extractedData.loss_on_drying || '{loss_on_drying}'}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2 border-r border-gray-200">pH</td>
                    <td className="px-4 py-2 border-r border-gray-200">5.0-8.5</td>
                    <td className="px-4 py-2 text-primary-600 font-medium">
                      {extractedData.ph || '{ph}'}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2 border-r border-gray-200">Staphylococcus Aureus</td>
                    <td className="px-4 py-2 border-r border-gray-200">Negative</td>
                    <td className="px-4 py-2 text-primary-600 font-medium">
                      {extractedData.staphylococcus_aureus || '{staphylococcus_aureus}'}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2 border-r border-gray-200">Pseudomonas Aeruginosa</td>
                    <td className="px-4 py-2 border-r border-gray-200">Negative</td>
                    <td className="px-4 py-2 text-primary-600 font-medium">
                      {extractedData.pseudomonas_aeruginosa || '{pseudomonas_aeruginosa}'}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2 border-r border-gray-200">Heavy metal</td>
                    <td className="px-4 py-2 border-r border-gray-200">≤20 ppm</td>
                    <td className="px-4 py-2 text-primary-600 font-medium">
                      {extractedData.heavy_metal || '{heavy_metal}'}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2 border-r border-gray-200">Total Bacteria</td>
                    <td className="px-4 py-2 border-r border-gray-200">&lt; 100 CFU/g</td>
                    <td className="px-4 py-2 text-primary-600 font-medium">
                      {extractedData.total_bacteria || '{total_bacteria}'}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-2 border-r border-gray-200">Yeast and molds</td>
                    <td className="px-4 py-2 border-r border-gray-200">&lt; 50 CFU/g</td>
                    <td className="px-4 py-2 text-primary-600 font-medium">
                      {extractedData.yeast_and_molds || '{yeast_and_molds}'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="space-y-2 border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">ISSUED DATE:</span>
                <span className="text-primary-600 font-medium" data-testid="preview-issued_date">
                  {extractedData.issued_date || '{issued_date}'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">TEST RESULT:</span>
                <span className="text-primary-600 font-medium" data-testid="preview-test_result">
                  {extractedData.test_result || '{test_result}'}
                </span>
              </div>
            </div>

            {/* Company Footer */}
            <div className="text-center border-t border-gray-200 pt-4">
              <p className="font-medium text-gray-900">Nano Tech Chemical Brothers Pvt. Ltd.</p>
            </div>
          </div>
        );
      }

      // Default fallback for other template types
      return (
        <div className="space-y-4">
          <div className="text-center border-b border-gray-200 pb-4">
            <h1 className="text-xl font-bold text-gray-900 uppercase">
              {template.type} DOCUMENT
            </h1>
          </div>
          <div className="space-y-3">
            {template.placeholders.slice(0, 8).map((placeholder: string) => (
              <div key={placeholder} className="flex justify-between items-center">
                <span className="font-medium text-gray-700 capitalize">
                  {placeholder.replace(/_/g, ' ')}:
                </span>
                <span className="text-primary-600 font-medium">
                  {extractedData[placeholder] || `{${placeholder}}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    };

    return getTemplateStructure();
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
            onClick={() => onDownload?.('pdf')}
            data-testid="button-download-pdf"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          <Button 
            variant="outline"
            onClick={() => onDownload?.('docx')}
            data-testid="button-download-docx"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Word
          </Button>
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
          className="flex-1"
          onClick={() => onDownload?.('pdf')}
          data-testid="button-generate-document"
        >
          <Download className="w-4 h-4 mr-2" />
          Generate Document
        </Button>
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