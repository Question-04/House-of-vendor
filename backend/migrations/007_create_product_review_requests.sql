-- Product review requests: when a user doesn't find a product, they can submit details for review.
-- Your team can then verify and add the product to the catalog.

CREATE TABLE IF NOT EXISTS public.product_review_requests (
    id SERIAL PRIMARY KEY,
    product_name TEXT,
    category TEXT NOT NULL,
    product_link TEXT NOT NULL,
    description TEXT,
    image_urls TEXT[] DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_review_requests_status ON public.product_review_requests (status);
CREATE INDEX IF NOT EXISTS idx_product_review_requests_created_at ON public.product_review_requests (created_at);
