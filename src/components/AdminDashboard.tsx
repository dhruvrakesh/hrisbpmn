import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  FileText, 
  Users, 
  Activity, 
  Download, 
  Eye, 
  Trash2,
  GitBranch,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AdminStats {
  totalFiles: number;
  totalVersions: number;
  totalUsers: number;
  todayUploads: number;
  aiSuggestionsApplied: number;
}

interface FileWithVersions {
  id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  file_size: number;
  user_id: string;
  version_count: number;
  latest_version: number;
  has_ai_changes: boolean;
}

interface RecentActivity {
  id: string;
  action_type: string;
  file_name: string;
  user_id: string;
  created_at: string;
  details: any;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<AdminStats>({
    totalFiles: 0,
    totalVersions: 0,
    totalUsers: 0,
    todayUploads: 0,
    aiSuggestionsApplied: 0
  });
  const [files, setFiles] = useState<FileWithVersions[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      
      // Load statistics
      const [filesResult, versionsResult, usersResult] = await Promise.all([
        supabase.from('bpmn_files').select('id, uploaded_at'),
        supabase.from('bpmn_versions').select('id, ai_suggestions_applied'),
        supabase.from('ai_usage_logs').select('user_id').eq('operation_type', 'chat')
      ]);

      const today = new Date().toISOString().split('T')[0];
      const todayUploads = filesResult.data?.filter(f => 
        f.uploaded_at.startsWith(today)
      ).length || 0;

      const aiSuggestionsApplied = versionsResult.data?.filter(v => 
        v.ai_suggestions_applied && 
        Array.isArray(v.ai_suggestions_applied) && 
        v.ai_suggestions_applied.length > 0
      ).length || 0;

      const uniqueUsers = new Set(usersResult.data?.map(u => u.user_id)).size;

      setStats({
        totalFiles: filesResult.data?.length || 0,
        totalVersions: versionsResult.data?.length || 0,
        totalUsers: uniqueUsers,
        todayUploads,
        aiSuggestionsApplied
      });

      // Load files with version information
      const { data: basicFiles } = await supabase
        .from('bpmn_files')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(20);
      
      setFiles(basicFiles?.map(f => ({
        ...f,
        version_count: 1,
        latest_version: 1,
        has_ai_changes: false
      })) || []);

      // Load recent activity
      const { data: activityData } = await supabase
        .from('bpmn_audit_trail')
        .select(`
          id,
          action_type,
          action_details,
          user_id,
          created_at,
          bpmn_file_id
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      const activityWithFileNames = await Promise.all(
        (activityData || []).map(async (activity) => {
          const { data: file } = await supabase
            .from('bpmn_files')
            .select('file_name')
            .eq('id', activity.bpmn_file_id)
            .single();
          
          return {
            ...activity,
            file_name: file?.file_name || 'Unknown File',
            details: activity.action_details
          };
        })
      );

      setRecentActivity(activityWithFileNames);

    } catch (error: any) {
      console.error('Error loading admin data:', error);
      toast({
        title: "Error",
        description: "Failed to load admin dashboard data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadAllAuditTrails = async () => {
    try {
      const { data: allAuditData } = await supabase
        .from('bpmn_audit_trail')
        .select('*')
        .order('created_at', { ascending: false });

      const auditReport = {
        exportedBy: 'admin',
        exportedAt: new Date().toISOString(),
        totalEntries: allAuditData?.length || 0,
        auditTrail: allAuditData || []
      };

      const blob = new Blob([JSON.stringify(auditReport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `complete_audit_trail_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: "Complete audit trail has been downloaded.",
      });
    } catch (error: any) {
      console.error('Error exporting audit trails:', error);
      toast({
        title: "Export Error",
        description: "Failed to export audit trails.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'upload': return <FileText className="h-4 w-4" />;
      case 'ai_suggestion_applied': return <GitBranch className="h-4 w-4" />;
      case 'download': return <Download className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Admin Dashboard</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading admin data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Admin Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-primary" />
              <span>Admin Dashboard</span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                Administrator Access
              </Badge>
            </CardTitle>
            <CardDescription>
              Complete overview and management of BPMN system
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalFiles}</p>
                  <p className="text-xs text-muted-foreground">Total Files</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <GitBranch className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalVersions}</p>
                  <p className="text-xs text-muted-foreground">Total Versions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Active Users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.todayUploads}</p>
                  <p className="text-xs text-muted-foreground">Today's Uploads</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-cyan-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.aiSuggestionsApplied}</p>
                  <p className="text-xs text-muted-foreground">AI Changes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Views */}
        <Tabs defaultValue="files" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="files">All Files & Versions</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>
          
          <TabsContent value="files" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>All BPMN Files</CardTitle>
                  <Button onClick={downloadAllAuditTrails} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export All Audit Trails
                  </Button>
                </div>
                <CardDescription>Complete overview of all uploaded files and their versions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Upload Date</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Versions</TableHead>
                      <TableHead>AI Changes</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">{file.file_name}</TableCell>
                        <TableCell>{formatDate(file.uploaded_at)}</TableCell>
                        <TableCell>{formatFileSize(file.file_size || 0)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {file.version_count || 1} versions
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {file.has_ai_changes ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              <GitBranch className="h-3 w-3 mr-1" />
                              Yes
                            </Badge>
                          ) : (
                            <Badge variant="outline">No</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {file.user_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Details</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Download className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest user actions and system events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center space-x-3 p-3 border rounded-md">
                      <div className="flex-shrink-0">
                        {getActionIcon(activity.action_type)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {activity.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          File: {activity.file_name}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(activity.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
};

export default AdminDashboard;