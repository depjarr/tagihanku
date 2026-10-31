BEGIN;

ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_accent_check;
ALTER TABLE user_settings ADD CONSTRAINT user_settings_accent_check
  CHECK (accent IN ('biru','merah','kuning','hijau','ungu','peach','kidcore','pixel','fairy','apple','cherry','ruby','coral','brick','poppy','tomato','garnet','holly','cocoa'));

COMMIT;