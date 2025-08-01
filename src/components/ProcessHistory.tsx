import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, Eye, Trash2, Download, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BpmnDownloadManager from "./BpmnDownloadManager";
import BpmnAuditTrail from "./BpmnAuditTrail";

interface BpmnFile {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  file_size: number;
}

interface ProcessHistoryProps {
  onFileSelect: (file: BpmnFile) => void;
  currentFileId?: string;
}

export const ProcessHistory = ({ onFileSelect, currentFileId }: ProcessHistoryProps) => {
  const [files, setFiles] = useState<BpmnFile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('bpmn_files')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: "Error",
        description: "Failed to load process history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('bpmn_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      setFiles(files.filter(f => f.id !== fileId));
      toast({
        title: "Success",
        description: "Process file deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: "Failed to delete process file",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Process History</CardTitle>
          <CardDescription>Loading your BPMN files...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Process History
          </CardTitle>
          <CardDescription>
            Your previously uploaded BPMN process files
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No process files found</p>
              <p className="text-sm">Upload a BPMN file to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`p-4 border rounded-lg hover:bg-muted/50 transition-colors ${
                    currentFileId === file.id ? 'border-primary bg-muted/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{file.file_name}</h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(file.uploaded_at), { addSuffix: true })}
                        </span>
                        <span>{formatFileSize(file.file_size || 0)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onFileSelect(file)}
                        disabled={currentFileId === file.id}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {currentFileId === file.id ? 'Current' : 'View'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(file.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced features for selected file */}
      {currentFileId && (
        <Tabs defaultValue="downloads" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="downloads" className="flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Downloads & Versions</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center space-x-2">
              <History className="h-4 w-4" />
              <span>Audit Trail</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="downloads" className="space-y-4">
            <BpmnDownloadManager 
              fileId={currentFileId}
              fileName={files.find(f => f.id === currentFileId)?.file_name || 'Unknown'}
            />
          </TabsContent>
          
          <TabsContent value="audit" className="space-y-4">
            <BpmnAuditTrail 
              fileId={currentFileId}
              fileName={files.find(f => f.id === currentFileId)?.file_name || 'Unknown'}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};