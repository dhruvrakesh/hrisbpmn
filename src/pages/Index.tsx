import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import FileUpload from '@/components/FileUpload';
import BpmnViewer from '@/components/BpmnViewer';
import AnalysisResults from '@/components/AnalysisResults';
import AiChatInterface from '@/components/AiChatInterface';
import UsageTracker from '@/components/UsageTracker';
import { ProcessHistory } from '@/components/ProcessHistory';
import TemplateManager from '@/components/TemplateManager';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FileData {
  id: string;
  fileName: string;
  filePath: string;
}

interface AnalysisResult {
  fileId: string;
  fileName: string;
  analyzedAt: string;
  summary: {
    totalUserTasks: number;
    totalServiceTasks: number;
    totalGateways: number;
    totalEvents: number;
    processComplexity: number;
    riskLevel: string;
    tasksFound?: Array<{ id: string; name: string }>;
  };
  processIntelligence?: {
    insights: string[];
    recommendations: string[];
    riskAssessment: string;
    complianceNotes: string[];
    editingSuggestions?: Array<{
      id: string;
      type: 'add-task' | 'change-gateway' | 'optimize-flow' | 'add-role';
      elementId?: string;
      description: string;
      details: any;
    }>;
  };
  findings: Array<{
    id: string;
    ruleId: string;
    ruleName: string;
    severity: 'Error' | 'Warning' | 'Info';
    message: string;
    elementId: string | null;
    elementName: string | null;
    description: string;
  }>;
}

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [uploadedFile, setUploadedFile] = useState<FileData | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");
  const [bpmnViewerRef, setBpmnViewerRef] = useState<any>(null);

  // Redirect to auth if not authenticated
  if (!authLoading && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const handleFileUploaded = (fileData: FileData) => {
    setUploadedFile(fileData);
    setAnalysisResult(null); // Clear previous results
  };

  const runAnalysis = async () => {
    if (!uploadedFile) return;

    setAnalyzing(true);
    setAnalysisResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-bpmn', {
        body: {
          fileId: uploadedFile.id,
          filePath: uploadedFile.filePath,
        },
      });

      if (error) {
        throw error;
      }

      setAnalysisResult(data);
      setActiveTab("results");
      toast({
        title: "Analysis Complete",
        description: `Found ${data.findings?.length || 0} findings. Process complexity: ${data.summary?.riskLevel || 'Unknown'}.`,
      });

    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze the BPMN file.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileSelect = (file: any) => {
    setUploadedFile({
      id: file.id,
      fileName: file.file_name,
      filePath: file.file_path,
    });
    setActiveTab("upload");
    setAnalysisResult(null);
    toast({
      title: "File Selected",
      description: `Loaded ${file.file_name} from your process history`,
    });
  };

  const handleTemplateSelect = async (template: any) => {
    try {
      if (!user) throw new Error('User not authenticated');
      
      // Create a temporary file from template XML
      const timestamp = Date.now();
      const fileName = `template_${timestamp}_${template.template_name}.bpmn`;
      const filePath = `${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('bpmn-files')
        .upload(filePath, new Blob([template.bpmn_xml], { type: 'application/xml' }), {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Create a file record
      const { data: fileData, error: dbError } = await supabase
        .from('bpmn_files')
        .insert({
          user_id: user.id,
          file_name: fileName,
          file_path: filePath,
          file_size: template.bpmn_xml.length
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setUploadedFile({
        id: fileData.id,
        fileName: fileName,
        filePath: fileName
      });

      setActiveTab("upload");
      setAnalysisResult(null);
      
      toast({
        title: "Template Loaded",
        description: `Template "${template.template_name}" has been loaded for editing.`,
      });
    } catch (error: any) {
      console.error('Error loading template:', error);
      toast({
        title: "Template Load Error",
        description: error.message || "Failed to load template.",
        variant: "destructive",
      });
    }
  };

  const handleApplySuggestion = async (suggestion: any) => {
    // Remove the applied suggestion from analysis results
    if (analysisResult?.processIntelligence?.editingSuggestions) {
      const updatedSuggestions = analysisResult.processIntelligence.editingSuggestions.filter(
        (s: any) => s.id !== suggestion.id
      );
      setAnalysisResult({
        ...analysisResult,
        processIntelligence: {
          ...analysisResult.processIntelligence,
          editingSuggestions: updatedSuggestions
        }
      });
    }
    
    toast({
      title: "Suggestion Applied",
      description: suggestion.description,
    });
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container mx-auto py-8 space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">HRIS Process Linter</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload your BPMN process maps and get instant feedback on HRIS best practices, 
              compliance requirements, and process optimization opportunities.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="upload">Upload & Analyze</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="history">Process History</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-6">
              <div className="grid gap-8">
                {/* File Upload */}
                {!uploadedFile && (
                  <FileUpload onFileUploaded={handleFileUploaded} />
                )}

                {/* BPMN Viewer */}
                {uploadedFile && (
                  <BpmnViewer
                    fileId={uploadedFile.id}
                    fileName={uploadedFile.fileName}
                    filePath={uploadedFile.filePath}
                    onAnalyze={runAnalysis}
                    suggestions={analysisResult?.processIntelligence?.editingSuggestions || []}
                    onSuggestionApplied={handleApplySuggestion}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              {analysisResult ? (
                <AnalysisResults
                  result={analysisResult}
                  loading={analyzing}
                  onRefresh={runAnalysis}
                  onApplySuggestion={handleApplySuggestion}
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No analysis results yet. Upload and analyze a BPMN file first.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <ProcessHistory 
                onFileSelect={handleFileSelect}
                currentFileId={uploadedFile?.id}
              />
            </TabsContent>

            <TabsContent value="templates" className="space-y-6">
              <TemplateManager 
                onTemplateSelect={handleTemplateSelect}
                currentTemplateId={uploadedFile?.id}
              />
            </TabsContent>
          </Tabs>
        </main>

        {/* AI Chat Interface - appears when BPMN is loaded */}
        {uploadedFile && (
          <AiChatInterface
            bpmnFileId={uploadedFile.id}
            bpmnContext={{
              fileName: uploadedFile.fileName,
              filePath: uploadedFile.filePath
            }}
            analysisResult={analysisResult}
          />
        )}

        {/* Usage Tracker */}
        <UsageTracker />
      </div>
    </ErrorBoundary>
  );
};

export default Index;
