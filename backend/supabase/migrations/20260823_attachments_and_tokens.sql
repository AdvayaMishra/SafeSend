CREATE TABLE IF NOT EXISTS public.secret_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secret_id UUID NOT NULL REFERENCES public.secrets(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    encrypted_key_bundle TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.secret_attachments ADD COLUMN IF NOT EXISTS encrypted_key_bundle TEXT;

GRANT ALL ON TABLE public.secret_attachments TO service_role;
GRANT ALL ON TABLE public.secret_attachments TO postgres;

CREATE TABLE IF NOT EXISTS public.secret_access_tokens (
    token TEXT PRIMARY KEY,
    secret_id UUID NOT NULL REFERENCES public.secrets(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);

GRANT ALL ON TABLE public.secret_access_tokens TO service_role;
GRANT ALL ON TABLE public.secret_access_tokens TO postgres;
