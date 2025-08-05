-- Create table for BPMN element customizations
CREATE TABLE bpmn_element_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_result_id UUID NOT NULL REFERENCES bpmn_analysis_results(id) ON DELETE CASCADE,
  element_id TEXT NOT NULL,
  original_step_number INTEGER NOT NULL,
  custom_step_number INTEGER,
  original_swim_lane TEXT NOT NULL DEFAULT 'Unassigned',
  custom_swim_lane TEXT,
  custom_description TEXT,
  element_type TEXT NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(analysis_result_id, element_id)
);

-- Create table for BPMN swim lane customizations
CREATE TABLE bpmn_swim_lane_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_result_id UUID NOT NULL REFERENCES bpmn_analysis_results(id) ON DELETE CASCADE,
  lane_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  custom_name TEXT,
  color_code TEXT,
  description TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(analysis_result_id, lane_id)
);

-- Enable RLS on the new tables
ALTER TABLE bpmn_element_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bpmn_swim_lane_customizations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for element customizations
CREATE POLICY "Users can manage their own element customizations" 
ON bpmn_element_customizations 
FOR ALL 
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM bpmn_analysis_results bar 
    JOIN bpmn_files bf ON bar.file_id = bf.id 
    WHERE bar.id = analysis_result_id AND bf.user_id = auth.uid()
  )
);

-- Create RLS policies for swim lane customizations  
CREATE POLICY "Users can manage their own swim lane customizations"
ON bpmn_swim_lane_customizations
FOR ALL
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM bpmn_analysis_results bar
    JOIN bpmn_files bf ON bar.file_id = bf.id
    WHERE bar.id = analysis_result_id AND bf.user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_element_customizations_analysis_result ON bpmn_element_customizations(analysis_result_id);
CREATE INDEX idx_swim_lane_customizations_analysis_result ON bpmn_swim_lane_customizations(analysis_result_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_element_customizations_updated_at
  BEFORE UPDATE ON bpmn_element_customizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swim_lane_customizations_updated_at
  BEFORE UPDATE ON bpmn_swim_lane_customizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();