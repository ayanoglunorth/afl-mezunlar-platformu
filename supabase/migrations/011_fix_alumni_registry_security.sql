-- ============================================
-- Migration 011: Fix Alumni Registry & Profiles Security
-- ============================================
-- Bu migration, alumni_registry tablosundaki kritik güvenlik
-- açıklarını kapatır ve profiles.role sütununun kötüye
-- kullanılmasını engeller.
-- ============================================

-- ============================================
-- 1. PROFILES: role sütununun güncellenmesini engelle
-- ============================================

-- Mevcut update politikasını kaldır
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile (restricted)" ON profiles;

-- Yeni politika: role, is_verified gibi alanları korur
-- Kullanıcı kendi profilini güncelleyebilir AMA role değiştiremez
CREATE POLICY "Users can update own profile (restricted)"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- role alanı değiştirilememeli: güncellenen role, mevcut role ile aynı olmalı
    AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
    -- is_verified alanı da korunmalı
    AND is_verified = (SELECT p.is_verified FROM profiles p WHERE p.id = auth.uid())
  );

-- ============================================
-- 2. ALUMNI REGISTRY: SELECT politikasını kısıtla
-- ============================================

-- Mevcut açık SELECT politikasını kaldır
DROP POLICY IF EXISTS "Authenticated users can read alumni registry" ON alumni_registry;
DROP POLICY IF EXISTS "Users can only see their own claimed registry entry" ON alumni_registry;

-- Yeni politika: Kullanıcılar sadece kendi kayıtlarını görebilir
-- Kayıt sırasında doğrulama için RPC fonksiyonu kullanılacak
-- Claim edilmiş kayıtlar sadece sahibi tarafından görülebilir
-- Claim edilmemiş kayıtlar hiçbir normal kullanıcı tarafından listeleme ile görülemez
-- (doğrulama server-side RPC ile yapılacak)
CREATE POLICY "Users can only see their own claimed registry entry"
  ON alumni_registry FOR SELECT
  TO authenticated
  USING (
    -- Admin her şeyi görebilir (zaten FOR ALL politikası var)
    -- Normal kullanıcılar sadece kendi claim ettikleri kaydı görebilir
    claimed_by = auth.uid()
  );

-- ============================================
-- 3. Alumni Doğrulama Fonksiyonu (Server-side RPC)
-- ============================================
-- Kayıt sırasında client'ın tüm tabloyu görmesine gerek yok.
-- Bunun yerine server-side RPC fonksiyonu ile doğrulama yapılır.

-- Öğrenci numarasıyla doğrulama
CREATE OR REPLACE FUNCTION verify_alumni_by_student_number(
  p_student_number TEXT,
  p_full_name_normalized TEXT
)
RETURNS jsonb AS $$
DECLARE
  v_entry RECORD;
BEGIN
  SELECT id, full_name, full_name_normalized, graduation_year, 
         field_of_study, student_number, is_claimed
  INTO v_entry
  FROM alumni_registry
  WHERE student_number = p_student_number;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'error', 'not_found');
  END IF;

  IF v_entry.is_claimed THEN
    RETURN jsonb_build_object('found', true, 'error', 'already_claimed');
  END IF;

  IF v_entry.full_name_normalized <> p_full_name_normalized THEN
    RETURN jsonb_build_object('found', true, 'error', 'name_mismatch');
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_entry.id,
    'full_name', v_entry.full_name,
    'graduation_year', v_entry.graduation_year,
    'field_of_study', v_entry.field_of_study,
    'student_number', v_entry.student_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- İsim ve mezuniyet yılıyla doğrulama (okul numarasını unutan kullanıcılar için)
CREATE OR REPLACE FUNCTION verify_alumni_by_name(
  p_full_name_normalized TEXT,
  p_graduation_year INTEGER
)
RETURNS jsonb AS $$
DECLARE
  v_entry RECORD;
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM alumni_registry
  WHERE full_name_normalized = p_full_name_normalized
    AND graduation_year = p_graduation_year;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('found', false, 'error', 'not_found');
  END IF;

  IF v_count > 1 THEN
    RETURN jsonb_build_object('found', false, 'error', 'multiple_matches');
  END IF;

  SELECT id, full_name, full_name_normalized, graduation_year,
         field_of_study, student_number, is_claimed
  INTO v_entry
  FROM alumni_registry
  WHERE full_name_normalized = p_full_name_normalized
    AND graduation_year = p_graduation_year;

  IF v_entry.is_claimed THEN
    RETURN jsonb_build_object('found', true, 'error', 'already_claimed');
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_entry.id,
    'full_name', v_entry.full_name,
    'graduation_year', v_entry.graduation_year,
    'field_of_study', v_entry.field_of_study,
    'student_number', v_entry.student_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. ANON erişimini tamamen kapat
-- ============================================
-- alumni_registry tablosuna anon rolünün hiçbir erişimi olmamalı
-- (RLS zaten 'authenticated' ile sınırlı ama ekstra koruma)
REVOKE ALL ON alumni_registry FROM anon;
REVOKE ALL ON profiles FROM anon;
