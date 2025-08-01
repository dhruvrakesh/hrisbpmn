import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useExport } from '@/hooks/useExport';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Clock,
  RefreshCw,
  Download,
  FileText,
  FileSpreadsheet,
  Zap,
  Play
} from 'lucide-react';

interface Finding {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'Error' | 'Warning' | 'Info';
  message: string;
  elementId: string | null;
  elementName: string | null;
  description: string;
}

interface AnalysisResult {
  fileId: string;
  fileName: string;
  analyzedAt: string;
  summary: {
    totalUserTasks: number;
    totalServiceTasks: number;
    totalGateways: number;
    totalEvents: number;
    processComplexity: number;
    riskLevel: string;
    tasksFound?: Array<{ id: string; name: string }>;
  };
  processIntelligence?: {
    insights: string[];
    recommendations: string[];
    riskAssessment: string;
    complianceNotes: string[];
    editingSuggestions?: Array<{
      id: string;
      type: 'add-task' | 'change-gateway' | 'optimize-flow' | 'add-role';
      elementId?: string;
      description: string;
      details: any;
    }>;
  };
  findings: Finding[];
}

interface AnalysisResultsProps {
  result: AnalysisResult | null;
  loading: boolean;
  onRefresh?: () => void;
  onApplySuggestion?: (suggestion: any) => void;
}

const AnalysisResults = ({ result, loading, onRefresh, onApplySuggestion }: AnalysisResultsProps) => {
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const { exportAnalysisToPDF, exportAnalysisToExcel } = useExport();
  const { toast } = useToast();

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'Error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'Warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'Info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  const getSeverityVariant = (severity: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (severity) {
      case 'Error':
        return 'destructive';
      case 'Warning':
        return 'secondary';
      case 'Info':
        return 'outline';
      default:
        return 'default';
    }
  };

  const handleExportPDF = async () => {
    if (!result) return;
    try {
      // Transform data to match export interface
      const exportData = {
        fileName: result.fileName,
        timestamp: result.analyzedAt,
        summary: {
          userTasks: result.summary.totalUserTasks,
          integrations: result.summary.totalServiceTasks,
          complexity: result.summary.riskLevel,
          issueCount: result.findings.length,
        },
        processIntelligence: result.processIntelligence,
        findings: result.findings.map(f => ({
          id: f.id,
          ruleName: f.ruleName,
          severity: f.severity.toLowerCase() as 'error' | 'warning' | 'info',
          message: f.message,
          elementId: f.elementId,
          elementName: f.elementName,
          description: f.description,
        })),
      };
      await exportAnalysisToPDF(exportData);
      toast({
        title: "Success",
        description: "Analysis exported to PDF successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export analysis to PDF",
        variant: "destructive",
      });
    }
  };

  const handleExportExcel = () => {
    if (!result) return;
    try {
      // Transform data to match export interface
      const exportData = {
        fileName: result.fileName,
        timestamp: result.analyzedAt,
        summary: {
          userTasks: result.summary.totalUserTasks,
          integrations: result.summary.totalServiceTasks,
          complexity: result.summary.riskLevel,
          issueCount: result.findings.length,
        },
        processIntelligence: result.processIntelligence,
        findings: result.findings.map(f => ({
          id: f.id,
          ruleName: f.ruleName,
          severity: f.severity.toLowerCase() as 'error' | 'warning' | 'info',
          message: f.message,
          elementId: f.elementId,
          elementName: f.elementName,
          description: f.description,
        })),
      };
      exportAnalysisToExcel(exportData);
      toast({
        title: "Success",
        description: "Analysis exported to Excel successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export analysis to Excel",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Analyzing Process...</span>
          </CardTitle>
          <CardDescription>
            Running HRIS best-practice analysis on your BPMN file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="animate-pulse bg-muted rounded-md h-4 w-48 mx-auto"></div>
              <div className="animate-pulse bg-muted rounded-md h-4 w-32 mx-auto"></div>
              <div className="animate-pulse bg-muted rounded-md h-4 w-40 mx-auto"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analysis Results</CardTitle>
          <CardDescription>
            Upload a BPMN file and click "Run Analysis" to see results here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No analysis results yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const errorCount = result.findings.filter(f => f.severity === 'Error').length;
  const warningCount = result.findings.filter(f => f.severity === 'Warning').length;
  const infoCount = result.findings.filter(f => f.severity === 'Info').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              {result.fileName} • Analyzed {new Date(result.analyzedAt).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-analyze
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enhanced Summary */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{result.summary.totalUserTasks}</div>
            <div className="text-sm text-muted-foreground">User Tasks</div>
          </div>
          {result.summary.totalServiceTasks !== undefined && (
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{result.summary.totalServiceTasks}</div>
              <div className="text-sm text-muted-foreground">Integrations</div>
            </div>
          )}
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{result.summary.processComplexity}</div>
            <div className="text-sm text-muted-foreground">Complexity</div>
          </div>
          <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <div className="text-2xl font-bold text-destructive">{errorCount}</div>
            <div className="text-sm text-muted-foreground">Errors</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
            <div className="text-sm text-muted-foreground">Warnings</div>
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{infoCount}</div>
            <div className="text-sm text-muted-foreground">Info</div>
          </div>
        </div>

        {/* AI Insights Panel */}
        {result.processIntelligence && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-3"></div>
              AI Process Intelligence
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">KEY INSIGHTS</h4>
                <ul className="space-y-2">
                  {result.processIntelligence.insights?.slice(0, 3).map((insight: string, index: number) => (
                    <li key={index} className="text-sm flex items-start">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 mr-2 flex-shrink-0"></div>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">RECOMMENDATIONS</h4>
                <ul className="space-y-2">
                  {result.processIntelligence.recommendations?.slice(0, 3).map((rec: string, index: number) => (
                    <li key={index} className="text-sm flex items-start">
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 mr-2 flex-shrink-0"></div>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {result.processIntelligence.riskAssessment && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <h4 className="font-medium text-sm text-muted-foreground mb-2">RISK ASSESSMENT</h4>
                <p className="text-sm">{result.processIntelligence.riskAssessment}</p>
              </div>
            )}
          </div>
        )}

        {/* AI Editing Suggestions */}
        {result.processIntelligence?.editingSuggestions && result.processIntelligence.editingSuggestions.length > 0 && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Zap className="h-5 w-5 text-emerald-600 mr-2" />
              AI Editing Suggestions
            </h3>
            <div className="space-y-4">
              {result.processIntelligence.editingSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="flex items-start justify-between p-4 bg-white dark:bg-gray-800/50 rounded-lg border">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="outline" className="text-xs">
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
                  {onApplySuggestion && (
                    <Button 
                      size="sm" 
                      className="ml-4 flex-shrink-0"
                      onClick={() => onApplySuggestion(suggestion)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Apply
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Findings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Findings</h3>
          {result.findings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p>No issues found in your process!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.findings.map((finding) => (
                <div
                  key={finding.id}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedFinding(
                    selectedFinding?.id === finding.id ? null : finding
                  )}
                >
                  <div className="flex items-start space-x-3">
                    {getSeverityIcon(finding.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge variant={getSeverityVariant(finding.severity)}>
                          {finding.severity}
                        </Badge>
                        <span className="font-medium">{finding.ruleName}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {finding.message}
                      </p>
                      {finding.elementName && (
                        <p className="text-xs text-muted-foreground">
                          Element: {finding.elementName} ({finding.elementId})
                        </p>
                      )}
                      {selectedFinding?.id === finding.id && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm">{finding.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalysisResults;