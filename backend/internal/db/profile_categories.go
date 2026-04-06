package db

import (
	"encoding/json"
	"strings"
)

// Allowed vendor profile category labels (keep in sync with frontend PRIMARY_SELLING_CATEGORY_OPTIONS).
var allowedVendorProfileCategories = map[string]struct{}{
	"Sneakers":    {},
	"Handbags":    {},
	"Watches":     {},
	"Apparel":     {},
	"Perfumes":    {},
	"Accessories": {},
}

func isAllowedProfileCategory(c string) bool {
	_, ok := allowedVendorProfileCategories[strings.TrimSpace(c)]
	return ok
}

// IsAllowedProfileLabel reports whether s is a known profile category option.
func IsAllowedProfileLabel(s string) bool {
	return isAllowedProfileCategory(s)
}

// FilterAllowedProfileCategories returns unique allowed labels in stable order.
func FilterAllowedProfileCategories(in []string) []string {
	seen := make(map[string]struct{})
	var out []string
	for _, raw := range in {
		c := strings.TrimSpace(raw)
		if c == "" || !isAllowedProfileCategory(c) {
			continue
		}
		if _, dup := seen[c]; dup {
			continue
		}
		seen[c] = struct{}{}
		out = append(out, c)
	}
	return out
}

// NormalizeOtherCategoriesForSave removes primary from extras, then filters to allowed unique values.
func NormalizeOtherCategoriesForSave(extras []string, primary string) []string {
	primary = strings.TrimSpace(primary)
	filtered := FilterAllowedProfileCategories(extras)
	if primary == "" {
		return filtered
	}
	var out []string
	for _, c := range filtered {
		if c == primary {
			continue
		}
		out = append(out, c)
	}
	return out
}

// DecodeOtherCategoriesStored parses DB value: JSON array, legacy comma-separated, or plain text.
func DecodeOtherCategoriesStored(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	var arr []string
	if err := json.Unmarshal([]byte(raw), &arr); err == nil {
		return FilterAllowedProfileCategories(arr)
	}
	if strings.Contains(raw, ",") {
		parts := strings.Split(raw, ",")
		var acc []string
		for _, p := range parts {
			acc = append(acc, strings.TrimSpace(p))
		}
		return FilterAllowedProfileCategories(acc)
	}
	return FilterAllowedProfileCategories([]string{raw})
}

// EncodeOtherCategoriesForDB stores a JSON array (empty -> []).
// Expect cats already normalized (e.g. via NormalizeOtherCategoriesForSave); this only marshals.
func EncodeOtherCategoriesForDB(cats []string) string {
	b, err := json.Marshal(cats)
	if err != nil {
		return "[]"
	}
	return string(b)
}
