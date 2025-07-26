-- Fix cascade delete for BPMN file deletion by updating foreign key constraints

-- Update process_knowledge_base foreign key to SET NULL on session deletion
ALTER TABLE public.process_knowledge_base 
DROP CONSTRAINT IF EXISTS process_knowledge_base_source_session_id_fkey;

ALTER TABLE public.process_knowledge_base 
ADD CONSTRAINT process_knowledge_base_source_session_id_fkey 
FOREIGN KEY (source_session_id) 
REFERENCES public.ai_chat_sessions(id) 
ON DELETE SET NULL;

-- Update ai_usage_logs session foreign key to SET NULL on session deletion
ALTER TABLE public.ai_usage_logs 
DROP CONSTRAINT IF EXISTS ai_usage_logs_session_id_fkey;

ALTER TABLE public.ai_usage_logs 
ADD CONSTRAINT ai_usage_logs_session_id_fkey 
FOREIGN KEY (session_id) 
REFERENCES public.ai_chat_sessions(id) 
ON DELETE SET NULL;