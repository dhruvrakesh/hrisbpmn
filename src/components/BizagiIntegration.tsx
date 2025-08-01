import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Settings, Play, Eye, AlertCircle, CheckCircle, Clock, ExternalLink } from 'lucide-react';

interface BizagiIntegrationProps {
  getBpmnXml: () => Promise<string>;
  fileName: string;
}

interface DeploymentResult {
  deploymentId: string;
  processId: string;
  status: string;
  message: string;
}

const BizagiIntegration = ({ getBpmnXml, fileName }: BizagiIntegrationProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);
  const [formData, setFormData] = useState({
    processName: fileName.replace('.bpmn', ''),
    description: '',
    autoStart: false,
    enableNotifications: true,
    requireApproval: false
  });
  const { toast } = useToast();

  const handleDeploy = async () => {
    try {
      setDeploying(true);
      
      const bpmnXml = await getBpmnXml();
      
      const { data, error } = await supabase.functions.invoke('bizagi-integration', {
        body: {
          action: 'deploy-process',
          bpmnXml,
          processName: formData.processName,
          description: formData.description,
          deploymentOptions: {
            autoStart: formData.autoStart,
            enableNotifications: formData.enableNotifications,
            requireApproval: formData.requireApproval
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        setDeploymentResult(data);
        toast({
          title: "Deployment Successful",
          description: "Process has been deployed to Bizagi Studio successfully.",
        });
      } else {
        throw new Error(data.error || 'Deployment failed');
      }

    } catch (error: any) {
      console.error('Deployment error:', error);
      toast({
        title: "Deployment Failed",
        description: error.message || "Failed to deploy process to Bizagi Studio.",
        variant: "destructive",
      });
    } finally {
      setDeploying(false);
    }
  };

  const handleReset = () => {
    setDeploymentResult(null);
    setFormData({
      processName: fileName.replace('.bpmn', ''),
      description: '',
      autoStart: false,
      enableNotifications: true,
      requireApproval: false
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'deployed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'deploying':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deployed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'deploying':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Export to Bizagi
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Deploy to Bizagi Studio
          </DialogTitle>
          <DialogDescription>
            Deploy your BPMN process to Bizagi Studio for workflow automation
          </DialogDescription>
        </DialogHeader>

        {deploymentResult ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getStatusIcon(deploymentResult.status)}
                Deployment Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Label>Status:</Label>
                <Badge className={getStatusColor(deploymentResult.status)}>
                  {deploymentResult.status.toUpperCase()}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <Label>Deployment ID:</Label>
                <code className="block p-2 bg-muted rounded text-sm">
                  {deploymentResult.deploymentId}
                </code>
              </div>
              
              <div className="space-y-2">
                <Label>Process ID:</Label>
                <code className="block p-2 bg-muted rounded text-sm">
                  {deploymentResult.processId}
                </code>
              </div>
              
              <div className="space-y-2">
                <Label>Message:</Label>
                <p className="text-sm text-muted-foreground">
                  {deploymentResult.message}
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={handleReset}>
                  Deploy Another
                </Button>
                <Button asChild>
                  <a 
                    href={`https://your-bizagi-server.com/studio/process/${deploymentResult.processId}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in Bizagi
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="processName">Process Name</Label>
                <Input
                  id="processName"
                  value={formData.processName}
                  onChange={(e) => setFormData({ ...formData, processName: e.target.value })}
                  placeholder="Enter process name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this process does..."
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Deployment Options
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autoStart">Auto-start Process</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically start the process after deployment
                    </p>
                  </div>
                  <Switch
                    id="autoStart"
                    checked={formData.autoStart}
                    onCheckedChange={(checked) => setFormData({ ...formData, autoStart: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="enableNotifications">Enable Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Send email notifications for task assignments
                    </p>
                  </div>
                  <Switch
                    id="enableNotifications"
                    checked={formData.enableNotifications}
                    onCheckedChange={(checked) => setFormData({ ...formData, enableNotifications: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="requireApproval">Require Approval</Label>
                    <p className="text-sm text-muted-foreground">
                      Require manager approval before starting instances
                    </p>
                  </div>
                  <Switch
                    id="requireApproval"
                    checked={formData.requireApproval}
                    onCheckedChange={(checked) => setFormData({ ...formData, requireApproval: checked })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!deploymentResult && (
            <>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleDeploy} 
                disabled={deploying || !formData.processName.trim()}
                className="flex items-center gap-2"
              >
                {deploying ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deploying...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Deploy to Bizagi
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BizagiIntegration;