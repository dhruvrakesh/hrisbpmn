import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId, filePath } = await req.json();

    if (!fileId || !filePath) {
      return new Response(
        JSON.stringify({ error: 'File ID and path are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Starting analysis for file: ${fileId}`);

    // Download the BPMN file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('bpmn-files')
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert blob to text
    const bpmnXml = await fileData.text();
    console.log('BPMN XML length:', bpmnXml.length);

    // Phase 0: Hard-coded rule - Count User Tasks
    const userTaskMatches = bpmnXml.match(/<bpmn:userTask/g) || [];
    const userTaskCount = userTaskMatches.length;

    // Extract task names for more detailed analysis
    const taskRegex = /<bpmn:userTask[^>]*id="([^"]*)"[^>]*name="([^"]*)"/g;
    const tasks = [];
    let match;
    
    while ((match = taskRegex.exec(bpmnXml)) !== null) {
      tasks.push({
        id: match[1],
        name: match[2] || 'Unnamed Task'
      });
    }

    // Simple analysis result
    const analysisResult = {
      fileId,
      fileName: filePath.split('/').pop(),
      analyzedAt: new Date().toISOString(),
      summary: {
        totalUserTasks: userTaskCount,
        tasksFound: tasks
      },
      findings: [
        {
          id: 'user-task-count',
          ruleId: 'hard-coded-user-task-count',
          ruleName: 'User Task Counter',
          severity: 'Info',
          message: `Found ${userTaskCount} User Task(s) in the process`,
          elementId: null,
          elementName: null,
          description: 'This is a basic analysis counting the number of user tasks in your BPMN process.'
        }
      ]
    };

    // Add individual task findings
    tasks.forEach((task, index) => {
      analysisResult.findings.push({
        id: `user-task-${index + 1}`,
        ruleId: 'hard-coded-task-identification',
        ruleName: 'Task Identification',
        severity: 'Info',
        message: `User Task identified: "${task.name}"`,
        elementId: task.id,
        elementName: task.name,
        description: 'Individual user task found in the process.'
      });
    });

    console.log('Analysis completed:', analysisResult);

    return new Response(
      JSON.stringify(analysisResult),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Analysis error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Analysis failed', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});