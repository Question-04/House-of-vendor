package db

import (
	"encoding/json"
	"strings"
)

// MaxKYCFilesPerDocType is the most files allowed per Aadhaar or PAN slot (e.g. front + back).
const MaxKYCFilesPerDocType = 2

// VerificationFileEntry is one uploaded KYC file stored in R2 (url is storage ref or public URL).
type VerificationFileEntry struct {
	URL      string `json:"url"`
	FileName string `json:"fileName"`
	MIME     string `json:"mime"`
	Size     int64  `json:"size"`
}

func parseVerificationDocsJSON(raw []byte) ([]VerificationFileEntry, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var out []VerificationFileEntry
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func marshalVerificationDocsJSON(docs []VerificationFileEntry) ([]byte, error) {
	if docs == nil {
		docs = []VerificationFileEntry{}
	}
	return json.Marshal(docs)
}

func mergeLegacySingleDoc(docs []VerificationFileEntry, url, name, mime string, size int64) []VerificationFileEntry {
	if len(docs) > 0 {
		return trimVerificationDocs(docs)
	}
	url = strings.TrimSpace(url)
	if url == "" {
		return nil
	}
	return []VerificationFileEntry{{URL: url, FileName: name, MIME: mime, Size: size}}
}

func firstDocLegacyFields(docs []VerificationFileEntry) (url, name, mime string, size int64) {
	if len(docs) == 0 {
		return "", "", "", 0
	}
	return docs[0].URL, docs[0].FileName, docs[0].MIME, docs[0].Size
}

func trimVerificationDocs(docs []VerificationFileEntry) []VerificationFileEntry {
	if len(docs) <= MaxKYCFilesPerDocType {
		return docs
	}
	out := make([]VerificationFileEntry, MaxKYCFilesPerDocType)
	copy(out, docs[:MaxKYCFilesPerDocType])
	return out
}
