package msg91

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

const (
	baseURL     = "https://api.msg91.com/api"
	sendOTPPath = "/sendotp.php"
	verifyPath  = "/verifyRequestOTP.php"
	resendPath  = "/retryotp.php"
)

// Client for MSG91 OTP APIs.
type Client struct {
	AuthKey string
	client  *http.Client
}

// NewClient creates an MSG91 client.
func NewClient(authKey string) *Client {
	return &Client{AuthKey: authKey, client: &http.Client{}}
}

// SendOTPResponse from MSG91 send OTP.
type SendOTPResponse struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// SendOTP sends OTP to the given mobile (with country code, e.g. 919876543210).
func (c *Client) SendOTP(mobile string) (*SendOTPResponse, error) {
	u := baseURL + sendOTPPath
	params := url.Values{}
	params.Set("authkey", c.AuthKey)
	params.Set("mobile", mobile)
	params.Set("message", "Your Vendor login OTP is ##OTP##.")
	params.Set("otp_expiry", "5")
	params.Set("otp_length", "6")
	reqURL := u + "?" + params.Encode()
	resp, err := c.client.Get(reqURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var out SendOTPResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("msg91 send otp parse: %w", err)
	}
	return &out, nil
}

// VerifyOTPResponse from MSG91 verify OTP.
type VerifyOTPResponse struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// VerifyOTP verifies the OTP for the given mobile.
func (c *Client) VerifyOTP(mobile, otp string) (*VerifyOTPResponse, error) {
	u := baseURL + verifyPath
	params := url.Values{}
	params.Set("authkey", c.AuthKey)
	params.Set("mobile", mobile)
	params.Set("otp", otp)
	reqURL := u + "?" + params.Encode()
	resp, err := c.client.Get(reqURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var out VerifyOTPResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("msg91 verify otp parse: %w", err)
	}
	return &out, nil
}

// ResendOTPResponse from MSG91 resend OTP.
type ResendOTPResponse struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// ResendOTP resends OTP (voice or SMS depending on API).
func (c *Client) ResendOTP(mobile, retryType string) (*ResendOTPResponse, error) {
	if retryType == "" {
		retryType = "text"
	}
	u := baseURL + resendPath
	params := url.Values{}
	params.Set("authkey", c.AuthKey)
	params.Set("mobile", mobile)
	params.Set("retrytype", retryType)
	reqURL := u + "?" + params.Encode()
	resp, err := c.client.Get(reqURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var out ResendOTPResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("msg91 resend otp parse: %w", err)
	}
	return &out, nil
}
