import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { FileText, Download, Trash2, Eye, Share2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Template {
  id: string;
  template_name: string;
  description: string;
  category: string;
  is_public: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  bpmn_xml: string;
}

interface TemplateManagerProps {
  onTemplateSelect: (template: Template) => void;
  currentTemplateId?: string;
}

const TemplateManager = ({ onTemplateSelect, currentTemplateId }: TemplateManagerProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadTemplates();

    // Set up real-time subscription for template changes
    const channel = supabase
      .channel('bpmn_templates_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bpmn_templates'
        },
        (payload) => {
          console.log('Template change detected:', payload);
          
          if (payload.eventType === 'INSERT') {
            setTemplates(prev => [payload.new as Template, ...prev]);
            toast({
              title: "New Template",
              description: `Template "${(payload.new as Template).template_name}" has been added.`,
            });
          } else if (payload.eventType === 'UPDATE') {
            setTemplates(prev => 
              prev.map(t => 
                t.id === payload.new.id 
                  ? { ...t, ...(payload.new as Template) }
                  : t
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setTemplates(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bpmn_templates')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error loading templates:', error);
      toast({
        title: "Load Error",
        description: error.message || "Failed to load templates.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      const { error } = await supabase
        .from('bpmn_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast({
        title: "Template Deleted",
        description: "Template has been deleted successfully.",
      });
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: "Delete Error",
        description: error.message || "Failed to delete template.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = (template: Template) => {
    const blob = new Blob([template.bpmn_xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.template_name}.bpmn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const togglePublic = async (template: Template) => {
    try {
      const { error } = await supabase
        .from('bpmn_templates')
        .update({ is_public: !template.is_public })
        .eq('id', template.id);

      if (error) throw error;

      setTemplates(prev => 
        prev.map(t => 
          t.id === template.id 
            ? { ...t, is_public: !t.is_public }
            : t
        )
      );

      toast({
        title: template.is_public ? "Template Made Private" : "Template Made Public",
        description: template.is_public 
          ? "Template is now private." 
          : "Template is now public and can be shared.",
      });
    } catch (error: any) {
      console.error('Error updating template:', error);
      toast({
        title: "Update Error",
        description: error.message || "Failed to update template.",
        variant: "destructive",
      });
    }
  };

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];
  const filteredTemplates = selectedCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <span className="text-sm text-muted-foreground">Loading templates...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category Filter and Refresh */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {categories.map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadTemplates}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Templates Found</h3>
            <p className="text-muted-foreground">
              {selectedCategory === 'all' 
                ? "You haven't saved any templates yet. Create and save a BPMN diagram to get started."
                : `No templates found in the "${selectedCategory}" category.`
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card 
              key={template.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                currentTemplateId === template.id ? 'ring-2 ring-primary' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{template.template_name}</CardTitle>
                  {template.is_public && (
                    <Badge variant="secondary" className="text-xs">
                      Public
                    </Badge>
                  )}
                </div>
                {template.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <Badge variant="outline" className="text-xs">
                    {template.category}
                  </Badge>
                  <span>
                    {formatDistanceToNow(new Date(template.updated_at), { addSuffix: true })}
                  </span>
                </div>
                
                {template.tags && template.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {template.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{template.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => onTemplateSelect(template)}
                    className="flex-1"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Load
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDownload(template)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => togglePublic(template)}
                  >
                    <Share2 className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplateManager;