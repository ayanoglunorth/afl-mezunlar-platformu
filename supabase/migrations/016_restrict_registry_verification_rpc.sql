-- ============================================
-- Migration 016: Restrict Registry Verification RPC
-- ============================================
-- This protects the alumni registry from direct client-side enumeration.
-- Attack scenario: an attacker uses the public anon key to call verification
-- RPCs repeatedly and infer real student numbers or alumni names.

REVOKE EXECUTE ON FUNCTION verify_alumni_by_student_number(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION verify_alumni_by_name(TEXT, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION verify_alumni_by_student_number(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION verify_alumni_by_name(TEXT, INTEGER) TO service_role;
