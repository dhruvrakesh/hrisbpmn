-- Create AI chat sessions table
CREATE TABLE public.ai_chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bpmn_file_id UUID REFERENCES public.bpmn_files(id) ON DELETE CASCADE,
  session_context JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  session_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI chat messages table
CREATE TABLE public.ai_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  token_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI usage logs table
CREATE TABLE public.ai_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('chat', 'analysis', 'knowledge_extraction')),
  model_used TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  session_id UUID REFERENCES public.ai_chat_sessions(id),
  bpmn_file_id UUID REFERENCES public.bpmn_files(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create process knowledge base table
CREATE TABLE public.process_knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('pattern', 'optimization', 'best_practice', 'risk_assessment')),
  bpmn_context JSONB NOT NULL,
  extracted_insights JSONB NOT NULL,
  confidence_score NUMERIC(3,2) DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  usage_count INTEGER DEFAULT 0,
  effectiveness_score NUMERIC(3,2) DEFAULT 0.0 CHECK (effectiveness_score >= 0 AND effectiveness_score <= 1),
  source_session_id UUID REFERENCES public.ai_chat_sessions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for chat sessions
CREATE POLICY "Users can manage their own chat sessions" 
ON public.ai_chat_sessions 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for chat messages
CREATE POLICY "Users can manage messages in their sessions" 
ON public.ai_chat_messages 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.ai_chat_sessions 
    WHERE id = ai_chat_messages.session_id 
    AND user_id = auth.uid()
  )
);

-- Create RLS policies for usage logs
CREATE POLICY "Users can view their own usage logs" 
ON public.ai_usage_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage logs" 
ON public.ai_usage_logs 
FOR INSERT 
WITH CHECK (true);

-- Create RLS policies for knowledge base
CREATE POLICY "Users can view knowledge base" 
ON public.process_knowledge_base 
FOR SELECT 
USING (true);

CREATE POLICY "System can manage knowledge base" 
ON public.process_knowledge_base 
FOR ALL 
USING (true);

-- Create storage bucket for AI knowledge base
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ai-knowledge-base', 'AI Knowledge Base', false);

-- Create storage policies for AI knowledge base
CREATE POLICY "System can manage AI knowledge files" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'ai-knowledge-base');

-- Create indexes for performance
CREATE INDEX idx_ai_chat_sessions_user_id ON public.ai_chat_sessions(user_id);
CREATE INDEX idx_ai_chat_sessions_bpmn_file_id ON public.ai_chat_sessions(bpmn_file_id);
CREATE INDEX idx_ai_chat_messages_session_id ON public.ai_chat_messages(session_id);
CREATE INDEX idx_ai_usage_logs_user_id ON public.ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at);
CREATE INDEX idx_process_knowledge_base_knowledge_type ON public.process_knowledge_base(knowledge_type);

-- Create function to update last_activity_at
CREATE OR REPLACE FUNCTION update_chat_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.ai_chat_sessions 
  SET last_activity_at = now(), updated_at = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update session activity when messages are added
CREATE TRIGGER update_session_activity_trigger
  AFTER INSERT ON public.ai_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_session_activity();