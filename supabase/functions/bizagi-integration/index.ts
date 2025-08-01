import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BizagiDeploymentRequest {
  bpmnXml: string;
  processName: string;
  description?: string;
  deploymentOptions?: {
    autoStart?: boolean;
    enableNotifications?: boolean;
    requireApproval?: boolean;
  };
}

interface BizagiCredentials {
  serverUrl: string;
  apiKey: string;
  projectId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { action, ...requestData } = await req.json();

    switch (action) {
      case 'deploy-process':
        return await deployProcess(requestData as BizagiDeploymentRequest);
      
      case 'get-process-status':
        return await getProcessStatus(requestData.processId);
      
      case 'list-deployments':
        return await listDeployments();
      
      case 'validate-credentials':
        return await validateCredentials(requestData as BizagiCredentials);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Bizagi integration error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.stack 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function deployProcess(request: BizagiDeploymentRequest) {
  const credentials = await getBizagiCredentials();
  
  try {
    // Convert BPMN XML to Bizagi format if needed
    const bizagiXml = await convertBpmnToBizagi(request.bpmnXml);
    
    // Deploy to Bizagi Studio
    const deploymentResponse = await fetch(`${credentials.serverUrl}/api/v1/processes/deploy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'Content-Type': 'application/json',
        'X-Project-Id': credentials.projectId,
      },
      body: JSON.stringify({
        processName: request.processName,
        description: request.description,
        bpmnDefinition: bizagiXml,
        deploymentOptions: {
          autoStart: request.deploymentOptions?.autoStart ?? false,
          enableNotifications: request.deploymentOptions?.enableNotifications ?? true,
          requireApproval: request.deploymentOptions?.requireApproval ?? false,
        }
      })
    });

    if (!deploymentResponse.ok) {
      const errorData = await deploymentResponse.text();
      throw new Error(`Bizagi deployment failed: ${deploymentResponse.status} - ${errorData}`);
    }

    const deploymentResult = await deploymentResponse.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        deploymentId: deploymentResult.deploymentId,
        processId: deploymentResult.processId,
        status: deploymentResult.status,
        message: 'Process deployed successfully to Bizagi Studio'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Deployment error:', error);
    throw new Error(`Failed to deploy to Bizagi: ${error.message}`);
  }
}

async function getProcessStatus(processId: string) {
  const credentials = await getBizagiCredentials();
  
  try {
    const statusResponse = await fetch(`${credentials.serverUrl}/api/v1/processes/${processId}/status`, {
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'X-Project-Id': credentials.projectId,
      }
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to get process status: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        processId,
        status: statusData.status,
        instanceCount: statusData.instanceCount,
        lastActivity: statusData.lastActivity,
        metrics: statusData.metrics
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Status check error:', error);
    throw new Error(`Failed to get process status: ${error.message}`);
  }
}

async function listDeployments() {
  const credentials = await getBizagiCredentials();
  
  try {
    const deploymentsResponse = await fetch(`${credentials.serverUrl}/api/v1/deployments`, {
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'X-Project-Id': credentials.projectId,
      }
    });

    if (!deploymentsResponse.ok) {
      throw new Error(`Failed to list deployments: ${deploymentsResponse.status}`);
    }

    const deployments = await deploymentsResponse.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        deployments: deployments.map((deployment: any) => ({
          id: deployment.id,
          processName: deployment.processName,
          status: deployment.status,
          deployedAt: deployment.deployedAt,
          version: deployment.version,
          instanceCount: deployment.instanceCount
        }))
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('List deployments error:', error);
    throw new Error(`Failed to list deployments: ${error.message}`);
  }
}

async function validateCredentials(credentials: BizagiCredentials) {
  try {
    const testResponse = await fetch(`${credentials.serverUrl}/api/v1/projects/${credentials.projectId}/info`, {
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
      }
    });

    const isValid = testResponse.ok;
    
    return new Response(
      JSON.stringify({
        success: true,
        valid: isValid,
        message: isValid ? 'Credentials are valid' : 'Invalid credentials or server unreachable'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: true,
        valid: false,
        message: `Connection failed: ${error.message}`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function getBizagiCredentials(): Promise<BizagiCredentials> {
  // Get credentials from Supabase secrets
  const serverUrl = Deno.env.get('BIZAGI_SERVER_URL');
  const apiKey = Deno.env.get('BIZAGI_API_KEY');
  const projectId = Deno.env.get('BIZAGI_PROJECT_ID');

  if (!serverUrl || !apiKey || !projectId) {
    throw new Error('Bizagi credentials not configured. Please set BIZAGI_SERVER_URL, BIZAGI_API_KEY, and BIZAGI_PROJECT_ID in Supabase secrets.');
  }

  return {
    serverUrl,
    apiKey,
    projectId
  };
}

async function convertBpmnToBizagi(bpmnXml: string): Promise<string> {
  // In a real implementation, this would convert BPMN XML to Bizagi-specific format
  // For now, we'll return the BPMN XML as-is, assuming Bizagi can import standard BPMN
  
  // Basic validation
  if (!bpmnXml.includes('<definitions') || !bpmnXml.includes('bpmn')) {
    throw new Error('Invalid BPMN XML format');
  }

  // TODO: Implement actual BPMN to Bizagi conversion logic
  // This might involve:
  // - Converting BPMN namespace to Bizagi namespace
  // - Adding Bizagi-specific annotations
  // - Converting data objects to Bizagi forms
  // - Setting up Bizagi-specific properties
  
  return bpmnXml;
}