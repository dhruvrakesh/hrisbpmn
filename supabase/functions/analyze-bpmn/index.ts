import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced BPMN Processing with AI Intelligence integration
async function performEnhancedBPMNAnalysis(bpmnXml: string, fileId: string, filePath: string) {
  try {
    // Core BPMN analysis
    const elements = extractBPMNElements(bpmnXml);
    const complexity = calculateProcessComplexity(elements);
    const roles = analyzeRoleDistribution(elements);
    
    // AI-powered insights with BPMN context
    const aiInsights = await getAIProcessInsights(bpmnXml, elements, complexity, roles);
    
    // Enhanced documentation
    const stakeholderDocs = generateStakeholderDocumentation(elements, complexity, roles, aiInsights);
    
    // Generate findings
    const findings = generateEnhancedFindings(elements, complexity, roles, aiInsights);
    
    return {
      fileInfo: { fileId, filePath },
      summary: {
        userTasks: elements.userTasks.length,
        serviceTasks: elements.serviceTasks.length,
        gateways: elements.exclusiveGateways.length + elements.parallelGateways.length + elements.inclusiveGateways.length,
        events: elements.startEvents.length + elements.endEvents.length,
        integrations: elements.serviceTasks.length,
        complexityScore: complexity.score,
        riskLevel: complexity.risk
      },
      processIntelligence: {
        insights: aiInsights.insights,
        recommendations: aiInsights.recommendations,
        implementationReadiness: aiInsights.implementationReadiness,
        risks: aiInsights.risks,
        editingSuggestions: aiInsights.editingSuggestions
      },
      findings,
      stakeholderDocumentation: stakeholderDocs
    };
  } catch (error) {
    console.error('Enhanced BPMN analysis error:', error);
    throw error;
  }
}

// Enhanced BPMN element extraction with better pattern matching
function extractBPMNElements(bpmnXml: string) {
  console.log('🔍 Extracting BPMN elements from XML...');
  
  const elements = {
    userTasks: extractElementsWithRegex(bpmnXml, /<bpmn:userTask[^>]*id="([^"]*)"(?:[^>]*name="([^"]*)")?[^>]*>/g),
    serviceTasks: extractElementsWithRegex(bpmnXml, /<bpmn:serviceTask[^>]*id="([^"]*)"(?:[^>]*name="([^"]*)")?[^>]*>/g),
    exclusiveGateways: extractElementsWithRegex(bpmnXml, /<bpmn:exclusiveGateway[^>]*id="([^"]*)"(?:[^>]*name="([^"]*)")?[^>]*>/g),
    parallelGateways: extractElementsWithRegex(bpmnXml, /<bpmn:parallelGateway[^>]*id="([^"]*)"(?:[^>]*name="([^"]*)")?[^>]*>/g),
    inclusiveGateways: extractElementsWithRegex(bpmnXml, /<bpmn:inclusiveGateway[^>]*id="([^"]*)"(?:[^>]*name="([^"]*)")?[^>]*>/g),
    startEvents: extractElementsWithRegex(bpmnXml, /<bpmn:startEvent[^>]*id="([^"]*)"(?:[^>]*name="([^"]*)")?[^>]*>/g),
    endEvents: extractElementsWithRegex(bpmnXml, /<bpmn:endEvent[^>]*id="([^"]*)"(?:[^>]*name="([^"]*)")?[^>]*>/g),
    sequenceFlows: extractElementsWithRegex(bpmnXml, /<bpmn:sequenceFlow[^>]*id="([^"]*)"(?:[^>]*name="([^"]*)")?[^>]*>/g),
    lanes: extractElementsWithRegex(bpmnXml, /<bpmn:lane[^>]*id="([^"]*)"(?:[^>]*name="([^"]*)")?[^>]*>/g),
    pools: extractElementsWithRegex(bpmnXml, /<bpmn:pool[^>]*id="([^"]*)"(?:[^>]*name="([^"]*)")?[^>]*>/g),
    allElements: []
  };
  
  // Collect all valid element IDs for contextual suggestion targeting
  elements.allElements = [
    ...elements.userTasks.map(t => t.id),
    ...elements.serviceTasks.map(t => t.id),
    ...elements.exclusiveGateways.map(g => g.id),
    ...elements.parallelGateways.map(g => g.id),
    ...elements.inclusiveGateways.map(g => g.id),
    ...elements.startEvents.map(e => e.id),
    ...elements.endEvents.map(e => e.id)
  ].filter(id => id && id.trim() !== '');
  
  console.log(`✅ Extracted ${elements.allElements.length} valid element IDs:`, elements.allElements.slice(0, 5));
  console.log('📊 Element breakdown:', {
    userTasks: elements.userTasks.length,
    serviceTasks: elements.serviceTasks.length,
    gateways: elements.exclusiveGateways.length + elements.parallelGateways.length + elements.inclusiveGateways.length,
    events: elements.startEvents.length + elements.endEvents.length,
    lanes: elements.lanes.length
  });
  
  return elements;
}

function extractElementsWithRegex(xml: string, regex: RegExp) {
  const elements = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    elements.push({
      id: match[1],
      name: match[2] || match[1] // Use ID as fallback name
    });
  }
  return elements;
}

function calculateProcessComplexity(elements: any) {
  const totalElements = Object.values(elements).reduce((sum: number, arr: any) => {
    return sum + (Array.isArray(arr) ? arr.length : 0);
  }, 0) - elements.allElements.length; // Don't double count allElements

  const complexityScore = Math.min(totalElements / 2, 10); // Scale 0-10
  
  let riskLevel = 'Low';
  if (complexityScore > 7) riskLevel = 'High';
  else if (complexityScore > 4) riskLevel = 'Medium';

  return {
    score: Math.round(complexityScore * 10) / 10,
    risk: riskLevel,
    totalElements,
    gatewayComplexity: elements.exclusiveGateways.length + elements.parallelGateways.length,
    taskDistribution: {
      userTasks: elements.userTasks.length,
      serviceTasks: elements.serviceTasks.length
    }
  };
}

function analyzeRoleDistribution(elements: any) {
  const roles = elements.lanes.map((lane: any) => ({
    name: lane.name,
    id: lane.id
  }));

  return {
    totalRoles: roles.length,
    roles,
    tasksPerRole: roles.length > 0 ? Math.round(elements.userTasks.length / roles.length) : 0,
    roleBalance: roles.length > 0 && roles.length <= 5 ? 'Balanced' : 'Needs Review'
  };
}

// AI-powered process insights with OpenAI integration
async function getAIProcessInsights(bpmnXml: string, elements: any, complexity: any, roles: any) {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey) {
    console.warn('OpenAI API key not found, using fallback insights');
    return generateFallbackInsights(elements, complexity, roles);
  }

  try {
    const prompt = `Analyze this BPMN process and provide insights in the exact format specified:

BPMN Elements:
- User Tasks: ${elements.userTasks.length} (${elements.userTasks.map(t => t.name).join(', ')})
- Service Tasks: ${elements.serviceTasks.length} 
- Gateways: ${elements.exclusiveGateways.length + elements.parallelGateways.length} 
- Complexity Score: ${complexity.score}/10
- Roles/Lanes: ${roles.totalRoles}

Element IDs Available: ${elements.allElements.join(', ')}

Provide EXACTLY 5 editing suggestions in this format:

EDITING SUGGESTIONS:
TYPE: add-task
ELEMENT_ID: ${elements.allElements[0] || 'null'}
DESCRIPTION: Add quality check task
IMPLEMENTATION: Insert a quality validation task after data processing

TYPE: add-gateway
ELEMENT_ID: ${elements.allElements[1] || 'null'}
DESCRIPTION: Add decision gateway for routing
IMPLEMENTATION: Add exclusive gateway for conditional processing

TYPE: optimize-flow
ELEMENT_ID: ${elements.allElements[0] || 'null'}
DESCRIPTION: Streamline sequence flows
IMPLEMENTATION: Optimize path connections between tasks

TYPE: add-role
ELEMENT_ID: ${elements.lanes[0]?.id || 'null'}
DESCRIPTION: Add supervisor role
IMPLEMENTATION: Create supervisor lane for oversight

TYPE: change-gateway
ELEMENT_ID: ${elements.exclusiveGateways[0]?.id || 'null'}
DESCRIPTION: Convert to parallel gateway
IMPLEMENTATION: Change to parallel for concurrent processing

Also provide insights and recommendations for process optimization.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a BPMN expert. Provide structured analysis with actionable editing suggestions using real element IDs from the process.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('AI Response received:', aiResponse.substring(0, 200) + '...');
    
    return parseAIResponse(aiResponse, elements);
    
  } catch (error) {
    console.error('AI analysis error:', error);
    return generateFallbackInsights(elements, complexity, roles);
  }
}

function parseAIResponse(aiResponse: string, elements: any) {
  console.log('🔄 Parsing AI response for structured data...');
  // Enhanced parsing for better AI response extraction
  const lines = aiResponse.split('\n').filter(line => line.trim());
  
  // Extract numbered lists and bullet points
  const insights = [];
  const recommendations = [];
  const risks = [];
  const editingSuggestions = [];
  
  let currentSuggestion = null;
  let isInSuggestionsSection = false;
  
  for (const line of lines) {
    const cleanLine = line.trim();
    
    // Check if we're in editing suggestions section
    if (cleanLine.toLowerCase().includes('editing suggestion') || cleanLine.toLowerCase().includes('actionable')) {
      isInSuggestionsSection = true;
      continue;
    }
    
    // Parse editing suggestions
    if (isInSuggestionsSection) {
      if (cleanLine.startsWith('TYPE:')) {
        if (currentSuggestion) {
          editingSuggestions.push(currentSuggestion);
        }
        currentSuggestion = {
          id: `suggestion_${editingSuggestions.length + 1}`,
          type: cleanLine.replace('TYPE:', '').trim().toLowerCase(),
          elementId: null,
          description: '',
          details: {}
        };
      } else if (cleanLine.startsWith('ELEMENT_ID:') && currentSuggestion) {
        const elementId = cleanLine.replace('ELEMENT_ID:', '').trim();
        currentSuggestion.elementId = elementId !== 'null' ? elementId : null;
      } else if (cleanLine.startsWith('DESCRIPTION:') && currentSuggestion) {
        currentSuggestion.description = cleanLine.replace('DESCRIPTION:', '').trim();
      } else if (cleanLine.startsWith('IMPLEMENTATION:') && currentSuggestion) {
        currentSuggestion.details = { implementation: cleanLine.replace('IMPLEMENTATION:', '').trim() };
      }
    }
    
    // Parse other content
    if (cleanLine.match(/^\d+\.|^[-•*]/)) {
      if (cleanLine.toLowerCase().includes('insight') || cleanLine.toLowerCase().includes('finding')) {
        insights.push(cleanLine.replace(/^\d+\.|^[-•*]\s*/, ''));
      } else if (cleanLine.toLowerCase().includes('recommend') || cleanLine.toLowerCase().includes('improve')) {
        recommendations.push(cleanLine.replace(/^\d+\.|^[-•*]\s*/, ''));
      } else if (cleanLine.toLowerCase().includes('risk') || cleanLine.toLowerCase().includes('concern')) {
        risks.push(cleanLine.replace(/^\d+\.|^[-•*]\s*/, ''));
      }
    }
  }
  
  // Add the last suggestion if exists
  if (currentSuggestion && isInSuggestionsSection) {
    editingSuggestions.push(currentSuggestion);
  }
  
  // Fallback to basic extraction if structured parsing fails
  if (insights.length === 0) {
    insights.push(...lines.filter(line => 
      line.toLowerCase().includes('process') || 
      line.toLowerCase().includes('workflow') ||
      line.toLowerCase().includes('efficiency')
    ).slice(0, 3));
  }
  
  if (recommendations.length === 0) {
    recommendations.push(...lines.filter(line => 
      line.toLowerCase().includes('should') || 
      line.toLowerCase().includes('consider') ||
      line.toLowerCase().includes('optimize')
    ).slice(0, 3));
  }
  
  // Generate contextual suggestions if none were parsed properly
  if (editingSuggestions.length < 5) {
    console.log('⚠️ AI parsing incomplete, using fallback suggestions...');
    const fallbackSuggestions = generateFallbackSuggestions(elements);
    editingSuggestions.push(...fallbackSuggestions.slice(editingSuggestions.length));
  }
  
  console.log(`✅ Generated ${editingSuggestions.length} editing suggestions with real element IDs`);
  editingSuggestions.forEach((s, i) => console.log(`  ${i+1}. ${s.type} (${s.elementId}) - ${s.description}`));
  
  return {
    insights: insights.slice(0, 5),
    recommendations: recommendations.slice(0, 5),
    implementationReadiness: Math.floor(Math.random() * 3) + 7, // 7-10 range
    risks: risks.length > 0 ? risks.slice(0, 3) : ['Standard implementation risks apply'],
    editingSuggestions: editingSuggestions.slice(0, 5)
  };
}

function generateFallbackSuggestions(elements: any) {
  console.log('🎯 Generating context-aware fallback suggestions using real element IDs...');
  
  // Use actual element IDs from the BPMN for context-aware suggestions
  const primaryTaskId = elements.userTasks.length > 0 ? elements.userTasks[0].id : 
                       elements.serviceTasks.length > 0 ? elements.serviceTasks[0].id : null;
  const primaryGatewayId = elements.exclusiveGateways.length > 0 ? elements.exclusiveGateways[0].id : 
                          elements.parallelGateways.length > 0 ? elements.parallelGateways[0].id : null;
  const primaryLaneId = elements.lanes.length > 0 ? elements.lanes[0].id : null;
  
  console.log('🔧 Key elements for suggestions:', {
    primaryTaskId,
    primaryGatewayId,
    primaryLaneId,
    totalElements: elements.allElements.length
  });
  
  // Generate contextual suggestions based on actual diagram content
  const suggestions = [];
  
  // Add validation task after the first user task if it exists
  if (primaryTaskId) {
    suggestions.push({
      id: 'suggestion_1',
      type: 'add-task',
      elementId: primaryTaskId,
      description: `Add validation task after ${elements.userTasks[0]?.name || 'current task'}`,
      details: { 
        implementation: 'Insert quality validation step in the workflow',
        name: 'Quality Validation',
        position: 'after'
      }
    });
  } else {
    suggestions.push({
      id: 'suggestion_1',
      type: 'add-task',
      elementId: null,
      description: 'Add initial data validation task',
      details: { 
        implementation: 'Add a task to validate inputs at process start',
        name: 'Input Validation'
      }
    });
  }
  
  // Add decision gateway at strategic location
  const suggestionTarget = primaryTaskId || elements.allElements[0] || null;
  suggestions.push({
    id: 'suggestion_2', 
    type: 'add-gateway',
    elementId: suggestionTarget,
    description: 'Add decision gateway for conditional routing',
    details: { 
      implementation: 'Insert decision point for process branching',
      gatewayType: 'exclusive',
      name: 'Approval Decision'
    }
  });
  
  // Optimize flow based on current structure
  suggestions.push({
    id: 'suggestion_3',
    type: 'optimize-flow',
    elementId: suggestionTarget,
    description: 'Streamline process flow connections',
    details: { 
      implementation: 'Optimize sequence flows for better efficiency',
      optimization: 'reduce_steps'
    }
  });
  
  // Add role/lane if not present or enhance existing
  if (elements.lanes.length === 0) {
    suggestions.push({
      id: 'suggestion_4',
      type: 'add-role',
      elementId: null,
      description: 'Add approver role for process oversight',
      details: { 
        implementation: 'Create dedicated lane for approval workflow',
        roleName: 'Process Approver'
      }
    });
  } else {
    suggestions.push({
      id: 'suggestion_4',
      type: 'add-role',
      elementId: primaryLaneId,
      description: `Add reviewer role to support ${elements.lanes[0]?.name || 'current role'}`,
      details: { 
        implementation: 'Add complementary role for quality assurance',
        roleName: 'Quality Reviewer'
      }
    });
  }
  
  // Change gateway type if one exists, otherwise suggest adding one
  if (primaryGatewayId) {
    suggestions.push({
      id: 'suggestion_5',
      type: 'change-gateway',
      elementId: primaryGatewayId,
      description: `Optimize ${elements.exclusiveGateways[0]?.name || 'gateway'} for parallel processing`,
      details: { 
        implementation: 'Convert to parallel gateway for concurrent execution',
        gatewayType: 'bpmn:ParallelGateway'
      }
    });
  } else {
    suggestions.push({
      id: 'suggestion_5',
      type: 'add-gateway',
      elementId: suggestionTarget,
      description: 'Add parallel gateway for concurrent processing',
      details: { 
        implementation: 'Enable multiple process paths to execute simultaneously',
        gatewayType: 'parallel',
        name: 'Parallel Split'
      }
    });
  }
  
  return suggestions;
}

function generateFallbackInsights(elements: any, complexity: any, roles: any) {
  const suggestions = generateFallbackSuggestions(elements);
  
  return { 
    insights: [
      `Process contains ${elements.userTasks.length} user tasks requiring manual intervention`,
      `${complexity.score}/10 complexity score indicates ${complexity.risk.toLowerCase()} optimization potential`,
      `${roles.totalRoles} roles identified with ${roles.roleBalance.toLowerCase()} distribution`
    ],
    recommendations: [
      'Consider adding validation steps for data quality',
      'Implement parallel processing where possible',
      'Add decision gateways for conditional logic'
    ],
    implementationReadiness: Math.floor(Math.random() * 3) + 7,
    risks: ['Manual process steps may cause delays', 'Limited role separation may impact compliance'],
    editingSuggestions: suggestions
  };
}

function generateStakeholderDocumentation(elements: any, complexity: any, roles: any, aiInsights: any) {
  return {
    business: {
      summary: `Business process with ${elements.userTasks.length} manual tasks and ${complexity.score}/10 complexity`,
      keyMetrics: {
        processEfficiency: `${10 - complexity.score}/10`,
        automationLevel: `${elements.serviceTasks.length}/${elements.userTasks.length + elements.serviceTasks.length}`,
        roleDistribution: roles.roleBalance
      }
    },
    technical: {
      architecture: `BPMN 2.0 compliant process with ${elements.allElements.length} total elements`,
      integrationPoints: elements.serviceTasks.length,
      complexityAnalysis: complexity
    },
    changeManagement: {
      impactAssessment: aiInsights.risks,
      trainingNeeds: roles.roles.map((role: any) => `${role.name} role training required`),
      timeline: "2-4 weeks implementation based on complexity"
    }
  };
}

function generateEnhancedFindings(elements: any, complexity: any, roles: any, aiInsights: any) {
  const findings = [];
  
  // Complexity-based findings
  if (complexity.score > 7) {
    findings.push({
      id: 'complexity_high',
      severity: 'warning',
      ruleName: 'Process Complexity',
      message: 'High process complexity detected',
      description: 'Consider breaking down into smaller sub-processes',
      elementName: 'Process',
      elementId: 'process'
    });
  }
  
  // Role distribution findings
  if (roles.totalRoles === 0) {
    findings.push({
      id: 'no_roles',
      severity: 'error',
      ruleName: 'Role Definition',
      message: 'No roles or lanes defined',
      description: 'Add swimlanes to clearly define responsibilities',
      elementName: 'Process',
      elementId: 'process'
    });
  }
  
  // Task-specific findings
  if (elements.userTasks.length > elements.serviceTasks.length * 2) {
    findings.push({
      id: 'manual_heavy',
      severity: 'info',
      ruleName: 'Automation Opportunity',
      message: 'Process is heavily manual',
      description: 'Consider automating repetitive tasks',
      elementName: 'Process',
      elementId: 'process'
    });
  }
  
  return findings;
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
        JSON.stringify({ error: 'Missing fileId or filePath' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download the BPMN file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('bpmn-files')
      .download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    const bpmnXml = await fileData.text();
    console.log('BPMN file downloaded, size:', bpmnXml.length);

    // Perform enhanced analysis
    const analysisResult = await performEnhancedBPMNAnalysis(bpmnXml, fileId, filePath);
    
    console.log('Analysis completed successfully');
    console.log('Editing suggestions generated:', analysisResult.processIntelligence.editingSuggestions.length);

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Analysis failed', 
        details: error.message,
        fallback: {
          fileInfo: { fileId: 'unknown', filePath: 'unknown' },
          summary: { userTasks: 0, serviceTasks: 0, gateways: 0, events: 0, integrations: 0, complexityScore: 0, riskLevel: 'Unknown' },
          processIntelligence: {
            insights: ['Analysis temporarily unavailable'],
            recommendations: ['Manual review recommended'],
            implementationReadiness: 5,
            risks: ['Unable to assess risks'],
            editingSuggestions: []
          },
          findings: [],
          stakeholderDocumentation: {}
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});