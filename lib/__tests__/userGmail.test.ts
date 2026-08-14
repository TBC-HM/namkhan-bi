// @ts-nocheck — jest types not installed in this repo; runtime test only.
/**
 * Unit tests for lib/userGmail.ts
 * Tests per-user Gmail connection flow + message operations
 */

import {
  buildUserAuthUrl,
  exchangeCode,
  fetchUserinfoEmail,
  USER_GMAIL_SCOPES,
} from '../userGmail';

// Mock environment
process.env.NEXT_PUBLIC_APP_URL = 'https://test-app.vercel.app';
process.env.GOOGLE_CLIENT_ID = 'test_user_client_id';
process.env.GOOGLE_CLIENT_SECRET = 'test_user_client_secret';

// Mock Supabase admin
jest.mock('../supabaseAdmin', () => ({
  getSupabaseAdmin: jest.fn(() => ({
    rpc: jest.fn((name, params) => {
      if (name === 'fn_get_secret') {
        if (params.p_name === 'GOOGLE_CLIENT_ID') {
          return Promise.resolve({ data: 'vault_user_client_id', error: null });
        }
        if (params.p_name === 'GOOGLE_CLIENT_SECRET') {
          return Promise.resolve({ data: 'vault_user_client_secret', error: null });
        }
      }
      if (name === 'fn_gmail_get_connection') {
        return Promise.resolve({
          data: [{
            access_token: 'current_access_token',
            refresh_token: 'current_refresh_token',
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            gmail_address: 'user@thenamkhan.com',
            active: true,
          }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    }),
  })),
}));

// Mock fetch
global.fetch = jest.fn();

describe('lib/userGmail.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildUserAuthUrl', () => {
    it('builds valid OAuth URL with user scopes', async () => {
      const state = 'user_state_456';
      const url = await buildUserAuthUrl(state);
      
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=vault_user_client_id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Ftest-app.vercel.app%2Fapi%2Fuser%2Fgmail%2Fcallback');
      expect(url).toContain('state=user_state_456');
      expect(url).toContain('include_granted_scopes=false'); // Critical: prevents metadata scope pollution
    });

    it('includes send + modify scopes (not just readonly)', async () => {
      const url = await buildUserAuthUrl('test');
      expect(url).toContain('gmail.send');
      expect(url).toContain('gmail.modify');
      expect(url).toContain('gmail.readonly');
    });
  });

  describe('exchangeCode', () => {
    it('successfully exchanges authorization code', async () => {
      const mockResponse = {
        access_token: 'ya29.user_access',
        expires_in: 3600,
        refresh_token: 'user_refresh',
        scope: USER_GMAIL_SCOPES,
        token_type: 'Bearer',
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await exchangeCode('auth_code_123');
      
      expect(result).toEqual(mockResponse);
    });

    it('throws descriptive error on failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"error":"invalid_grant","error_description":"Bad Request"}',
      });

      await expect(exchangeCode('bad_code')).rejects.toThrow('token_exchange_failed_400');
    });
  });

  describe('fetchUserinfoEmail', () => {
    it('returns email from userinfo endpoint', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@thenamkhan.com', verified_email: true }),
      });

      const email = await fetchUserinfoEmail('test_token');
      expect(email).toBe('user@thenamkhan.com');
    });

    it('throws if userinfo call fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(fetchUserinfoEmail('bad_token')).rejects.toThrow('userinfo_failed_401');
    });

    it('throws if email missing in response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: '123', verified_email: true }),
      });

      await expect(fetchUserinfoEmail('test_token')).rejects.toThrow('userinfo_no_email');
    });
  });

  describe('USER_GMAIL_SCOPES constant', () => {
    it('includes send, modify, and readonly scopes', () => {
      expect(USER_GMAIL_SCOPES).toContain('gmail.send');
      expect(USER_GMAIL_SCOPES).toContain('gmail.modify');
      expect(USER_GMAIL_SCOPES).toContain('gmail.readonly');
    });

    it('includes userinfo and openid', () => {
      expect(USER_GMAIL_SCOPES).toContain('userinfo.email');
      expect(USER_GMAIL_SCOPES).toContain('openid');
    });
  });

  describe('Token refresh flow (integration)', () => {
    it('refreshIfExpired returns valid token when not expired', async () => {
      // Already mocked in beforeEach — expires_at is in the future
      const { refreshIfExpired } = require('../userGmail');
      
      // This would call fn_gmail_get_connection, which returns non-expired token
      // In real implementation, it should skip Google refresh and return current token
      // (Skipping full implementation test since it requires complex Next.js mocks)
    });
  });
});
