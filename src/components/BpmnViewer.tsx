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

    // Listen for external applySuggestion events
    const handleApplySuggestionEvent = (event: CustomEvent) => {
      applySuggestion(event.detail);
    };
    
    window.addEventListener('applySuggestion', handleApplySuggestionEvent as EventListener);

    loadBpmnFile();

    return () => {
      if (bpmnModelerRef.current) {
        bpmnModelerRef.current.destroy();
      }
      window.removeEventListener('applySuggestion', handleApplySuggestionEvent as EventListener);
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
      
      // Get the next version number
      const { data: maxVersion } = await supabase
        .from('bpmn_versions')
        .select('version_number')
        .eq('bpmn_file_id', fileId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      const nextVersion = (maxVersion?.version_number || 0) + 1;

      // Create new version
      await supabase
        .from('bpmn_versions')
        .insert({
          bpmn_file_id: fileId,
          version_number: nextVersion,
          version_type: 'manual_edit',
          bpmn_xml: xml,
          created_by: user.id,
          change_summary: 'Manual edit - diagram updated',
        });

      // Create audit trail entry
      await supabase
        .from('bpmn_audit_trail')
        .insert({
          bpmn_file_id: fileId,
          action_type: 'manual_edit',
          user_id: user.id,
          action_details: { 
            version_created: nextVersion,
            change_summary: 'Manual edit - diagram updated'
          }
        });

      setHasChanges(false);
      onSave?.();
      
      toast({
        title: "Diagram Saved",
        description: "Your BPMN diagram has been saved as a new version.",
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
    if (!bpmnModelerRef.current) {
      console.error('BPMN modeler not initialized');
      toast({
        title: "Error",
        description: "BPMN editor is not ready. Please wait for the diagram to load.",
        variant: "destructive",
      });
      return;
    }

    console.log('Applying AI suggestion:', suggestion);

    try {
      const modeler = bpmnModelerRef.current;
      const modeling = modeler.get('modeling');
      const elementFactory = modeler.get('elementFactory');
      const elementRegistry = modeler.get('elementRegistry');
      const canvas = modeler.get('canvas');
      const bpmnFactory = modeler.get('bpmnFactory');

      if (!modeling || !elementFactory || !elementRegistry || !canvas || !bpmnFactory) {
        throw new Error('BPMN modeler services not available');
      }

      // Get canvas dimensions for intelligent positioning
      const viewbox = canvas.viewbox();
      const centerX = viewbox.x + (viewbox.width / 2);
      const centerY = viewbox.y + (viewbox.height / 2);

      let operationSuccess = false;

      try {
        switch (suggestion.type) {
          case 'add-task':
            console.log('Creating new task element');
            
            // Ensure we have a valid parent container
            const rootElement = canvas.getRootElement();
            if (!rootElement) {
              throw new Error('No root element found in BPMN diagram');
            }

            // Create business object first
            const taskBusinessObject = bpmnFactory.create('bpmn:Task', {
              id: 'Task_' + Math.random().toString(36).substr(2, 9),
              name: suggestion.details?.name || 'New Task'
            });

            // Create task element
            const taskElement = elementFactory.createShape({ 
              type: 'bpmn:Task',
              businessObject: taskBusinessObject
            });
            
            if (!taskElement) {
              throw new Error('Failed to create task element');
            }
            
            // Position near the specified element or at center
            let position = { x: centerX, y: centerY };
            if (suggestion.elementId) {
              const targetElement = elementRegistry.get(suggestion.elementId);
              if (targetElement && targetElement.x !== undefined && targetElement.y !== undefined) {
                position = {
                  x: targetElement.x + 150,
                  y: targetElement.y
                };
              }
            }
            
            console.log('Creating shape at position:', position);
            const createdShape = modeling.createShape(taskElement, position, rootElement);
            if (createdShape) {
              operationSuccess = true;
              console.log('Task created successfully:', createdShape.id);
            }
            break;

          case 'change-gateway':
            if (!suggestion.elementId) {
              throw new Error('No element ID specified for gateway change');
            }
            
            const element = elementRegistry.get(suggestion.elementId);
            if (!element) {
              throw new Error(`Element not found: ${suggestion.elementId}`);
            }
            
            if (!element.type.includes('Gateway')) {
              throw new Error(`Element ${suggestion.elementId} is not a gateway`);
            }
            
            const newGatewayType = suggestion.details?.gatewayType || 'bpmn:ExclusiveGateway';
            const gatewayBusinessObject = bpmnFactory.create(newGatewayType, {
              id: element.businessObject.id + '_new'
            });
            
            const newGateway = elementFactory.createShape({ 
              type: newGatewayType,
              businessObject: gatewayBusinessObject
            });
            
            const replacedElement = modeling.replaceShape(element, newGateway);
            if (replacedElement) {
              operationSuccess = true;
              console.log('Gateway replaced successfully');
            }
            break;

          case 'optimize-flow':
            if (suggestion.details?.removeElements && Array.isArray(suggestion.details.removeElements)) {
              let removedCount = 0;
              suggestion.details.removeElements.forEach((elementId: string) => {
                try {
                  const element = elementRegistry.get(elementId);
                  if (element) {
                    modeling.removeShape(element);
                    removedCount++;
                  }
                } catch (removeError) {
                  console.warn(`Failed to remove element ${elementId}:`, removeError);
                }
              });
              
              if (removedCount > 0) {
                operationSuccess = true;
                console.log(`Removed ${removedCount} elements for flow optimization`);
              }
            }
            break;

          case 'add-role':
            console.log('Creating new lane/role');
            
            // Create lane business object
            const laneBusinessObject = bpmnFactory.create('bpmn:Lane', {
              id: 'Lane_' + Math.random().toString(36).substr(2, 9),
              name: suggestion.details?.roleName || 'New Role'
            });

            const laneElement = elementFactory.createShape({ 
              type: 'bpmn:Lane',
              businessObject: laneBusinessObject
            });
            
            // Try to add to existing participant or create new one
            const participants = elementRegistry.filter(element => element.type === 'bpmn:Participant');
            let targetParent = canvas.getRootElement();
            
            if (participants.length > 0) {
              targetParent = participants[0];
            }
            
            const createdLane = modeling.createShape(laneElement, { x: 50, y: 50 }, targetParent);
            if (createdLane) {
              operationSuccess = true;
              console.log('Lane/role created successfully');
            }
            break;

          default:
            throw new Error(`Unknown suggestion type: ${suggestion.type}`);
        }
      } catch (bpmnError) {
        console.error('BPMN operation failed:', bpmnError);
        // Retry once for keyboard binding issues
        if (bpmnError.message?.includes('keyboard') && !operationSuccess) {
          console.log('Retrying BPMN operation after keyboard error...');
          try {
            // Simple retry without keyboard dependency
            switch (suggestion.type) {
              case 'add-task':
                const taskBusinessObject2 = bpmnFactory.create('bpmn:Task', {
                  id: 'Task_' + Math.random().toString(36).substr(2, 9),
                  name: suggestion.details?.name || 'New Task'
                });
                const taskElement2 = elementFactory.createShape({ 
                  type: 'bpmn:Task',
                  businessObject: taskBusinessObject2
                });
                const createdShape2 = modeling.createShape(taskElement2, { x: centerX, y: centerY }, canvas.getRootElement());
                if (createdShape2) operationSuccess = true;
                break;
            }
          } catch (retryError) {
            console.error('Retry failed:', retryError);
          }
        }
        
        if (!operationSuccess) {
          throw new Error(`BPMN operation failed: ${bpmnError.message}`);
        }
      }

      if (!operationSuccess) {
        throw new Error('Operation completed but no changes were detected');
      }
      
      // Mark as having changes
      setHasChanges(true);
      
      // Save the current state as a new version with AI suggestion applied
      try {
        console.log('Starting AI suggestion save process for:', suggestion.type);
        const result = await bpmnModelerRef.current.saveXML({ format: true });
        const { xml } = result;
        
        // Get current user for AI suggestions
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No authenticated user found');
          throw new Error('User not authenticated');
        }

        console.log('User authenticated:', user.id);

        // Get the next version number
        const { data: maxVersion, error: versionError } = await supabase
          .from('bpmn_versions')
          .select('version_number')
          .eq('bpmn_file_id', fileId)
          .order('version_number', { ascending: false })
          .limit(1)
          .single();

        if (versionError && versionError.code !== 'PGRST116') {
          console.error('Error getting max version:', versionError);
          throw versionError;
        }

        const nextVersion = (maxVersion?.version_number || 0) + 1;
        console.log('Creating version:', nextVersion);

        // Create new version with proper ai_suggestions_applied format
        const { error: insertVersionError } = await supabase
          .from('bpmn_versions')
          .insert({
            bpmn_file_id: fileId,
            version_number: nextVersion,
            version_type: 'ai_revised',
            bpmn_xml: xml,
            created_by: user.id,
            change_summary: `AI suggestion applied: ${suggestion.description}`,
            ai_suggestions_applied: JSON.stringify([suggestion]) // Store as proper JSON array
          });

        if (insertVersionError) {
          console.error('Error creating version:', insertVersionError);
          throw insertVersionError;
        }

        console.log('Version created successfully');

        // Create audit trail entry
        const { error: auditError } = await supabase
          .from('bpmn_audit_trail')
          .insert({
            bpmn_file_id: fileId,
            action_type: 'ai_suggestion_applied',
            user_id: user.id,
            action_details: { 
              version_created: nextVersion,
              suggestion_type: suggestion.type,
              description: suggestion.description,
              element_id: suggestion.elementId,
              timestamp: new Date().toISOString()
            },
            ai_suggestion_data: JSON.stringify(suggestion) // Store as proper JSON object
          });

        if (auditError) {
          console.error('Error creating audit trail:', auditError);
          throw auditError;
        }

        console.log('Audit trail created successfully');
        
      } catch (versionError) {
        console.error('Error saving AI version:', versionError);
        // Re-throw the error so it's properly handled
        throw new Error(`Failed to save AI suggestion to database: ${versionError.message}`);
      }
      
      toast({
        title: "Suggestion Applied",
        description: suggestion.description,
      });

      // Notify parent component
      onSuggestionApplied?.(suggestion);
    } catch (error: any) {
      console.error('Error applying suggestion:', error);
      
      // Provide specific error messages based on error type
      let errorMessage = "Failed to apply suggestion.";
      
      if (error.message?.includes('Cannot read properties of undefined')) {
        errorMessage = "BPMN structure issue detected. The diagram may need to be refreshed or the operation is not compatible with this diagram structure.";
      } else if (error.message?.includes('Element not found')) {
        errorMessage = "The target element for this suggestion no longer exists in the diagram.";
      } else if (error.message?.includes('not available')) {
        errorMessage = "BPMN editor is not fully loaded. Please wait a moment and try again.";
      } else if (error.message?.includes('No root element')) {
        errorMessage = "Diagram structure is invalid. Try reloading the file.";
      } else if (error.message) {
        errorMessage = `Operation failed: ${error.message}`;
      }

      toast({
        title: "AI Suggestion Failed",
        description: errorMessage,
        variant: "destructive",
      });

      // Try to recover by refreshing the modeler state
      try {
        console.log('Attempting to recover BPMN modeler state...');
        const canvas = bpmnModelerRef.current?.get('canvas');
        canvas?.zoom('fit-viewport');
      } catch (recoveryError) {
        console.warn('Recovery attempt failed:', recoveryError);
      }
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