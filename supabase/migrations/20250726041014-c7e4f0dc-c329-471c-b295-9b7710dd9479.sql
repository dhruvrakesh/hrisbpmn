-- Create table for uploaded BPMN files
CREATE TABLE public.bpmn_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bpmn_files ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own BPMN files" 
ON public.bpmn_files 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can upload their own BPMN files" 
ON public.bpmn_files 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own BPMN files" 
ON public.bpmn_files 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own BPMN files" 
ON public.bpmn_files 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create storage bucket for BPMN files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bpmn-files', 'bpmn-files', false);

-- Create storage policies
CREATE POLICY "Users can upload their own BPMN files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'bpmn-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own BPMN files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'bpmn-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own BPMN files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'bpmn-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own BPMN files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'bpmn-files' AND auth.uid()::text = (storage.foldername(name))[1]);