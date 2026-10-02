-- ============================================
-- Migration 048: Insert Match Note as First Message
-- ============================================

CREATE OR REPLACE FUNCTION create_chat_room_on_accept()
RETURNS TRIGGER AS $$
DECLARE
  v_room_id UUID;
  v_reason TEXT;
  v_note TEXT;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- 1. Create the chat room
    INSERT INTO chat_rooms (match_id, user_a, user_b, expires_at)
    VALUES (NEW.id, NEW.user_a, NEW.user_b, NOW() + INTERVAL '14 days')
    RETURNING id INTO v_room_id;

    -- 2. Check if there is a note attached to the match request
    IF NEW.match_reasons IS NOT NULL THEN
      FOREACH v_reason IN ARRAY NEW.match_reasons
      LOOP
        -- The UI prefixes user notes with "Mesaj: "
        IF v_reason LIKE 'Mesaj: %' THEN
          v_note := substring(v_reason from 8); -- Extract actual message
          
          IF v_note IS NOT NULL AND v_note <> '' THEN
            INSERT INTO messages (room_id, sender_id, content, is_read)
            VALUES (
              v_room_id, 
              COALESCE(NEW.requested_by, NEW.user_a), -- Fallback to user_a if null
              v_note,
              FALSE
            );
          END IF;
          
          -- Only insert the first note found
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
