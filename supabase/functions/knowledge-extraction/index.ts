import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KnowledgeExtractionRequest {
  sessionId: string;
  forceExtraction?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { sessionId, forceExtraction = false }: KnowledgeExtractionRequest = await req.json();

    console.log('Starting knowledge extraction for session:', sessionId);

    // Get session with BPMN context
    const { data: session, error: sessionError } = await supabase
      .from('ai_chat_sessions')
      .select('user_id, bpmn_file_id, session_context')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    // Get conversation messages
    const { data: messages, error: messagesError } = await supabase
      .from('ai_chat_messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      throw new Error('Failed to get conversation messages');
    }

    if (!messages || messages.length < 2) {
      return new Response(JSON.stringify({ 
        message: 'Not enough conversation data for extraction' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare conversation for analysis
    const conversationText = messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    // Extract knowledge using OpenAI
    const extractionPrompt = `Analyze this HRIS process consultation conversation and extract valuable knowledge for future use. Focus on:

1. **Process Optimization Patterns**: Specific optimization strategies that worked well
2. **Risk Assessment Insights**: Compliance risks, operational risks, and mitigation strategies  
3. **Best Practice Recommendations**: Industry-standard approaches that were recommended
4. **Implementation Lessons**: Practical insights about change management and implementation

Return a JSON object with this structure:
{
  "patterns": [
    {
      "type": "optimization|risk_assessment|best_practice|implementation",
      "title": "Brief descriptive title",
      "description": "Detailed description of the pattern/insight",
      "context": "When this applies (process type, scenario, etc.)",
      "confidence": 0.0-1.0,
      "applicability": "specific|general|HRIS_specific"
    }
  ],
  "summary": "Brief summary of key insights from this conversation"
}

CONVERSATION:
${conversationText}`;

    console.log('Sending extraction request to OpenAI');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert knowledge extraction system specializing in HRIS processes. Extract actionable insights and patterns from conversations that can be reused to help future consultations.'
          },
          {
            role: 'user',
            content: extractionPrompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const extractedContent = aiResponse.choices[0].message.content;
    const usage = aiResponse.usage;

    console.log('Received extraction response:', extractedContent.substring(0, 200));

    // Parse extracted knowledge
    let extractedKnowledge;
    try {
      extractedKnowledge = JSON.parse(extractedContent);
    } catch (parseError) {
      console.error('Failed to parse extracted knowledge:', parseError);
      // Fallback: create simple extraction
      extractedKnowledge = {
        patterns: [{
          type: 'best_practice',
          title: 'General HRIS Consultation',
          description: extractedContent.substring(0, 500),
          context: 'General HRIS process consultation',
          confidence: 0.5,
          applicability: 'general'
        }],
        summary: 'Knowledge extracted from HRIS consultation'
      };
    }

    // Store patterns in knowledge base
    const insertPromises = extractedKnowledge.patterns.map((pattern: any) => {
      return supabase
        .from('process_knowledge_base')
        .insert({
          knowledge_type: pattern.type,
          bpmn_context: session.session_context,
          extracted_insights: {
            title: pattern.title,
            description: pattern.description,
            context: pattern.context,
            applicability: pattern.applicability,
            extracted_from_session: sessionId,
            conversation_summary: extractedKnowledge.summary
          },
          confidence_score: Math.min(Math.max(pattern.confidence || 0.5, 0), 1),
          source_session_id: sessionId
        });
    });

    const insertResults = await Promise.allSettled(insertPromises);
    const successfulInserts = insertResults.filter(result => result.status === 'fulfilled').length;

    console.log(`Successfully inserted ${successfulInserts} knowledge patterns`);

    // Log the extraction usage
    await supabase
      .from('ai_usage_logs')
      .insert({
        user_id: session.user_id,
        operation_type: 'knowledge_extraction',
        model_used: 'gpt-4o-mini',
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        cost_usd: usage.total_tokens * 0.000001,
        session_id: sessionId,
        bpmn_file_id: session.bpmn_file_id,
        metadata: { 
          patterns_extracted: successfulInserts,
          extraction_summary: extractedKnowledge.summary
        }
      });

    // Save extracted knowledge as JSON to storage bucket for backup
    const knowledgeFile = {
      sessionId,
      extractedAt: new Date().toISOString(),
      patterns: extractedKnowledge.patterns,
      summary: extractedKnowledge.summary,
      bpmnContext: session.session_context,
      conversationLength: messages.length
    };

    const fileName = `session-${sessionId}-${Date.now()}.json`;
    
    await supabase.storage
      .from('ai-knowledge-base')
      .upload(fileName, JSON.stringify(knowledgeFile, null, 2), {
        contentType: 'application/json'
      });

    console.log('Knowledge backup saved to storage:', fileName);

    return new Response(JSON.stringify({
      success: true,
      patternsExtracted: successfulInserts,
      summary: extractedKnowledge.summary,
      backupFile: fileName,
      usage: usage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in knowledge-extraction function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});