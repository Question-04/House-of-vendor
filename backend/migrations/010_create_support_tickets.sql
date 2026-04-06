CREATE TABLE IF NOT EXISTS public.support_tickets (
    id SERIAL PRIMARY KEY,
    vendor_phone VARCHAR(20) NOT NULL,
    ticket_code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN (
        'Payment', 'Verification', 'Shipping',
        'Login/Account', 'Onboarding', 'Other'
    )),
    order_id TEXT,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    email TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN (
        'Open', 'In Progress', 'Resolved', 'Closed'
    )),
    doc_urls TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_vendor_phone ON public.support_tickets (vendor_phone);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets (created_at DESC);
