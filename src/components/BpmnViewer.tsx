import { useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/dist/bpmn-modeler.production.min.js';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ZoomIn, ZoomOut, RotateCcw, Play, Save, Undo, Redo, FolderOpen, Download } from 'lucide-react';

interface BpmnViewerProps {
  fileId: string;
  fileName: string;
  filePath: string;
  onAnalyze?: () => void;
  onSave?: () => void;
}

interface AIEditingSuggestion {
  id: string;
  type: 'add-task' | 'change-gateway' | 'optimize-flow' | 'add-role';
  elementId?: string;
  description: string;
  details: any;
}

const BpmnViewer = ({ fileId, fileName, filePath, onAnalyze, onSave }: BpmnViewerProps) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bpmnModelerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [suggestions, setSuggestions] = useState<AIEditingSuggestion[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!viewerRef.current) return;

    // Initialize BPMN modeler for editing
    bpmnModelerRef.current = new BpmnModeler({
      container: viewerRef.current,
      width: '100%',
      height: '500px',
      keyboard: {
        bindTo: document
      }
    });

    // Add event listeners for changes
    bpmnModelerRef.current.on('commandStack.changed', () => {
      setHasChanges(true);
    });

    loadBpmnFile();

    return () => {
      if (bpmnModelerRef.current) {
        bpmnModelerRef.current.destroy();
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
      await bpmnModelerRef.current.importXML(text);
      
      // Fit diagram to viewport
      const canvas = bpmnModelerRef.current.get('canvas');
      canvas.zoom('fit-viewport');
      
      setHasChanges(false);

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
    const canvas = bpmnModelerRef.current?.get('canvas');
    canvas?.zoom(canvas.zoom() * 1.2);
  };

  const handleZoomOut = () => {
    const canvas = bpmnModelerRef.current?.get('canvas');
    canvas?.zoom(canvas.zoom() * 0.8);
  };

  const handleResetZoom = () => {
    const canvas = bpmnModelerRef.current?.get('canvas');
    canvas?.zoom('fit-viewport');
  };

  const handleSave = async () => {
    try {
      const result = await bpmnModelerRef.current.saveXML({ format: true });
      const { xml } = result;
      
      // Upload the modified XML to Supabase Storage
      const timestamp = Date.now();
      const newFileName = `${timestamp}_${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('bpmn-files')
        .upload(newFileName, new Blob([xml], { type: 'application/xml' }), {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Update the database record
      const { error: dbError } = await supabase
        .from('bpmn_files')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          file_name: newFileName,
          file_path: newFileName,
          file_size: xml.length
        });

      if (dbError) throw dbError;

      setHasChanges(false);
      onSave?.();
      
      toast({
        title: "Diagram Saved",
        description: "Your BPMN diagram has been saved successfully.",
      });
    } catch (error: any) {
      console.error('Error saving BPMN:', error);
      toast({
        title: "Save Error",
        description: error.message || "Failed to save BPMN diagram.",
        variant: "destructive",
      });
    }
  };

  const handleUndo = () => {
    const commandStack = bpmnModelerRef.current?.get('commandStack');
    commandStack?.undo();
  };

  const handleRedo = () => {
    const commandStack = bpmnModelerRef.current?.get('commandStack');
    commandStack?.redo();
  };

  const handleSaveAsTemplate = async () => {
    try {
      const result = await bpmnModelerRef.current.saveXML({ format: true });
      const { xml } = result;
      
      const templateName = prompt('Enter template name:');
      if (!templateName) return;
      
      const description = prompt('Enter template description (optional):') || '';
      
      const { error } = await supabase
        .from('bpmn_templates')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          template_name: templateName,
          description: description,
          bpmn_xml: xml,
          category: 'custom'
        });

      if (error) throw error;

      toast({
        title: "Template Saved",
        description: `Template "${templateName}" has been saved successfully.`,
      });
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: "Template Save Error",
        description: error.message || "Failed to save template.",
        variant: "destructive",
      });
    }
  };

  const applySuggestion = async (suggestion: AIEditingSuggestion) => {
    try {
      const modeling = bpmnModelerRef.current.get('modeling');
      const elementFactory = bpmnModelerRef.current.get('elementFactory');
      const elementRegistry = bpmnModelerRef.current.get('elementRegistry');
      
      switch (suggestion.type) {
        case 'add-task':
          const businessObject = elementFactory.createShape({ type: 'bpmn:Task' });
          modeling.createShape(businessObject, { x: 300, y: 200 }, elementRegistry.get('Process_1'));
          break;
        case 'change-gateway':
          if (suggestion.elementId) {
            const element = elementRegistry.get(suggestion.elementId);
            if (element) {
              modeling.replaceShape(element, elementFactory.createShape({ type: 'bpmn:ExclusiveGateway' }));
            }
          }
          break;
        // Add more suggestion types as needed
      }
      
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      
      toast({
        title: "Suggestion Applied",
        description: suggestion.description,
      });
    } catch (error: any) {
      console.error('Error applying suggestion:', error);
      toast({
        title: "Application Error",
        description: "Failed to apply suggestion.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <span>BPMN Editor</span>
              {hasChanges && <span className="text-sm text-orange-500">●</span>}
            </CardTitle>
            <CardDescription>{fileName}</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {/* Editing Controls */}
            <Button variant="outline" size="sm" onClick={handleSave} disabled={!hasChanges}>
              <Save className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleUndo}>
              <Undo className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleRedo}>
              <Redo className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleSaveAsTemplate}>
              <FolderOpen className="h-4 w-4" />
            </Button>
            
            {/* View Controls */}
            <div className="border-l pl-2 ml-2">
              <Button variant="outline" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetZoom}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Analysis */}
            {onAnalyze && (
              <Button onClick={onAnalyze} className="ml-4">
                <Play className="h-4 w-4 mr-2" />
                AI Analysis
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
        
        {/* AI Suggestions Panel */}
        {suggestions.length > 0 && (
          <div className="mt-4 p-4 border rounded-md bg-muted">
            <h4 className="font-semibold mb-3">AI Editing Suggestions</h4>
            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="flex items-center justify-between p-2 bg-background rounded border">
                  <span className="text-sm">{suggestion.description}</span>
                  <Button 
                    size="sm" 
                    onClick={() => applySuggestion(suggestion)}
                    className="ml-2"
                  >
                    Apply
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BpmnViewer;