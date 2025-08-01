-- Create BPMN version history and audit trail tables
CREATE TABLE public.bpmn_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bpmn_file_id UUID NOT NULL REFERENCES public.bpmn_files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  version_type TEXT NOT NULL CHECK (version_type IN ('original', 'ai_revised', 'manual_edit')),
  bpmn_xml TEXT NOT NULL,
  file_path TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ai_suggestions_applied JSONB DEFAULT '[]'::jsonb,
  change_summary TEXT,
  file_size INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create BPMN audit trail table
CREATE TABLE public.bpmn_audit_trail (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bpmn_file_id UUID NOT NULL REFERENCES public.bpmn_files(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.bpmn_versions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('upload', 'ai_suggestion_applied', 'manual_edit', 'download', 'template_save', 'bizagi_export')),
  action_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_suggestion_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bpmn_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bpmn_audit_trail ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bpmn_versions
CREATE POLICY "Users can view their own BPMN versions" 
ON public.bpmn_versions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.bpmn_files 
    WHERE bpmn_files.id = bpmn_versions.bpmn_file_id 
    AND bpmn_files.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create versions for their own BPMN files" 
ON public.bpmn_versions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bpmn_files 
    WHERE bpmn_files.id = bpmn_versions.bpmn_file_id 
    AND bpmn_files.user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- RLS Policies for bpmn_audit_trail
CREATE POLICY "Users can view their own BPMN audit trail" 
ON public.bpmn_audit_trail 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.bpmn_files 
    WHERE bpmn_files.id = bpmn_audit_trail.bpmn_file_id 
    AND bpmn_files.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert audit trail entries" 
ON public.bpmn_audit_trail 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_bpmn_versions_file_id ON public.bpmn_versions(bpmn_file_id);
CREATE INDEX idx_bpmn_versions_created_at ON public.bpmn_versions(created_at DESC);
CREATE INDEX idx_bpmn_audit_trail_file_id ON public.bpmn_audit_trail(bpmn_file_id);
CREATE INDEX idx_bpmn_audit_trail_created_at ON public.bpmn_audit_trail(created_at DESC);

-- Function to automatically create initial version when BPMN file is uploaded
CREATE OR REPLACE FUNCTION public.create_initial_bpmn_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Create initial version entry
  INSERT INTO public.bpmn_versions (
    bpmn_file_id,
    version_number,
    version_type,
    bpmn_xml,
    file_path,
    created_by,
    change_summary,
    file_size
  ) VALUES (
    NEW.id,
    1,
    'original',
    '',  -- Will be updated when file is loaded
    NEW.file_path,
    NEW.user_id,
    'Initial upload',
    NEW.file_size
  );
  
  -- Create audit trail entry
  INSERT INTO public.bpmn_audit_trail (
    bpmn_file_id,
    user_id,
    action_type,
    action_details
  ) VALUES (
    NEW.id,
    NEW.user_id,
    'upload',
    jsonb_build_object(
      'file_name', NEW.file_name,
      'file_size', NEW.file_size,
      'uploaded_at', NEW.uploaded_at
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic version creation
CREATE TRIGGER create_initial_version_trigger
  AFTER INSERT ON public.bpmn_files
  FOR EACH ROW
  EXECUTE FUNCTION public.create_initial_bpmn_version();

-- Function to create new version when AI suggestions are applied
CREATE OR REPLACE FUNCTION public.create_ai_revised_version(
  p_bpmn_file_id UUID,
  p_revised_xml TEXT,
  p_suggestions_applied JSONB,
  p_change_summary TEXT DEFAULT 'AI suggestions applied'
)
RETURNS UUID AS $$
DECLARE
  next_version INTEGER;
  new_version_id UUID;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM public.bpmn_versions
  WHERE bpmn_file_id = p_bpmn_file_id;
  
  -- Create new version
  INSERT INTO public.bpmn_versions (
    bpmn_file_id,
    version_number,
    version_type,
    bpmn_xml,
    created_by,
    ai_suggestions_applied,
    change_summary
  ) VALUES (
    p_bpmn_file_id,
    next_version,
    'ai_revised',
    p_revised_xml,
    auth.uid(),
    p_suggestions_applied,
    p_change_summary
  ) RETURNING id INTO new_version_id;
  
  -- Create audit trail entry
  INSERT INTO public.bpmn_audit_trail (
    bpmn_file_id,
    version_id,
    user_id,
    action_type,
    action_details,
    ai_suggestion_data
  ) VALUES (
    p_bpmn_file_id,
    new_version_id,
    auth.uid(),
    'ai_suggestion_applied',
    jsonb_build_object(
      'version_number', next_version,
      'change_summary', p_change_summary
    ),
    p_suggestions_applied
  );
  
  RETURN new_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log download activity
CREATE OR REPLACE FUNCTION public.log_bpmn_download(
  p_bpmn_file_id UUID,
  p_version_id UUID DEFAULT NULL,
  p_download_type TEXT DEFAULT 'original'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.bpmn_audit_trail (
    bpmn_file_id,
    version_id,
    user_id,
    action_type,
    action_details
  ) VALUES (
    p_bpmn_file_id,
    p_version_id,
    auth.uid(),
    'download',
    jsonb_build_object(
      'download_type', p_download_type,
      'downloaded_at', now()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;