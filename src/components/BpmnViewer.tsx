import { useEffect, useRef, useState } from 'react';
import BpmnJS from 'bpmn-js/dist/bpmn-navigated-viewer.production.min.js';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ZoomIn, ZoomOut, RotateCcw, Play } from 'lucide-react';

interface BpmnViewerProps {
  fileId: string;
  fileName: string;
  filePath: string;
  onAnalyze?: () => void;
}

const BpmnViewer = ({ fileId, fileName, filePath, onAnalyze }: BpmnViewerProps) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bpmnViewerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!viewerRef.current) return;

    // Initialize BPMN viewer
    bpmnViewerRef.current = new BpmnJS({
      container: viewerRef.current,
      width: '100%',
      height: '500px',
    });

    loadBpmnFile();

    return () => {
      if (bpmnViewerRef.current) {
        bpmnViewerRef.current.destroy();
      }
    };
  }, [filePath]);

  const loadBpmnFile = async () => {
    try {
      setLoading(true);

      // Download file from Supabase Storage
      const { data, error } = await supabase.storage
        .from('bpmn-files')
        .download(filePath);

      if (error) {
        throw error;
      }

      // Convert blob to text
      const text = await data.text();

      // Load BPMN diagram
      await bpmnViewerRef.current.importXML(text);
      
      // Fit diagram to viewport
      const canvas = bpmnViewerRef.current.get('canvas');
      canvas.zoom('fit-viewport');

      toast({
        title: "BPMN Loaded",
        description: `${fileName} has been loaded successfully.`,
      });

    } catch (error: any) {
      console.error('Error loading BPMN:', error);
      toast({
        title: "Load Error",
        description: error.message || "Failed to load BPMN file.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleZoomIn = () => {
    const canvas = bpmnViewerRef.current?.get('canvas');
    canvas?.zoom(canvas.zoom() * 1.2);
  };

  const handleZoomOut = () => {
    const canvas = bpmnViewerRef.current?.get('canvas');
    canvas?.zoom(canvas.zoom() * 0.8);
  };

  const handleResetZoom = () => {
    const canvas = bpmnViewerRef.current?.get('canvas');
    canvas?.zoom('fit-viewport');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <span>BPMN Viewer</span>
            </CardTitle>
            <CardDescription>{fileName}</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleResetZoom}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            {onAnalyze && (
              <Button onClick={onAnalyze} className="ml-4">
                <Play className="h-4 w-4 mr-2" />
                Run Analysis
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div
            ref={viewerRef}
            className="w-full h-[500px] border rounded-md bg-background"
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <span className="text-sm text-muted-foreground">Loading BPMN...</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BpmnViewer;