-- Create the ai-knowledge-base storage bucket for backing up knowledge extractions
INSERT INTO storage.buckets (id, name, public) VALUES ('ai-knowledge-base', 'ai-knowledge-base', false);

-- Create policies for ai-knowledge-base bucket
CREATE POLICY "Knowledge base files are accessible to authenticated users" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'ai-knowledge-base' AND auth.role() = 'authenticated');

CREATE POLICY "Service role can manage knowledge base files" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'ai-knowledge-base' AND auth.role() = 'service_role');