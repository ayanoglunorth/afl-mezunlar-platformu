-- A profile owns its matches and chat rooms. Without cascading participant
-- foreign keys, deleting any user who has opened a social chat fails before the
-- match cascade can remove the room.
ALTER TABLE chat_rooms
  DROP CONSTRAINT chat_rooms_user_a_fkey,
  ADD CONSTRAINT chat_rooms_user_a_fkey
    FOREIGN KEY (user_a) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE chat_rooms
  DROP CONSTRAINT chat_rooms_user_b_fkey,
  ADD CONSTRAINT chat_rooms_user_b_fkey
    FOREIGN KEY (user_b) REFERENCES profiles(id) ON DELETE CASCADE;
