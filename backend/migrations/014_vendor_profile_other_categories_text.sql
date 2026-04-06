-- Store JSON array of category names (e.g. ["Handbags","Watches"]); TEXT avoids VARCHAR(255) limits.
ALTER TABLE vendor_profile_step
    ALTER COLUMN other_categories TYPE TEXT;
