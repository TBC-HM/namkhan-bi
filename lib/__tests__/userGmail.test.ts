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
  sendMessage,
  replyToMessage,
  archiveMessage,
  markRead,
  trashMessage,
  checkAiPolicyEnabled,
  getMessage,
  getThread,
  listInboxMessages,
  modifyLabelsForUser,
  refreshIfExpired,
} from '../userGmail';

// Mock environment
process.env.NEXT_PUBLIC_APP_URL = 'https://test-app.vercel.app';
process.env.GOOGLE_USER_OAUTH_CLIENT_ID = 'test_user_client_id';
process.env.GOOGLE_USER_OAUTH_CLIENT_SECRET = 'test_user_client_secret';

// Mock Supabase admin
jest.mock('../supabaseAdmin', () => ({
  getSupabaseAdmin: jest.fn(() => ({
    rpc: jest.fn(),
  })),
}));

// Mock fetch
global.fetch = jest.fn();

const mockRefreshIfExpired = jest.fn();
const mockGetCurrentAuthUser = jest.fn();
const mockSendMessage = jest.fn();
const mockReplyToMessage = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('lib/userGmail.ts', () => {
  describe('buildUserAuthUrl', () => {
    it('builds valid OAuth URL with user scopes', async () => {
      const mockRpc = jest.fn()
        .mockResolvedValueOnce({ data: 'vault_user_client_id', error: null })
        .mockResolvedValueOnce({ data: 'vault_user_client_secret', error: null });

      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValue({
        rpc: mockRpc,
      });

      const state = 'test_state_abc';
      const url = await buildUserAuthUrl(state);

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=vault_user_client_id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Ftest-app.vercel.app');
      expect(url).toContain('state=test_state_abc');
      expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/gmail.send'));
    });

    it('includes send + modify scopes (not just readonly)', async () => {
      const mockRpc = jest.fn()
        .mockResolvedValueOnce({ data: 'cid', error: null })
        .mockResolvedValueOnce({ data: 'csec', error: null });

      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValue({
        rpc: mockRpc,
      });

      const url = await buildUserAuthUrl('state');
      const scopeStr = USER_GMAIL_SCOPES;

      expect(scopeStr).toContain('gmail.send');
      expect(scopeStr).toContain('gmail.modify');
      expect(scopeStr).toContain('gmail.readonly');
      expect(url).toContain(encodeURIComponent(scopeStr));
    });
  });

  describe('exchangeCode', () => {
    it('successfully exchanges authorization code', async () => {
      const mockRpc = jest.fn()
        .mockResolvedValueOnce({ data: 'vault_user_client_id', error: null })
        .mockResolvedValueOnce({ data: 'vault_user_client_secret', error: null });

      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValue({
        rpc: mockRpc,
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'ya29.test_access',
          refresh_token: 'refresh_xyz',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      const tokens = await exchangeCode('auth_code_123');

      expect(tokens.access_token).toBe('ya29.test_access');
      expect(tokens.refresh_token).toBe('refresh_xyz');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('auth_code_123'),
        })
      );
    });

    it('throws descriptive error on failure', async () => {
      const mockRpc = jest.fn()
        .mockResolvedValueOnce({ data: 'cid', error: null })
        .mockResolvedValueOnce({ data: 'csec', error: null });

      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValue({
        rpc: mockRpc,
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      });

      await expect(exchangeCode('bad_code')).rejects.toThrow('token_exchange_failed_400');
    });
  });

  describe('fetchUserinfoEmail', () => {
    it('returns email from userinfo endpoint', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          email: 'user@example.com',
          verified_email: true,
        }),
      });

      const email = await fetchUserinfoEmail('access_token_xyz');

      expect(email).toBe('user@example.com');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer access_token_xyz',
          }),
        })
      );
    });

    it('throws if userinfo call fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(fetchUserinfoEmail('bad_token')).rejects.toThrow('userinfo_failed_401');
    });

    it('throws if email missing in response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await expect(fetchUserinfoEmail('access_token')).rejects.toThrow('userinfo_no_email');
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
      const mockGetConnection = jest.fn().mockResolvedValue({
        data: {
          access_token: 'access_xyz',
          refresh_token: 'refresh_xyz',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          gmail_address: 'user@example.com',
          active: true,
        },
        error: null,
      });

      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValue({
        rpc: mockGetConnection,
      });

      const result = await refreshIfExpired('user_id_1');

      expect(result.access).toBe('access_xyz');
      expect(result.gmail).toBe('user@example.com');
    });
  });

  describe('sendMessage', () => {
    it('sends email via Gmail API', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'msg_sent_123',
          threadId: 'thread_new',
        }),
      });

      const result = await sendMessage('access_token', {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test body',
      });

      expect(result.id).toBe('msg_sent_123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            authorization: 'Bearer access_token',
          }),
        })
      );
    });

    it('includes cc and bcc if provided', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg_123', threadId: 'thread_123' }),
      });

      await sendMessage('access_token', {
        to: 'to@example.com',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
        subject: 'Test',
        text: 'Body',
      });

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      const raw = Buffer.from(callBody.raw, 'base64url').toString('utf-8');

      expect(raw).toContain('To: to@example.com');
      expect(raw).toContain('Cc: cc@example.com');
      expect(raw).toContain('Bcc: bcc@example.com');
    });
  });

  describe('replyToMessage', () => {
    it('sends reply with correct headers', async () => {
      const mockGetConnection = jest.fn().mockResolvedValue({
        data: {
          access_token: 'access_xyz',
          refresh_token: 'refresh_xyz',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          gmail_address: 'me@example.com',
          active: true,
        },
        error: null,
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg_reply_123', threadId: 'thread_original' }),
      });

      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValue({
        rpc: mockGetConnection,
      });

      const result = await replyToMessage('user_1', 'thread_original', {
        to: 'sender@example.com',
        subject: 'Re: Original Subject',
        text: 'Reply body',
        inReplyTo: '<msg_id@mail.gmail.com>',
      });

      expect(result.id).toBe('msg_reply_123');
      expect(result.threadId).toBe('thread_original');
    });
  });

  describe('archiveMessage', () => {
    it('removes INBOX label', async () => {
      const mockGetConnection = jest.fn().mockResolvedValue({
        data: {
          access_token: 'access_xyz',
          refresh_token: 'refresh_xyz',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          gmail_address: 'user@example.com',
          active: true,
        },
        error: null,
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg_123' }),
      });

      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValue({
        rpc: mockGetConnection,
      });

      await archiveMessage('user_1', 'msg_123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/gmail/v1/users/me/messages/msg_123/modify'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
        })
      );
    });
  });

  describe('markRead', () => {
    it('modifies UNREAD label correctly', async () => {
      const mockGetConnection = jest.fn().mockResolvedValue({
        data: {
          access_token: 'access_xyz',
          refresh_token: 'refresh_xyz',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          gmail_address: 'user@example.com',
          active: true,
        },
        error: null,
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg_123' }),
      });

      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValue({
        rpc: mockGetConnection,
      });

      await markRead('user_1', 'msg_123', true);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/gmail/v1/users/me/messages/msg_123/modify'),
        expect.objectContaining({
          body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
        })
      );
    });
  });

  describe('trashMessage', () => {
    it('calls trash endpoint', async () => {
      const mockGetConnection = jest.fn().mockResolvedValue({
        data: {
          access_token: 'access_xyz',
          refresh_token: 'refresh_xyz',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          gmail_address: 'user@example.com',
          active: true,
        },
        error: null,
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg_123' }),
      });

      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValue({
        rpc: mockGetConnection,
      });

      await trashMessage('user_1', 'msg_123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/gmail/v1/users/me/messages/msg_123/trash'),
        expect.any(Object)
      );
    });
  });

  describe('checkAiPolicyEnabled', () => {
    it('returns true if AI features enabled for mailbox', async () => {
      const mockRpc = jest.fn().mockResolvedValue({ data: true, error: null });
      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValueOnce({
        rpc: mockRpc,
      });

      const result = await checkAiPolicyEnabled(1);

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('fn_mail_ai_features_enabled', { p_mailbox_id: 1 });
    });

    it('returns false if AI disabled', async () => {
      const mockRpc = jest.fn().mockResolvedValue({ data: false, error: null });
      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValueOnce({
        rpc: mockRpc,
      });

      const result = await checkAiPolicyEnabled(2);

      expect(result).toBe(false);
    });
  });

  describe('getMessage', () => {
    it('fetches full message with refreshIfExpired call', async () => {
      const mockGetConnection = jest.fn().mockResolvedValue({
        data: {
          access_token: 'access_xyz',
          refresh_token: 'refresh_xyz',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          gmail_address: 'user@example.com',
          active: true,
        },
        error: null,
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'msg_123',
          threadId: 'thread_456',
          labelIds: ['INBOX'],
          payload: {
            headers: [{ name: 'Subject', value: 'Test' }],
            body: { data: 'SGVsbG8=' }, // Base64 "Hello"
          },
        }),
      });

      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValue({
        rpc: mockGetConnection,
      });

      const msg = await getMessage('user_1', 'msg_123');

      expect(msg.id).toBe('msg_123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/gmail/v1/users/me/messages/msg_123'),
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: "Bearer access_xyz",
          }),
        })
      );
    });
  });

  describe('getThread', () => {
    it('fetches all messages in a thread', async () => {
      const mockGetConnection = jest.fn().mockResolvedValue({
        data: {
          access_token: 'access_xyz',
          refresh_token: 'refresh_xyz',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          gmail_address: 'user@example.com',
          active: true,
        },
        error: null,
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'thread_456',
          messages: [
            { id: 'msg_1', threadId: 'thread_456', payload: { headers: [] } },
            { id: 'msg_2', threadId: 'thread_456', payload: { headers: [] } },
          ],
        }),
      });

      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValue({
        rpc: mockGetConnection,
      });

      const messages = await getThread('user_1', 'thread_456');

      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('msg_1');
      expect(messages[1].id).toBe('msg_2');
    });
  });

  describe('listInboxMessages', () => {
    it('lists unread inbox threads', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          messages: [
            { id: 'msg_1', threadId: 'thread_1' },
            { id: 'msg_2', threadId: 'thread_2' },
          ],
        }),
      });

      const threads = await listInboxMessages('access_token_xyz', 'unread', 50);

      expect(threads).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=in%3Ainbox%20is%3Aunread'),
        expect.any(Object)
      );
    });

    it('lists all inbox threads when scope=all', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          messages: [{ id: 'msg_1', threadId: 'thread_1' }],
        }),
      });

      await listInboxMessages('access_token_xyz', 'all', 100);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=in%3Ainbox'),
        expect.any(Object)
      );
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('is%3Aunread'),
        expect.any(Object)
      );
    });
  });

  describe('modifyLabelsForUser', () => {
    it('modifies labels after refreshing token', async () => {
      const mockGetConnection = jest.fn().mockResolvedValue({
        data: {
          access_token: 'access_xyz',
          refresh_token: 'refresh_xyz',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          gmail_address: 'user@example.com',
          active: true,
        },
        error: null,
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'msg_123' }),
      });

      const { getSupabaseAdmin } = require('../supabaseAdmin');
      getSupabaseAdmin.mockReturnValue({
        rpc: mockGetConnection,
      });

      await modifyLabelsForUser('user_1', 'msg_123', ['Label_1'], ['INBOX']);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/gmail/v1/users/me/messages/msg_123/modify'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            addLabelIds: ['Label_1'],
            removeLabelIds: ['INBOX'],
          }),
        })
      );
    });
  });
});
