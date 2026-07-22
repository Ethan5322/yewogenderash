-- Staff biometric + ID-card portrait for admins/sub-admins. Idempotent.
ALTER TABLE yd_users
  ADD COLUMN IF NOT EXISTS "idPhotoUrl" text,
  ADD COLUMN IF NOT EXISTS "faceDescriptor" text,
  ADD COLUMN IF NOT EXISTS "biometricEnrolledAt" timestamp(3);
