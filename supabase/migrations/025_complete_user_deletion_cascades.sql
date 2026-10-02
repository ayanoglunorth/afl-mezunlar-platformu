-- Complete the deletion chain for social messaging. PostgreSQL may validate a
-- direct sender/requester reference before the owning room/match cascade runs.
ALTER TABLE messages
  DROP CONSTRAINT messages_sender_id_fkey,
  ADD CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE matches
  DROP CONSTRAINT matches_requested_by_fkey,
  ADD CONSTRAINT matches_requested_by_fkey
    FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE CASCADE;
