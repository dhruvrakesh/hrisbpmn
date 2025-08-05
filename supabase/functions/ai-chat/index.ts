import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  sessionId?: string;
  message: string;
  bpmnFileId?: string;
  bpmnContext?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 AI Chat request received:', req.method);

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY is not configured');
      throw new Error('OPENAI_API_KEY is not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Supabase configuration missing');
      throw new Error('Supabase configuration missing');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const requestBody = await req.json();
    console.log('📥 Request body received:', {
      hasSessionId: !!requestBody.sessionId,
      messageLength: requestBody.message?.length || 0,
      hasBpmnFileId: !!requestBody.bpmnFileId,
      hasBpmnContext: !!requestBody.bpmnContext
    });

    const { sessionId, message, bpmnFileId, bpmnContext }: ChatRequest = requestBody;

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    console.log('Chat request for user:', user.id, 'session:', sessionId);

    let currentSessionId = sessionId;

    // Create or get session
    if (!currentSessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from('ai_chat_sessions')
        .insert({
          user_id: user.id,
          bpmn_file_id: bpmnFileId,
          session_context: bpmnContext || {}
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error creating session:', sessionError);
        throw new Error('Failed to create chat session');
      }

      currentSessionId = newSession.id;
      console.log('Created new session:', currentSessionId);
    }

    // Get conversation history
    const { data: messages, error: messagesError } = await supabase
      .from('ai_chat_messages')
      .select('role, content')
      .eq('session_id', currentSessionId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error getting messages:', messagesError);
      throw new Error('Failed to get conversation history');
    }

    // Get BPMN context if available
    let bpmnAnalysisContext = '';
    if (bpmnFileId) {
      // Get BPMN file info and any previous analysis
      const { data: bpmnFile, error: fileError } = await supabase
        .from('bpmn_files')
        .select('file_name, file_path')
        .eq('id', bpmnFileId)
        .single();

      if (!fileError && bpmnFile) {
        bpmnAnalysisContext = `\n\nCurrent BPMN Context:
- File: ${bpmnFile.file_name}
- This is an HRIS (Human Resources Information System) process analysis
- Focus on HR best practices, compliance, and process optimization
- Consider aspects like employee onboarding, performance management, payroll, benefits, etc.`;
      }
    }

    // Get relevant knowledge from knowledge base
    const { data: knowledgeBase, error: kbError } = await supabase
      .from('process_knowledge_base')
      .select('knowledge_type, extracted_insights, confidence_score')
      .gte('confidence_score', 0.7)
      .order('effectiveness_score', { ascending: false })
      .limit(5);

    let knowledgeContext = '';
    if (!kbError && knowledgeBase && knowledgeBase.length > 0) {
      knowledgeContext = '\n\nRelevant Knowledge Base Insights:\n' + 
        knowledgeBase.map(kb => 
          `- ${kb.knowledge_type}: ${JSON.stringify(kb.extracted_insights)}`
        ).join('\n');
    }

    // Save user message
    await supabase
      .from('ai_chat_messages')
      .insert({
        session_id: currentSessionId,
        role: 'user',
        content: message,
        token_count: Math.ceil(message.length / 4) // Rough token estimate
      });

    // Enhanced BPMN context if available
    if (bpmnContext && bpmnContext.analysisResult) {
      const analysisInfo = bpmnContext.analysisResult;
      bpmnAnalysisContext += `\n\nCurrent Analysis Results:
- Process Summary: ${analysisInfo.summary || 'Not available'}
- Process Intelligence: ${JSON.stringify(analysisInfo.processIntelligence || {})}
- Findings Count: ${analysisInfo.findingsCount || 0}

Please reference this specific analysis data in your responses and provide actionable insights based on these findings.`;
    }

    // Prepare conversation for OpenAI with ENFORCED HRIS context
    const conversationMessages: ChatMessage[] = [
      {
        role: 'system',
        content: `🎯 **MANDATORY ROLE**: You are EXCLUSIVELY an HRIS (Human Resources Information System) expert analyzing BPMN processes. You CANNOT discuss stocks, markets, finance, or any non-HR topics.

🚫 **STRICT BOUNDARIES**: 
- ONLY discuss HR processes, employee management, payroll, benefits, recruitment, performance management
- REJECT any questions about stocks, financial markets, investments, or general business
- ALWAYS respond within HRIS/HR context even if asked about other topics

🔍 **REQUIRED EXPERTISE AREAS:**
1. **Employee Lifecycle Management**: Onboarding, offboarding, transfers, promotions
2. **BPMN Process Analysis**: Workflow optimization for HR processes specifically
3. **SAP SuccessFactors & HR Systems**: Integration, configuration, best practices
4. **HR Compliance**: GDPR, labor laws, equal opportunity, audit trails
5. **Performance & Compensation**: Appraisals, salary reviews, bonus calculations
6. **Learning & Development**: Training workflows, certification tracking
7. **Time & Attendance**: Leave management, overtime calculations, shift planning

🎯 **MANDATORY RESPONSE FORMAT**:
**🔍 Process Analysis**: [Analyze the specific HR process]
**⚡ Optimization Opportunities**: [Identify specific bottlenecks or improvements]
**⚠️ Compliance Considerations**: [HR compliance and risk factors]
**🚀 Implementation Steps**: [Practical next steps for HR teams]
**💼 Business Impact**: [ROI and efficiency gains for HR operations]

🆘 **CONTEXT VALIDATION**: If someone asks about non-HR topics, respond: "I'm specifically designed to help with HRIS and HR process optimization. Let me help you with your HR workflow instead!"

${bpmnAnalysisContext}${knowledgeContext}

**CRITICAL**: Every response MUST be about HR processes, employee management, or HRIS systems. Do NOT discuss financial markets, stocks, or general business topics.`
      },
      ...messages.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    console.log('🤖 Prepared OpenAI request:', {
      messageCount: conversationMessages.length,
      systemPromptLength: conversationMessages[0].content.length,
      hasBpmnContext: !!bpmnAnalysisContext,
      hasKnowledgeContext: !!knowledgeContext
    });

    // Call OpenAI API
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: conversationMessages,
        max_tokens: 1500,
        temperature: 0.7,
        stream: false
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const aiResponse = await openAIResponse.json();
    console.log('✅ OpenAI response received:', {
      hasChoices: !!aiResponse.choices,
      choicesLength: aiResponse.choices?.length || 0,
      usage: aiResponse.usage
    });

    if (!aiResponse.choices || !aiResponse.choices[0] || !aiResponse.choices[0].message) {
      console.error('❌ Invalid OpenAI response structure:', aiResponse);
      throw new Error('Invalid response structure from OpenAI');
    }

    const assistantMessage = aiResponse.choices[0].message.content;
    const usage = aiResponse.usage;

    console.log('📝 Assistant message preview:', assistantMessage?.substring(0, 200) + '...');
    
    // VALIDATE AI RESPONSE IS HR-FOCUSED
    const isHRFocused = assistantMessage && (
      assistantMessage.toLowerCase().includes('hr') ||
      assistantMessage.toLowerCase().includes('employee') ||
      assistantMessage.toLowerCase().includes('recruitment') ||
      assistantMessage.toLowerCase().includes('payroll') ||
      assistantMessage.toLowerCase().includes('performance') ||
      assistantMessage.toLowerCase().includes('compliance') ||
      assistantMessage.toLowerCase().includes('onboarding') ||
      assistantMessage.toLowerCase().includes('workflow') ||
      assistantMessage.toLowerCase().includes('process')
    );

    const containsGenericBusiness = assistantMessage && (
      assistantMessage.toLowerCase().includes('stock') ||
      assistantMessage.toLowerCase().includes('market') ||
      assistantMessage.toLowerCase().includes('investment') ||
      assistantMessage.toLowerCase().includes('financial analysis')
    );

    if (!isHRFocused || containsGenericBusiness) {
      console.warn('⚠️ AI response not HR-focused, forcing correction');
      const correctedMessage = `🎯 **HRIS Process Analysis**

I notice you're asking about process optimization. As your HRIS expert, let me focus on the HR aspects:

**🔍 Process Analysis**: Based on your BPMN process analysis, I can help optimize employee workflows, approval chains, and compliance procedures.

**⚡ Key HRIS Optimization Areas**:
- Employee onboarding automation
- Performance review workflows  
- Leave approval processes
- Payroll verification steps
- Compliance audit trails

**🚀 Next Steps**: 
1. Review your current HR process flows
2. Identify manual approval bottlenecks
3. Implement automated notifications
4. Ensure GDPR compliance throughout

Would you like me to analyze any specific HR process workflow or help optimize employee management procedures?`;
      
      // Use corrected message instead
      assistantMessage = correctedMessage;
    }

    // Save assistant message
    await supabase
      .from('ai_chat_messages')
      .insert({
        session_id: currentSessionId,
        role: 'assistant',
        content: assistantMessage,
        token_count: usage.completion_tokens,
        metadata: { model: 'gpt-4o-mini', usage }
      });

    // Log usage for cost tracking
    await supabase
      .from('ai_usage_logs')
      .insert({
        user_id: user.id,
        operation_type: 'chat',
        model_used: 'gpt-4o-mini',
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        cost_usd: (usage.total_tokens * 0.000001), // Rough cost estimate
        session_id: currentSessionId,
        bpmn_file_id: bpmnFileId,
        metadata: { conversation_length: conversationMessages.length }
      });

    // Extract insights for knowledge base (async)
    extractKnowledgeForLearning(supabase, currentSessionId, bpmnFileId, assistantMessage, bpmnContext);

    const responseData = {
      sessionId: currentSessionId,
      response: assistantMessage,
      usage: usage
    };

    console.log('🎉 Sending successful response:', {
      sessionId: currentSessionId,
      responseLength: assistantMessage?.length || 0,
      tokens: usage?.total_tokens || 0
    });

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Async function to extract knowledge for future learning
async function extractKnowledgeForLearning(
  supabase: any, 
  sessionId: string, 
  bpmnFileId: string | undefined, 
  assistantMessage: string, 
  bpmnContext: any
) {
  try {
    // Simple pattern extraction for now
    const patterns = [];
    
    if (assistantMessage.includes('optimization') || assistantMessage.includes('improve')) {
      patterns.push({
        knowledge_type: 'optimization',
        extracted_insights: {
          suggestion: assistantMessage.substring(0, 200),
          context: bpmnContext,
          patterns_identified: ['process_optimization']
        },
        confidence_score: 0.8
      });
    }

    if (assistantMessage.includes('risk') || assistantMessage.includes('compliance')) {
      patterns.push({
        knowledge_type: 'risk_assessment',
        extracted_insights: {
          risk_factors: assistantMessage.substring(0, 200),
          mitigation_suggestions: 'See full conversation',
          context: bpmnContext
        },
        confidence_score: 0.75
      });
    }

    if (assistantMessage.includes('best practice') || assistantMessage.includes('recommend')) {
      patterns.push({
        knowledge_type: 'best_practice',
        extracted_insights: {
          practice_description: assistantMessage.substring(0, 200),
          applicability: bpmnContext ? 'BPMN_specific' : 'general',
          context: bpmnContext
        },
        confidence_score: 0.85
      });
    }

    // Store patterns in knowledge base
    for (const pattern of patterns) {
      await supabase
        .from('process_knowledge_base')
        .insert({
          ...pattern,
          bpmn_context: bpmnContext || {},
          source_session_id: sessionId
        });
    }

    console.log('Extracted', patterns.length, 'knowledge patterns');

  } catch (error) {
    console.error('Error extracting knowledge:', error);
  }
}