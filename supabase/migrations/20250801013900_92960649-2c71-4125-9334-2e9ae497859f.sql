-- Create BPMN templates table for Phase 2
CREATE TABLE public.bpmn_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  description TEXT,
  bpmn_xml TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_public BOOLEAN DEFAULT false,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bpmn_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own templates and public templates" 
ON public.bpmn_templates 
FOR SELECT 
USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can create their own templates" 
ON public.bpmn_templates 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" 
ON public.bpmn_templates 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" 
ON public.bpmn_templates 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_bpmn_templates_user_id ON public.bpmn_templates(user_id);
CREATE INDEX idx_bpmn_templates_category ON public.bpmn_templates(category);
CREATE INDEX idx_bpmn_templates_public ON public.bpmn_templates(is_public) WHERE is_public = true;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_bpmn_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_bpmn_templates_updated_at
BEFORE UPDATE ON public.bpmn_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_bpmn_templates_updated_at();