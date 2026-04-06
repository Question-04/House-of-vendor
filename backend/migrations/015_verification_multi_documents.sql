-- Up to 2 files per document type (e.g. Aadhaar front + back). Legacy single-file columns stay in sync (first file).
ALTER TABLE vendor_verification_step
    ADD COLUMN IF NOT EXISTS aadhaar_documents JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE vendor_verification_step
    ADD COLUMN IF NOT EXISTS pan_documents JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE vendor_verification_step
SET aadhaar_documents = jsonb_build_array(
    jsonb_build_object(
        'url', aadhaar_file_url,
        'fileName', NULLIF(TRIM(aadhaar_file_name), ''),
        'mime', NULLIF(TRIM(aadhaar_file_mime), ''),
        'size', aadhaar_file_size
    )
)
WHERE jsonb_array_length(aadhaar_documents) = 0
  AND COALESCE(TRIM(aadhaar_file_url), '') != '';

UPDATE vendor_verification_step
SET pan_documents = jsonb_build_array(
    jsonb_build_object(
        'url', pan_file_url,
        'fileName', NULLIF(TRIM(pan_file_name), ''),
        'mime', NULLIF(TRIM(pan_file_mime), ''),
        'size', pan_file_size
    )
)
WHERE jsonb_array_length(pan_documents) = 0
  AND COALESCE(TRIM(pan_file_url), '') != '';
