import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, History, Clock, User, GitBranch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BpmnVersion {
  id: string;
  version_number: number;
  version_type: string;
  bpmn_xml: string;
  file_path?: string;
  created_at: string;
  created_by: string;
  ai_suggestions_applied: any;
  change_summary?: string;
  file_size?: number;
}

interface BpmnDownloadManagerProps {
  fileId: string;
  fileName: string;
  onDownload?: (type: string) => void;
}

const BpmnDownloadManager = ({ fileId, fileName, onDownload }: BpmnDownloadManagerProps) => {
  const [versions, setVersions] = useState<BpmnVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const { toast } = useToast();

  const loadVersions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bpmn_versions')
        .select('*')
        .eq('bpmn_file_id', fileId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
      setShowVersions(true);
    } catch (error: any) {
      console.error('Error loading versions:', error);
      toast({
        title: "Error",
        description: "Failed to load version history.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadVersion = async (version: BpmnVersion, type: 'xml' | 'original' = 'xml') => {
    try {
      // Log download activity
      await supabase.rpc('log_bpmn_download', {
        p_bpmn_file_id: fileId,
        p_version_id: version.id,
        p_download_type: `${type}_version_${version.version_number}`
      });

      let content = version.bpmn_xml;
      let downloadFileName = `${fileName.replace(/\.[^/.]+$/, '')}_v${version.version_number}.bpmn`;

      if (type === 'xml') {
        // Download the BPMN XML content
        const blob = new Blob([content], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      onDownload?.(type);
      
      toast({
        title: "Download Complete",
        description: `Version ${version.version_number} downloaded successfully.`,
      });
    } catch (error: any) {
      console.error('Error downloading version:', error);
      toast({
        title: "Download Error",
        description: error.message || "Failed to download version.",
        variant: "destructive",
      });
    }
  };

  const downloadComparison = async () => {
    if (versions.length < 2) {
      toast({
        title: "No Comparison Available",
        description: "At least 2 versions are needed for comparison.",
        variant: "destructive",
      });
      return;
    }

    try {
      const latest = versions[0];
      const original = versions[versions.length - 1];
      
      const comparisonReport = {
        fileName: fileName,
        generatedAt: new Date().toISOString(),
        latestVersion: {
          version: latest.version_number,
          type: latest.version_type,
          createdAt: latest.created_at,
          changesSummary: latest.change_summary,
          aiSuggestionsApplied: latest.ai_suggestions_applied?.length || 0
        },
        originalVersion: {
          version: original.version_number,
          type: original.version_type,
          createdAt: original.created_at
        },
        totalVersions: versions.length,
        versionHistory: versions.map(v => ({
          version: v.version_number,
          type: v.version_type,
          createdAt: v.created_at,
          changesSummary: v.change_summary,
          aiSuggestionsCount: v.ai_suggestions_applied?.length || 0
        }))
      };

      const blob = new Blob([JSON.stringify(comparisonReport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.replace(/\.[^/.]+$/, '')}_comparison_report.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Comparison Report Downloaded",
        description: "Version comparison report has been generated.",
      });
    } catch (error: any) {
      console.error('Error generating comparison:', error);
      toast({
        title: "Error",
        description: "Failed to generate comparison report.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getVersionTypeColor = (type: string) => {
    switch (type) {
      case 'original': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'ai_revised': return 'bg-green-100 text-green-700 border-green-300';
      case 'manual_edit': return 'bg-orange-100 text-orange-700 border-orange-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getVersionTypeIcon = (type: string) => {
    switch (type) {
      case 'original': return <FileText className="h-3 w-3" />;
      case 'ai_revised': return <GitBranch className="h-3 w-3" />;
      case 'manual_edit': return <User className="h-3 w-3" />;
      default: return <FileText className="h-3 w-3" />;
    }
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5 text-primary" />
            <span>Download & Version History</span>
          </CardTitle>
          <CardDescription>
            Download different versions and view audit trail
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Quick Download Actions */}
            <div className="flex items-center space-x-2">
              <Button onClick={() => loadVersions()} disabled={loading}>
                <History className="h-4 w-4 mr-2" />
                {loading ? 'Loading...' : 'View Versions'}
              </Button>
              
              {versions.length > 1 && (
                <Button variant="outline" onClick={downloadComparison}>
                  <FileText className="h-4 w-4 mr-2" />
                  Comparison Report
                </Button>
              )}
            </div>

            {/* Version History */}
            {showVersions && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Version History ({versions.length} versions)</h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {versions.map((version) => (
                    <div key={version.id} className="flex items-center justify-between p-3 border rounded-md bg-background">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge className={`text-xs ${getVersionTypeColor(version.version_type)}`}>
                            <span className="flex items-center space-x-1">
                              {getVersionTypeIcon(version.version_type)}
                              <span>v{version.version_number}</span>
                            </span>
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {version.version_type.replace('_', ' ')}
                          </Badge>
                          {version.ai_suggestions_applied?.length > 0 && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">
                                  {version.ai_suggestions_applied.length} AI changes
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  AI suggestions applied in this version
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <span className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(version.created_at)}</span>
                          </span>
                          {version.file_size && (
                            <span>{Math.round(version.file_size / 1024)} KB</span>
                          )}
                        </div>
                        {version.change_summary && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {version.change_summary}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadVersion(version, 'xml')}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Download BPMN XML</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default BpmnDownloadManager;