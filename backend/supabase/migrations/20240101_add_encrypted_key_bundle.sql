ALTER TABLE public.secret_attachments ADD COLUMN IF NOT EXISTS encrypted_key_bundle TEXT;
