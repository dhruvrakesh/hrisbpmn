import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  List, 
  Play, 
  GitBranch, 
  StopCircle, 
  Settings, 
  Users, 
  RefreshCw, 
  Info,
  Hash,
  Wand2
} from "lucide-react";

interface ProcessElement {
  stepNumber: number;
  stepDetail: string;
  swimLane: string;
  elementType: string;
  elementId: string;
}

interface SwimLane {
  id: string;
  name: string;
  elements: string[];
  type?: string;
}

interface ProcessElementBrowserProps {
  analysisResult: any;
  onElementUpdate?: (elementId: string, updates: any) => void;
  onSwimLaneUpdate?: (laneId: string, updates: any) => void;
}

export function ProcessElementBrowser({ 
  analysisResult, 
  onElementUpdate, 
  onSwimLaneUpdate 
}: ProcessElementBrowserProps) {
  const [open, setOpen] = useState(false);
  const [elements, setElements] = useState<ProcessElement[]>([]);
  const [swimLanes, setSwimLanes] = useState<SwimLane[]>([]);
  const [customizations, setCustomizations] = useState<any>({});
  const [editingElement, setEditingElement] = useState<string | null>(null);
  const [editingLane, setEditingLane] = useState<string | null>(null);

  // Extract data from analysis result
  useEffect(() => {
    if (analysisResult?.exportData?.numberedElements) {
      setElements(analysisResult.exportData.numberedElements);
    }
    
    if (analysisResult?.exportData?.laneDefinitions) {
      const lanes = Object.values(analysisResult.exportData.laneDefinitions) as SwimLane[];
      setSwimLanes(lanes);
    }
    
    loadCustomizations();
  }, [analysisResult]);

  const loadCustomizations = async () => {
    if (!analysisResult?.fileInfo?.fileId) return;
    
    try {
      // Load element customizations
      const { data: elementCustoms } = await supabase
        .from('bpmn_element_customizations')
        .select('*')
        .eq('analysis_result_id', analysisResult.fileInfo.fileId);
      
      // Load swim lane customizations
      const { data: laneCustoms } = await supabase
        .from('bpmn_swim_lane_customizations')
        .select('*')
        .eq('analysis_result_id', analysisResult.fileInfo.fileId);
      
      const customData = {};
      elementCustoms?.forEach(custom => {
        customData[custom.element_id] = custom;
      });
      laneCustoms?.forEach(custom => {
        customData[custom.lane_id] = custom;
      });
      
      setCustomizations(customData);
    } catch (error) {
      console.error('Error loading customizations:', error);
    }
  };

  const saveElementCustomization = async (elementId: string, updates: any) => {
    try {
      const element = elements.find(e => e.elementId === elementId);
      if (!element) return;

      const customization = {
        analysis_result_id: analysisResult.fileInfo.fileId,
        element_id: elementId,
        original_step_number: element.stepNumber,
        custom_step_number: updates.stepNumber,
        original_swim_lane: element.swimLane,
        custom_swim_lane: updates.swimLane,
        custom_description: updates.description,
        element_type: element.elementType,
        user_id: (await supabase.auth.getUser()).data.user?.id
      };

      const { error } = await supabase
        .from('bpmn_element_customizations')
        .upsert(customization, { onConflict: 'analysis_result_id,element_id' });

      if (error) throw error;

      setCustomizations(prev => ({
        ...prev,
        [elementId]: customization
      }));

      // Update local state
      setElements(prev => prev.map(el => 
        el.elementId === elementId 
          ? { 
              ...el, 
              stepNumber: updates.stepNumber || el.stepNumber,
              swimLane: updates.swimLane || el.swimLane,
              stepDetail: updates.description || el.stepDetail
            }
          : el
      ));

      toast({
        title: "Element Updated",
        description: "Your customizations have been saved.",
      });

      onElementUpdate?.(elementId, updates);
      setEditingElement(null);
    } catch (error) {
      console.error('Error saving customization:', error);
      toast({
        title: "Error",
        description: "Failed to save customizations.",
        variant: "destructive",
      });
    }
  };

  const getElementIcon = (elementType: string) => {
    switch (elementType) {
      case 'startEvent': return <Play className="h-4 w-4 text-green-600" />;
      case 'endEvent': return <StopCircle className="h-4 w-4 text-red-600" />;
      case 'userTask': return <Users className="h-4 w-4 text-blue-600" />;
      case 'serviceTask': return <Settings className="h-4 w-4 text-purple-600" />;
      case 'exclusiveGateway':
      case 'parallelGateway':
      case 'inclusiveGateway': return <GitBranch className="h-4 w-4 text-orange-600" />;
      default: return <List className="h-4 w-4 text-gray-600" />;
    }
  };

  const getElementTypeLabel = (elementType: string) => {
    switch (elementType) {
      case 'startEvent': return 'Start Event';
      case 'endEvent': return 'End Event';
      case 'userTask': return 'User Task';
      case 'serviceTask': return 'Service Task';
      case 'exclusiveGateway': return 'Exclusive Gateway';
      case 'parallelGateway': return 'Parallel Gateway';
      case 'inclusiveGateway': return 'Inclusive Gateway';
      default: return elementType;
    }
  };

  const groupedElements = elements.reduce((groups, element) => {
    const type = element.elementType;
    if (!groups[type]) groups[type] = [];
    groups[type].push(element);
    return groups;
  }, {} as Record<string, ProcessElement[]>);

  const resetToDefaults = () => {
    // Reset to original analysis data
    if (analysisResult?.exportData?.numberedElements) {
      setElements(analysisResult.exportData.numberedElements);
    }
    
    toast({
      title: "Reset Complete",
      description: "All elements have been reset to AI defaults.",
    });
  };

  const ElementEditForm = ({ element }: { element: ProcessElement }) => (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Edit Element</h4>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setEditingElement(null)}
        >
          Cancel
        </Button>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`step-${element.elementId}`}>Step Number</Label>
          <Input
            id={`step-${element.elementId}`}
            type="number"
            defaultValue={element.stepNumber}
            onChange={(e) => {
              const newNumber = parseInt(e.target.value);
              if (newNumber > 0) {
                saveElementCustomization(element.elementId, {
                  stepNumber: newNumber
                });
              }
            }}
          />
        </div>
        
        <div>
          <Label htmlFor={`lane-${element.elementId}`}>Swim Lane</Label>
          <Input
            id={`lane-${element.elementId}`}
            defaultValue={element.swimLane}
            onChange={(e) => {
              saveElementCustomization(element.elementId, {
                swimLane: e.target.value
              });
            }}
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor={`desc-${element.elementId}`}>Description</Label>
        <Input
          id={`desc-${element.elementId}`}
          defaultValue={element.stepDetail}
          onChange={(e) => {
            saveElementCustomization(element.elementId, {
              description: e.target.value
            });
          }}
        />
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <List className="h-4 w-4" />
          Browse Elements
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-6xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            Process Elements Browser
            <Badge variant="secondary">{elements.length} Elements</Badge>
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="elements" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="elements">Elements</TabsTrigger>
            <TabsTrigger value="swimlanes">Swim Lanes</TabsTrigger>
            <TabsTrigger value="numbering">Numbering Logic</TabsTrigger>
          </TabsList>
          
          <TabsContent value="elements" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Process Elements</h3>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={resetToDefaults}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reset to AI Default
                </Button>
              </div>
            </div>
            
            <ScrollArea className="h-[500px]">
              <div className="space-y-6">
                {Object.entries(groupedElements).map(([type, typeElements]) => (
                  <Card key={type}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        {getElementIcon(type)}
                        {getElementTypeLabel(type)}
                        <Badge variant="outline">{typeElements.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {typeElements.map((element) => (
                        <div key={element.elementId} className="space-y-2">
                          <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Badge className="min-w-[40px] justify-center">
                                #{element.stepNumber}
                              </Badge>
                              <div>
                                <p className="font-medium">{element.stepDetail}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>Swim Lane: {element.swimLane}</span>
                                  <Separator orientation="vertical" className="h-3" />
                                  <span>ID: {element.elementId}</span>
                                </div>
                              </div>
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingElement(
                                editingElement === element.elementId ? null : element.elementId
                              )}
                            >
                              <Wand2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {editingElement === element.elementId && (
                            <ElementEditForm element={element} />
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="swimlanes" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Swim Lanes & Responsibilities</h3>
              <Badge variant="secondary">{swimLanes.length} Lanes</Badge>
            </div>
            
            <ScrollArea className="h-[500px]">
              {swimLanes.length > 0 ? (
                <div className="space-y-4">
                  {swimLanes.map((lane) => (
                    <Card key={lane.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-blue-600" />
                          {lane.name}
                          <Badge variant="outline">{lane.elements?.length || 0} Elements</Badge>
                          {lane.type === 'inferred' && (
                            <Badge variant="secondary">AI Inferred</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Elements assigned to this lane:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {lane.elements?.map((elementId) => {
                              const element = elements.find(e => e.elementId === elementId);
                              return (
                                <Badge key={elementId} variant="outline" className="text-xs">
                                  #{element?.stepNumber}: {element?.stepDetail || elementId}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No swim lanes detected in this process. All elements are marked as "Unassigned".
                    Consider adding organizational lanes to better define responsibilities.
                  </AlertDescription>
                </Alert>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="numbering" className="space-y-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">AI Numbering Logic</h3>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      How Elements Are Numbered
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Badge className="bg-green-100 text-green-800">1</Badge>
                        <span>Start Events (Process Entry Points)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-blue-100 text-blue-800">2-N</Badge>
                        <span>User Tasks (Manual Activities)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-purple-100 text-purple-800">N+1</Badge>
                        <span>Service Tasks (Automated Activities)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-orange-100 text-orange-800">N+2</Badge>
                        <span>Gateways (Decision Points)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-red-100 text-red-800">Final</Badge>
                        <span>End Events (Process Completion)</span>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <h4 className="font-medium">Current Process Summary:</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>Total Elements: {elements.length}</div>
                        <div>Swim Lanes: {swimLanes.length}</div>
                        <div>User Tasks: {elements.filter(e => e.elementType === 'userTask').length}</div>
                        <div>Gateways: {elements.filter(e => e.elementType.includes('Gateway')).length}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  The AI analyzes your BPMN process flow and assigns sequential numbers based on logical process execution order. 
                  You can customize these numbers in the Elements tab to match your organization's preferences.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}