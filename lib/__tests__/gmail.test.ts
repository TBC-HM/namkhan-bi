// @ts-nocheck — jest types not installed in this repo; runtime test only.
/**
 * Unit tests for lib/gmail.ts
 * Tests OAuth flow helpers and Gmail API wrappers (sales inbox flow)
 */

import {
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getUserEmail,
  GMAIL_SCOPES,
} from '../gmail';

// Mock environment
process.env.GOOGLE_CLIENT_ID = 'test_client_id';
process.env.GOOGLE_CLIENT_SECRET = 'test_client_secret';
process.env.GOOGLE_OAUTH_REDIRECT_URI = 'https://test.vercel.app/api/auth/gmail/callback';

// Mock Supabase admin
jest.mock('../supabaseAdmin', () => ({
  getSupabaseAdmin: jest.fn(() => ({
    rpc: jest.fn((name, params) => {
      if (name === 'fn_get_secret') {
        if (params.p_name === 'GOOGLE_CLIENT_ID') {
          return Promise.resolve({ data: 'vault_client_id', error: null });
        }
        if (params.p_name === 'GOOGLE_CLIENT_SECRET') {
          return Promise.resolve({ data: 'vault_client_secret', error: null });
        }
      }
      return Promise.resolve({ data: null, error: null });
    }),
    schema: jest.fn(() => ({
      from: jest.fn(() => ({
        upsert: jest.fn(() => Promise.resolve({ error: null })),
        select: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  })),
}));

// Mock fetch
global.fetch = jest.fn();

describe('lib/gmail.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildAuthUrl', () => {
    it('builds valid Google OAuth URL with correct scopes', async () => {
      const state = 'test_state_123';
      const url = await buildAuthUrl(state);
      
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=vault_client_id'); // uses vault, not env
      expect(url).toContain('redirect_uri=https%3A%2F%2Ftest.vercel.app');
      expect(url).toContain('response_type=code');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(url).toContain('state=test_state_123');
      expect(url).toContain(encodeURIComponent(GMAIL_SCOPES));
    });

    it('uses env fallback if vault fails', async () => {
      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValueOnce({
        rpc: jest.fn(() => Promise.resolve({ data: null, error: 'vault_error' })),
      });

      const url = await buildAuthUrl('test');
      expect(url).toContain('client_id=test_client_id'); // falls back to env
    });

    it('throws if no client ID available', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_OAUTH_CLIENT_ID;
      
      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValueOnce({
        rpc: jest.fn(() => Promise.resolve({ data: null, error: 'no_vault' })),
      });

      await expect(buildAuthUrl('test')).rejects.toThrow('Google OAuth client missing');
      
      // Restore
      process.env.GOOGLE_CLIENT_ID = 'test_client_id';
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('successfully exchanges code for tokens', async () => {
      const mockResponse = {
        access_token: 'ya29.test_access_token',
        expires_in: 3600,
        refresh_token: 'test_refresh_token',
        scope: GMAIL_SCOPES,
        token_type: 'Bearer',
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await exchangeCodeForTokens('test_code');
      
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        })
      );
    });

    it('throws on token exchange failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      });

      await expect(exchangeCodeForTokens('bad_code')).rejects.toThrow('Token exchange failed: 400');
    });
  });

  describe('refreshAccessToken', () => {
    it('successfully refreshes access token', async () => {
      const mockResponse = {
        access_token: 'ya29.new_access_token',
        expires_in: 3600,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await refreshAccessToken('test_refresh_token');
      
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('throws on refresh failure (invalid_grant)', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"error":"invalid_grant"}',
      });

      await expect(refreshAccessToken('bad_refresh_token')).rejects.toThrow('Refresh failed: 400');
    });
  });

  describe('getUserEmail', () => {
    it('successfully fetches user email', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'user@example.com' }),
      });

      const email = await getUserEmail('test_access_token');
      
      expect(email).toBe('user@example.com');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test_access_token' },
        })
      );
    });

    it('lowercases email address', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: 'USER@EXAMPLE.COM' }),
      });

      const email = await getUserEmail('test_access_token');
      expect(email).toBe('user@example.com');
    });

    it('throws if no email in response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: '123456' }), // no email
      });

      await expect(getUserEmail('test_access_token')).rejects.toThrow('No email in userinfo response');
    });

    it('throws on userinfo API failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(getUserEmail('bad_token')).rejects.toThrow('Userinfo failed: 401');
    });
  });

  describe('GMAIL_SCOPES constant', () => {
    it('includes required scopes', () => {
      expect(GMAIL_SCOPES).toContain('gmail.readonly');
      expect(GMAIL_SCOPES).toContain('userinfo.email');
      expect(GMAIL_SCOPES).toContain('openid');
    });

    it('is space-separated', () => {
      expect(GMAIL_SCOPES.split(' ').length).toBeGreaterThanOrEqual(3);
    });
  });
});
