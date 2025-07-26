import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Clock,
  RefreshCw
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
    totalServiceTasks?: number;
    totalGateways?: number;
    totalEvents?: number;
    complexityScore?: number;
    riskLevel?: string;
    tasksFound: Array<{ id: string; name: string }>;
  };
  processIntelligence?: {
    complexity: any;
    roleDistribution: any;
    aiInsights: any;
    stakeholderViews: any;
  };
  findings: Finding[];
}

interface AnalysisResultsProps {
  result: AnalysisResult | null;
  loading: boolean;
  onRefresh?: () => void;
}

const AnalysisResults = ({ result, loading, onRefresh }: AnalysisResultsProps) => {
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

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
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-analyze
            </Button>
          )}
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
          {result.summary.complexityScore !== undefined && (
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{result.summary.complexityScore}</div>
              <div className="text-sm text-muted-foreground">Complexity</div>
            </div>
          )}
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
        {result.processIntelligence?.aiInsights && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-6 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-3"></div>
              AI Process Intelligence
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">KEY INSIGHTS</h4>
                <ul className="space-y-2">
                  {result.processIntelligence.aiInsights.insights?.slice(0, 3).map((insight: string, index: number) => (
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
                  {result.processIntelligence.aiInsights.recommendations?.slice(0, 3).map((rec: string, index: number) => (
                    <li key={index} className="text-sm flex items-start">
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 mr-2 flex-shrink-0"></div>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {result.processIntelligence.aiInsights.implementationReadiness && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Implementation Readiness</span>
                  <div className="flex items-center">
                    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full mr-2">
                      <div 
                        className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                        style={{ width: `${result.processIntelligence.aiInsights.implementationReadiness * 10}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-bold">{result.processIntelligence.aiInsights.implementationReadiness}/10</span>
                  </div>
                </div>
              </div>
            )}
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