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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">Upload & Analyze</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="history">Process History</TabsTrigger>
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
