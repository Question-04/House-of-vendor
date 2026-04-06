package storage

import (
	"bytes"
	"context"
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type R2Uploader struct {
	client        *s3.Client
	bucket        string
	publicBaseURL string
}

type R2Config struct {
	AccountID       string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	Region          string
	Endpoint        string
	PublicBaseURL   string
}

func NewR2Uploader(cfg R2Config) (*R2Uploader, error) {
	if cfg.Bucket == "" || cfg.AccessKeyID == "" || cfg.SecretAccessKey == "" {
		return nil, ErrStorageNotConfigured
	}

	endpoint := cfg.Endpoint
	if endpoint == "" && cfg.AccountID != "" {
		endpoint = "https://" + cfg.AccountID + ".r2.cloudflarestorage.com"
	}
	if endpoint == "" {
		return nil, ErrStorageNotConfigured
	}

	awsCfg := aws.Config{
		Region:      cfg.Region,
		Credentials: aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, "")),
	}
	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = true
		o.BaseEndpoint = aws.String(endpoint)
	})

	return &R2Uploader{
		client:        client,
		bucket:        cfg.Bucket,
		publicBaseURL: strings.TrimRight(cfg.PublicBaseURL, "/"),
	}, nil
}

func (r *R2Uploader) Upload(ctx context.Context, objectKey string, content []byte, contentType string) (string, error) {
	_, err := r.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(r.bucket),
		Key:         aws.String(objectKey),
		Body:        bytes.NewReader(content),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", err
	}

	if r.publicBaseURL != "" {
		return r.publicBaseURL + "/" + objectKey, nil
	}
	return "r2://" + r.bucket + "/" + objectKey, nil
}

func (r *R2Uploader) PresignGetURL(ctx context.Context, storedRef string, expiresIn time.Duration) (string, error) {
	bucket, key, err := r.resolveStoredRef(storedRef)
	if err != nil {
		return "", err
	}

	presigner := s3.NewPresignClient(r.client)
	out, err := presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(expiresIn))
	if err != nil {
		return "", err
	}
	return out.URL, nil
}

func (r *R2Uploader) resolveStoredRef(storedRef string) (string, string, error) {
	ref := strings.TrimSpace(storedRef)
	if ref == "" {
		return "", "", ErrInvalidStoredFileRef
	}

	if strings.HasPrefix(ref, "r2://") {
		withoutScheme := strings.TrimPrefix(ref, "r2://")
		parts := strings.SplitN(withoutScheme, "/", 2)
		if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
			return "", "", ErrInvalidStoredFileRef
		}
		return parts[0], parts[1], nil
	}

	if r.publicBaseURL != "" && strings.HasPrefix(ref, r.publicBaseURL+"/") {
		key := strings.TrimPrefix(ref, r.publicBaseURL+"/")
		if key == "" {
			return "", "", ErrInvalidStoredFileRef
		}
		return r.bucket, key, nil
	}

	if u, err := url.Parse(ref); err == nil && u.Path != "" && (u.Scheme == "http" || u.Scheme == "https") {
		key := strings.TrimPrefix(u.Path, "/")
		if key != "" {
			return r.bucket, key, nil
		}
	}

	if strings.Contains(ref, "/") {
		return "", "", ErrInvalidStoredFileRef
	}

	return r.bucket, ref, nil
}

func IsInvalidStoredRef(err error) bool {
	return errors.Is(err, ErrInvalidStoredFileRef)
}
