-- ============================================
-- Migration 002: Alumni Registry (CSV Data Store)
-- ============================================

-- Alumni registry populated via CSV upload by admins
CREATE TABLE alumni_registry (
  id SERIAL PRIMARY KEY,
  sequence_number INTEGER,
  student_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  full_name_normalized TEXT NOT NULL,
  field_of_study TEXT,
  graduation_year INTEGER NOT NULL,
  is_claimed BOOLEAN DEFAULT FALSE,
  claimed_by UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_alumni_registry_student_number ON alumni_registry(student_number);
CREATE INDEX idx_alumni_registry_name_normalized ON alumni_registry(full_name_normalized);

-- Function to normalize Turkish names for matching
CREATE OR REPLACE FUNCTION normalize_turkish_name(name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN UPPER(
    TRANSLATE(
      TRIM(name),
      'ıİğĞüÜşŞöÖçÇâÂîÎûÛ',
      'IİGGUUSSÖÖCCAAIIUU'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-populate normalized name
CREATE OR REPLACE FUNCTION set_normalized_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name_normalized = UPPER(TRIM(NEW.full_name));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER alumni_registry_normalize_name
  BEFORE INSERT OR UPDATE ON alumni_registry
  FOR EACH ROW EXECUTE FUNCTION set_normalized_name();
