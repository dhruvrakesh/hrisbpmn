import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, DollarSign, MessageSquare, Brain } from 'lucide-react';

interface UsageStats {
  totalTokens: number;
  totalCost: number;
  chatSessions: number;
  analysisRuns: number;
  currentMonthTokens: number;
  currentMonthCost: number;
}

const UsageTracker = () => {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadUsageStats();
  }, []);

  const loadUsageStats = async () => {
    try {
      setLoading(true);

      // Get current month date range
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get all-time usage
      const { data: allTimeUsage, error: allTimeError } = await supabase
        .from('ai_usage_logs')
        .select('total_tokens, cost_usd, operation_type')
        .eq('user_id', user.id);

      if (allTimeError) throw allTimeError;

      // Get current month usage
      const { data: monthlyUsage, error: monthlyError } = await supabase
        .from('ai_usage_logs')
        .select('total_tokens, cost_usd, operation_type')
        .gte('created_at', firstDayOfMonth.toISOString());

      if (monthlyError) throw monthlyError;

      // Get session count
      const { count: sessionCount, error: sessionError } = await supabase
        .from('ai_chat_sessions')
        .select('*', { count: 'exact', head: true });

      if (sessionError) throw sessionError;

      // Calculate stats
      const totalTokens = allTimeUsage?.reduce((sum, log) => sum + log.total_tokens, 0) || 0;
      const totalCost = allTimeUsage?.reduce((sum, log) => sum + log.cost_usd, 0) || 0;
      const chatSessions = sessionCount || 0;
      const analysisRuns = allTimeUsage?.filter(log => log.operation_type === 'analysis').length || 0;
      const currentMonthTokens = monthlyUsage?.reduce((sum, log) => sum + log.total_tokens, 0) || 0;
      const currentMonthCost = monthlyUsage?.reduce((sum, log) => sum + log.cost_usd, 0) || 0;

      setStats({
        totalTokens,
        totalCost,
        chatSessions,
        analysisRuns,
        currentMonthTokens,
        currentMonthCost
      });

    } catch (error) {
      console.error('Error loading usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCost = (cost: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(cost);
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  };

  if (!showDetails) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDetails(true)}
        className="fixed bottom-4 left-4"
      >
        <BarChart3 className="h-4 w-4 mr-2" />
        AI Usage
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 left-4 w-80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            AI Usage Tracking
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(false)}
          >
            ×
          </Button>
        </div>
        <CardDescription>
          Monitor your AI consumption and costs
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading stats...</p>
          </div>
        ) : stats ? (
          <>
            {/* Current Month Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium">This Month</span>
                </div>
                <div className="text-lg font-bold">{formatCost(stats.currentMonthCost)}</div>
                <div className="text-xs text-muted-foreground">
                  {formatTokens(stats.currentMonthTokens)} tokens
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium">All Time</span>
                </div>
                <div className="text-lg font-bold">{formatCost(stats.totalCost)}</div>
                <div className="text-xs text-muted-foreground">
                  {formatTokens(stats.totalTokens)} tokens
                </div>
              </div>
            </div>

            {/* Usage Breakdown */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">Chat Sessions</span>
                </div>
                <Badge variant="secondary">{stats.chatSessions}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">Analysis Runs</span>
                </div>
                <Badge variant="secondary">{stats.analysisRuns}</Badge>
              </div>
            </div>

            {/* Cost Progress (assuming $10 monthly budget) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Monthly Budget</span>
                <span>{formatCost(Math.min(stats.currentMonthCost, 10))} / {formatCost(10)}</span>
              </div>
              <Progress 
                value={Math.min((stats.currentMonthCost / 10) * 100, 100)} 
                className="h-2"
              />
              {stats.currentMonthCost > 10 && (
                <div className="text-xs text-amber-600">
                  ⚠️ Monthly budget exceeded
                </div>
              )}
            </div>

            {/* Efficiency Metrics */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Avg cost per chat: {formatCost(stats.chatSessions > 0 ? stats.totalCost / stats.chatSessions : 0)}</div>
              <div>Avg tokens per session: {formatTokens(stats.chatSessions > 0 ? stats.totalTokens / stats.chatSessions : 0)}</div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadUsageStats}
              className="w-full"
            >
              Refresh Stats
            </Button>
          </>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">No usage data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UsageTracker;