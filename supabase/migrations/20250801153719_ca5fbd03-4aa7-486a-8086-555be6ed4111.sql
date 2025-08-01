-- Create the missing bpmn_analysis_results table that the edge function expects
CREATE TABLE IF NOT EXISTS public.bpmn_analysis_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.bpmn_files(id) ON DELETE CASCADE,
  analysis_data JSONB NOT NULL,
  summary JSONB,
  findings JSONB,
  ai_insights JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bpmn_analysis_results ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view analysis results for their files" 
ON public.bpmn_analysis_results 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.bpmn_files bf 
    WHERE bf.id = bpmn_analysis_results.file_id 
    AND bf.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create analysis results for their files" 
ON public.bpmn_analysis_results 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bpmn_files bf 
    WHERE bf.id = bpmn_analysis_results.file_id 
    AND bf.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update analysis results for their files" 
ON public.bpmn_analysis_results 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.bpmn_files bf 
    WHERE bf.id = bpmn_analysis_results.file_id 
    AND bf.user_id = auth.uid()
  )
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bpmn_analysis_results_updated_at
BEFORE UPDATE ON public.bpmn_analysis_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();