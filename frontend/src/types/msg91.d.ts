declare global {
  interface Window {
    initSendOTP?: (config: MSG91WidgetConfig) => void;
    sendOtp?: (
      identifier: string,
      onSuccess?: (data: unknown) => void,
      onFailure?: (error: unknown) => void
    ) => void;
    retryOtp?: (
      channel: string | null,
      onSuccess?: (data: unknown) => void,
      onFailure?: (error: unknown) => void,
      reqId?: string
    ) => void;
    verifyOtp?: (
      otp: string,
      onSuccess?: (data: MSG91VerifySuccess) => void,
      onFailure?: (error: unknown) => void,
      reqId?: string
    ) => void;
    getWidgetData?: () => unknown;
    isCaptchaVerified?: () => boolean;
  }
}

export interface MSG91WidgetConfig {
  widgetId: string;
  tokenAuth: string;
  identifier?: string;
  exposeMethods: boolean;
  captchaRenderId?: string;
  success?: (data: unknown) => void;
  failure?: (error: unknown) => void;
}

/** Response from verifyOtp success callback - MSG91 returns JWT in "message" field */
export interface MSG91VerifySuccess {
  type?: string;
  message?: string;  // JWT access token from MSG91
  token?: string;
  accessToken?: string;
  access_token?: string;
  [key: string]: unknown;
}
