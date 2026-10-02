-- Historical data was checked before deployment: no duplicate non-empty
-- student numbers exist. Keep the trigger for a clear error message and add the
-- database uniqueness invariant as the final concurrency-safe backstop.
CREATE UNIQUE INDEX profiles_student_number_unique
  ON profiles ((BTRIM(student_number)))
  WHERE NULLIF(BTRIM(student_number), '') IS NOT NULL;
