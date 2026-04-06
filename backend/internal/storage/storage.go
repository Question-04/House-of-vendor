package storage

import (
	"context"
	"errors"
	"time"
)

var ErrStorageNotConfigured = errors.New("storage is not configured")
var ErrInvalidStoredFileRef = errors.New("invalid stored file reference")

type Uploader interface {
	Upload(ctx context.Context, objectKey string, content []byte, contentType string) (string, error)
	PresignGetURL(ctx context.Context, storedRef string, expiresIn time.Duration) (string, error)
}
