import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Activity, Clock, User, Download, Edit, Upload, Save, GitBranch, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AuditEntry {
  id: string;
  action_type: string;
  action_details: any;
  ai_suggestion_data?: any;
  created_at: string;
  user_id: string;
  version_id?: string;
}

interface BpmnAuditTrailProps {
  fileId: string;
  fileName: string;
}

const BpmnAuditTrail = ({ fileId, fileName }: BpmnAuditTrailProps) => {
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const { toast } = useToast();

  const loadAuditTrail = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bpmn_audit_trail')
        .select('*')
        .eq('bpmn_file_id', fileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAuditEntries(data || []);
      setShowAudit(true);
    } catch (error: any) {
      console.error('Error loading audit trail:', error);
      toast({
        title: "Error",
        description: "Failed to load audit trail.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportAuditTrail = async () => {
    try {
      const auditReport = {
        fileName: fileName,
        fileId: fileId,
        generatedAt: new Date().toISOString(),
        totalActivities: auditEntries.length,
        auditTrail: auditEntries.map(entry => ({
          timestamp: entry.created_at,
          action: entry.action_type,
          details: entry.action_details,
          aiSuggestions: entry.ai_suggestion_data,
          versionId: entry.version_id
        }))
      };

      const blob = new Blob([JSON.stringify(auditReport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.replace(/\.[^/.]+$/, '')}_audit_trail.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Audit Trail Exported",
        description: "Complete audit trail has been downloaded.",
      });
    } catch (error: any) {
      console.error('Error exporting audit trail:', error);
      toast({
        title: "Export Error",
        description: "Failed to export audit trail.",
        variant: "destructive",
      });
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'upload': return <Upload className="h-4 w-4" />;
      case 'ai_suggestion_applied': return <GitBranch className="h-4 w-4" />;
      case 'manual_edit': return <Edit className="h-4 w-4" />;
      case 'download': return <Download className="h-4 w-4" />;
      case 'template_save': return <Save className="h-4 w-4" />;
      case 'bizagi_export': return <FileText className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'upload': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'ai_suggestion_applied': return 'bg-green-100 text-green-700 border-green-300';
      case 'manual_edit': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'download': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'template_save': return 'bg-cyan-100 text-cyan-700 border-cyan-300';
      case 'bizagi_export': return 'bg-indigo-100 text-indigo-700 border-indigo-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const formatActionType = (actionType: string) => {
    return actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatActionDetails = (actionType: string, details: any) => {
    switch (actionType) {
      case 'upload':
        return `File "${details.file_name}" uploaded (${Math.round((details.file_size || 0) / 1024)} KB)`;
      case 'ai_suggestion_applied':
        return `Applied ${details.change_summary || 'AI suggestions'} (Version ${details.version_number})`;
      case 'download':
        return `Downloaded ${details.download_type || 'file'}`;
      case 'template_save':
        return `Saved as template`;
      case 'bizagi_export':
        return `Exported to Bizagi`;
      default:
        return JSON.stringify(details);
    }
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-primary" />
            <span>Audit Trail</span>
          </CardTitle>
          <CardDescription>
            Complete activity log for this BPMN file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center space-x-2">
              <Button onClick={loadAuditTrail} disabled={loading}>
                <Activity className="h-4 w-4 mr-2" />
                {loading ? 'Loading...' : 'Load Audit Trail'}
              </Button>
              
              {auditEntries.length > 0 && (
                <Button variant="outline" onClick={exportAuditTrail}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Audit Trail
                </Button>
              )}
            </div>

            {/* Audit Trail */}
            {showAudit && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Activity History ({auditEntries.length} entries)</h4>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {auditEntries.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No audit entries found</p>
                    </div>
                  ) : (
                    auditEntries.map((entry, index) => (
                      <div key={entry.id} className="flex items-start space-x-3 p-3 border rounded-md bg-background">
                        <div className="flex-shrink-0 mt-1">
                          <Badge className={`text-xs ${getActionColor(entry.action_type)}`}>
                            <span className="flex items-center space-x-1">
                              {getActionIcon(entry.action_type)}
                              <span>{formatActionType(entry.action_type)}</span>
                            </span>
                          </Badge>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium">
                              {formatActionDetails(entry.action_type, entry.action_details)}
                            </span>
                            {entry.version_id && (
                              <Badge variant="outline" className="text-xs">
                                v{entry.action_details?.version_number || '?'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatDate(entry.created_at)}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <User className="h-3 w-3" />
                              <span>{entry.user_id.slice(0, 8)}...</span>
                            </span>
                          </div>
                          {entry.ai_suggestion_data && (
                            <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded border-l-2 border-emerald-300">
                              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                AI Suggestions Applied: {Array.isArray(entry.ai_suggestion_data) ? entry.ai_suggestion_data.length : 1} changes
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-xs text-muted-foreground">
                          #{auditEntries.length - index}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default BpmnAuditTrail;