import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Loader2 } from 'lucide-react';

interface FileUploadProps {
  onFileUploaded: (fileData: { id: string; fileName: string; filePath: string }) => void;
}

const FileUpload = ({ onFileUploaded }: FileUploadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.name.endsWith('.bpmn') && !file.name.endsWith('.bpmn2') && !file.name.endsWith('.xml')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a .bpmn, .bpmn2, or .xml file.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload file to Supabase Storage
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('bpmn-files')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Save file metadata to database
      const { data, error: dbError } = await supabase
        .from('bpmn_files')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
        })
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }

      toast({
        title: "File Uploaded Successfully",
        description: `${file.name} has been uploaded and is ready for analysis.`,
      });

      onFileUploaded({
        id: data.id,
        fileName: data.file_name,
        filePath: data.file_path,
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5" />
          <span>Upload BPMN Process</span>
        </CardTitle>
        <CardDescription>
          Upload your BPMN (.bpmn, .bpmn2, or .xml) file to start the analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button
            onClick={handleFileSelect}
            disabled={uploading}
            className="w-full h-32 border-2 border-dashed border-muted-foreground/25 bg-muted/50 hover:bg-muted/75"
            variant="outline"
          >
            {uploading ? (
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span>Uploading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <span>Click to upload BPMN file</span>
                <span className="text-sm text-muted-foreground">
                  Supports .bpmn, .bpmn2, and .xml files
                </span>
              </div>
            )}
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".bpmn,.bpmn2,.xml"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUpload;