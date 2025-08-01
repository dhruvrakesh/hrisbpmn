import { useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/dist/bpmn-modeler.production.min.js';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ZoomIn, ZoomOut, RotateCcw, Play, Save, Undo, Redo, FolderOpen, Download, Zap, Edit3, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import BizagiIntegration from './BizagiIntegration';

interface BpmnViewerProps {
  fileId: string;
  fileName: string;
  filePath: string;
  onAnalyze?: () => void;
  onSave?: () => void;
  suggestions?: AIEditingSuggestion[];
  onSuggestionApplied?: (suggestion: AIEditingSuggestion) => void;
}

interface AIEditingSuggestion {
  id: string;
  type: 'add-task' | 'change-gateway' | 'optimize-flow' | 'add-role';
  elementId?: string;
  description: string;
  details: any;
}

const BpmnViewer = ({ fileId, fileName, filePath, onAnalyze, onSave, suggestions = [], onSuggestionApplied }: BpmnViewerProps) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bpmnModelerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [currentBpmnXml, setCurrentBpmnXml] = useState<string>('');
  const { toast } = useToast();

  const getCurrentBpmnXml = async (): Promise<string> => {
    if (!bpmnModelerRef.current) return '';
    try {
      const result = await bpmnModelerRef.current.saveXML({ format: true });
      return result.xml;
    } catch {
      return '';
    }
  };

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
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Upload the modified XML to Supabase Storage with user ID path
      const timestamp = Date.now();
      const newFileName = `${timestamp}_${fileName}`;
      const newFilePath = `${user.id}/${newFileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('bpmn-files')
        .upload(newFilePath, new Blob([xml], { type: 'application/xml' }), {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Update the database record
      const { error: dbError } = await supabase
        .from('bpmn_files')
        .insert({
          user_id: user.id,
          file_name: newFileName,
          file_path: newFilePath,
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
    if (!bpmnModelerRef.current) return;

    try {
      const modeler = bpmnModelerRef.current;
      const modeling = modeler.get('modeling');
      const elementFactory = modeler.get('elementFactory');
      const elementRegistry = modeler.get('elementRegistry');
      const canvas = modeler.get('canvas');

      // Get canvas dimensions for intelligent positioning
      const viewbox = canvas.viewbox();
      const centerX = viewbox.x + (viewbox.width / 2);
      const centerY = viewbox.y + (viewbox.height / 2);

      switch (suggestion.type) {
        case 'add-task':
          // Create new task with intelligent positioning
          const taskElement = elementFactory.createShape({ 
            type: 'bpmn:Task',
            businessObject: modeler.get('bpmnFactory').create('bpmn:Task', {
              name: suggestion.details?.name || 'New Task'
            })
          });
          
          // Position near the specified element or at center
          let position = { x: centerX, y: centerY };
          if (suggestion.elementId) {
            const targetElement = elementRegistry.get(suggestion.elementId);
            if (targetElement) {
              position = {
                x: targetElement.x + 150,
                y: targetElement.y
              };
            }
          }
          
          modeling.createShape(taskElement, position, canvas.getRootElement());
          break;

        case 'change-gateway':
          if (suggestion.elementId) {
            const element = elementRegistry.get(suggestion.elementId);
            if (element && element.type.includes('Gateway')) {
              const newGatewayType = suggestion.details?.gatewayType || 'bpmn:ExclusiveGateway';
              const newGateway = elementFactory.createShape({ type: newGatewayType });
              modeling.replaceShape(element, newGateway);
            }
          }
          break;

        case 'optimize-flow':
          // Remove unnecessary intermediate events or simplify paths
          if (suggestion.details?.removeElements) {
            suggestion.details.removeElements.forEach((elementId: string) => {
              const element = elementRegistry.get(elementId);
              if (element) {
                modeling.removeShape(element);
              }
            });
          }
          break;

        case 'add-role':
          // Add a new lane with role assignment
          const laneElement = elementFactory.createShape({ 
            type: 'bpmn:Lane',
            businessObject: modeler.get('bpmnFactory').create('bpmn:Lane', {
              name: suggestion.details?.roleName || 'New Role'
            })
          });
          
          // Try to add to existing participant or create new one
          const participants = elementRegistry.filter(element => element.type === 'bpmn:Participant');
          if (participants.length > 0) {
            modeling.createShape(laneElement, { x: 0, y: 0 }, participants[0]);
          }
          break;

        default:
          console.warn('Unknown suggestion type:', suggestion.type);
      }
      
      // Mark as having changes
      setHasChanges(true);
      
      toast({
        title: "Suggestion Applied",
        description: suggestion.description,
      });

      // Notify parent component
      onSuggestionApplied?.(suggestion);
    } catch (error) {
      console.error('Error applying suggestion:', error);
      toast({
        title: "Error",
        description: "Failed to apply suggestion. The element might not exist or the operation is not valid.",
        variant: "destructive",
      });
    }
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Edit3 className="h-5 w-5 text-primary" />
                <span>BPMN Editor</span>
                {hasChanges && (
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="text-sm text-orange-500 animate-pulse">●</span>
                    </TooltipTrigger>
                    <TooltipContent>Unsaved changes</TooltipContent>
                  </Tooltip>
                )}
                {!loading && !hasChanges && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-300">
                    Ready to Edit
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="flex items-center space-x-2">
                <span>{fileName}</span>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <p>• Click elements to select and edit</p>
                      <p>• Use palette on left to add elements</p>
                      <p>• Right-click for context menu</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {/* Editing Controls */}
              <div className="flex items-center space-x-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={!hasChanges}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save to Process History</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleUndo}>
                      <Undo className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Undo</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleRedo}>
                      <Redo className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Redo</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleSaveAsTemplate}>
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save as Template</TooltipContent>
                </Tooltip>
              </div>
              
              {/* View Controls */}
              <div className="border-l pl-2 ml-2 flex items-center space-x-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleZoomIn}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom In</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleZoomOut}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom Out</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleResetZoom}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Fit to View</TooltipContent>
                </Tooltip>
              </div>
              
              {/* Bizagi Integration */}
              <div className="border-l pl-2 ml-2">
                <BizagiIntegration 
                  getBpmnXml={getCurrentBpmnXml}
                  fileName={fileName}
                />
              </div>
              
              {/* Analysis */}
              {onAnalyze && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={onAnalyze} className="ml-4">
                      <Play className="h-4 w-4 mr-2" />
                      AI Analysis
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Analyze process with AI</TooltipContent>
                </Tooltip>
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
          <div className="mt-4 p-4 border rounded-md bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
            <h4 className="font-semibold mb-3 text-emerald-800 dark:text-emerald-200 flex items-center">
              <Zap className="h-4 w-4 mr-2" />
              AI Editing Suggestions ({suggestions.length} available)
            </h4>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="flex items-start justify-between p-3 bg-white dark:bg-gray-800/50 rounded border shadow-sm">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-700 border-emerald-300">
                        {suggestion.type.replace('-', ' ').toUpperCase()}
                      </Badge>
                      {suggestion.elementId && (
                        <Badge variant="secondary" className="text-xs">
                          {suggestion.elementId}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium mb-1">{suggestion.description}</p>
                    {suggestion.details?.implementation && (
                      <p className="text-xs text-muted-foreground">
                        {suggestion.details.implementation}
                      </p>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => applySuggestion(suggestion)}
                    className="ml-3 bg-emerald-600 hover:bg-emerald-700 text-white"
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
    </TooltipProvider>
  );
};

export default BpmnViewer;