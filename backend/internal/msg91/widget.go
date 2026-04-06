package msg91

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const widgetVerifyURL = "https://control.msg91.com/api/v5/widget/verifyAccessToken"

// VerifyAccessTokenRequest for MSG91 widget verify API.
type VerifyAccessTokenRequest struct {
	AuthKey     string `json:"authkey"`
	AccessToken string `json:"access-token"`
}

// VerifyAccessTokenResponse from MSG91.
type VerifyAccessTokenResponse struct {
	Type    string `json:"type"`
	Message string `json:"message,omitempty"`
}

// VerifyAccessToken calls MSG91 widget API to verify the JWT from client.
func (c *Client) VerifyAccessToken(accessToken string) (*VerifyAccessTokenResponse, error) {
	if c.AuthKey == "" {
		return nil, fmt.Errorf("MSG91 auth key not configured")
	}
	body := VerifyAccessTokenRequest{
		AuthKey:     c.AuthKey,
		AccessToken: accessToken,
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, widgetVerifyURL, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var out VerifyAccessTokenResponse
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, fmt.Errorf("verifyAccessToken parse: %w", err)
	}
	return &out, nil
}
