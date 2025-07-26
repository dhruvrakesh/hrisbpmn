-- Drop existing foreign key constraint and recreate with CASCADE
ALTER TABLE public.ai_usage_logs 
DROP CONSTRAINT IF EXISTS ai_usage_logs_bpmn_file_id_fkey;

-- Add the foreign key constraint with ON DELETE CASCADE
ALTER TABLE public.ai_usage_logs 
ADD CONSTRAINT ai_usage_logs_bpmn_file_id_fkey 
FOREIGN KEY (bpmn_file_id) 
REFERENCES public.bpmn_files(id) 
ON DELETE CASCADE;