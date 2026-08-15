// @ts-nocheck — jest types not installed in this repo; runtime test only.
/**
 * Unit tests for mail send/reply routes
 * Tests app/api/mail/send/route.ts and app/api/mail/reply/route.ts
 */

// Mock Next.js server imports
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    constructor(url, options) {
      this.url = url;
      this.method = options?.method || 'POST';
      this.body = options?.body;
    }
    async json() {
      return this.body;
    }
  },
  NextResponse: {
    json: (data, init) => ({ 
      _data: data, 
      _status: init?.status || 200,
      json: async () => data,
    }),
  },
}));

// Mock userGmail module
const mockGetCurrentAuthUser = jest.fn();
const mockRefreshIfExpired = jest.fn();
const mockSendMessage = jest.fn();
const mockReplyToMessage = jest.fn();

jest.mock('../../lib/userGmail', () => ({
  getCurrentAuthUser: mockGetCurrentAuthUser,
  refreshIfExpired: mockRefreshIfExpired,
  sendMessage: mockSendMessage,
  replyToMessage: mockReplyToMessage,
}));

describe('Mail API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/mail/send', () => {
    let POST;

    beforeAll(async () => {
      // Dynamic import to apply mocks
      const routeModule = await import('../../app/api/mail/send/route');
      POST = routeModule.POST;
    });

    it('returns 401 if user not signed in', async () => {
      mockGetCurrentAuthUser.mockResolvedValueOnce(null);
      
      const req = new (require('next/server').NextRequest)('http://localhost/api/mail/send', {
        method: 'POST',
        body: { to: 'test@example.com', subject: 'Test', body_html: '<p>Hi</p>' },
      });

      const res = await POST(req);
      
      expect(res._status).toBe(401);
      expect(res._data.error).toBe('not_signed_in');
    });

    it('returns 400 if required fields missing', async () => {
      mockGetCurrentAuthUser.mockResolvedValueOnce({
        id: 'user-123',
        email: 'sender@thenamkhan.com',
      });

      const req = new (require('next/server').NextRequest)('http://localhost/api/mail/send', {
        method: 'POST',
        body: { to: 'test@example.com' }, // missing subject, body_html
      });

      const res = await POST(req);
      
      expect(res._status).toBe(400);
      expect(res._data.error).toBe('missing_fields');
    });

    it('successfully sends email with valid inputs', async () => {
      mockGetCurrentAuthUser.mockResolvedValueOnce({
        id: 'user-123',
        email: 'sender@thenamkhan.com',
        user_metadata: { full_name: 'John Doe' },
      });

      mockRefreshIfExpired.mockResolvedValueOnce({
        access: 'access_token_123',
        gmail: 'sender@thenamkhan.com',
      });

      mockSendMessage.mockResolvedValueOnce({
        id: 'gmail-msg-id-123',
        threadId: 'gmail-thread-id-456',
      });

      const req = new (require('next/server').NextRequest)('http://localhost/api/mail/send', {
        method: 'POST',
        body: {
          to: 'recipient@example.com',
          subject: 'Test Subject',
          body_html: '<p>Test body</p>',
          cc: 'cc@example.com',
        },
      });

      const res = await POST(req);
      
      expect(res._status).toBe(200);
      expect(res._data.ok).toBe(true);
      expect(res._data.data.id).toBe('gmail-msg-id-123');
      
      expect(mockSendMessage).toHaveBeenCalledWith(
        'access_token_123',
        expect.objectContaining({
          from: 'John Doe <sender@thenamkhan.com>',
          to: 'recipient@example.com',
          cc: 'cc@example.com',
          subject: 'Test Subject',
          body_html: '<p>Test body</p>',
        })
      );
    });

    it('uses email address as display name if full_name not set', async () => {
      mockGetCurrentAuthUser.mockResolvedValueOnce({
        id: 'user-123',
        email: 'sender@thenamkhan.com',
        user_metadata: {},
      });

      mockRefreshIfExpired.mockResolvedValueOnce({
        access: 'access_token_123',
        gmail: 'sender@thenamkhan.com',
      });

      mockSendMessage.mockResolvedValueOnce({ id: 'msg-id' });

      const req = new (require('next/server').NextRequest)('http://localhost/api/mail/send', {
        method: 'POST',
        body: {
          to: 'test@example.com',
          subject: 'Subject',
          body_html: '<p>Body</p>',
        },
      });

      const res = await POST(req);
      
      expect(mockSendMessage).toHaveBeenCalledWith(
        'access_token_123',
        expect.objectContaining({
          from: 'sender@thenamkhan.com <sender@thenamkhan.com>',
        })
      );
    });

    it('returns 500 on send failure', async () => {
      mockGetCurrentAuthUser.mockResolvedValueOnce({
        id: 'user-123',
        email: 'sender@thenamkhan.com',
      });

      mockRefreshIfExpired.mockResolvedValueOnce({
        access: 'access_token_123',
        gmail: 'sender@thenamkhan.com',
      });

      mockSendMessage.mockRejectedValueOnce(new Error('Gmail API error'));

      const req = new (require('next/server').NextRequest)('http://localhost/api/mail/send', {
        method: 'POST',
        body: {
          to: 'test@example.com',
          subject: 'Test',
          body_html: '<p>Hi</p>',
        },
      });

      const res = await POST(req);
      
      expect(res._status).toBe(500);
      expect(res._data.error).toBe('Gmail API error');
    });
  });

  describe('POST /api/mail/reply', () => {
    let POST;

    beforeAll(async () => {
      const routeModule = await import('../../app/api/mail/reply/route');
      POST = routeModule.POST;
    });

    it('returns 401 if user not signed in', async () => {
      mockGetCurrentAuthUser.mockResolvedValueOnce(null);
      
      const req = new (require('next/server').NextRequest)('http://localhost/api/mail/reply', {
        method: 'POST',
        body: {
          threadId: 'thread-123',
          inReplyToId: 'msg-456',
          to: 'recipient@example.com',
          subject: 'Re: Test',
          body: 'Reply text',
        },
      });

      const res = await POST(req);
      
      expect(res._status).toBe(401);
      expect(res._data.error).toBe('not_signed_in');
    });

    it('returns 400 if required fields missing', async () => {
      mockGetCurrentAuthUser.mockResolvedValueOnce({
        id: 'user-123',
        email: 'sender@thenamkhan.com',
      });

      const req = new (require('next/server').NextRequest)('http://localhost/api/mail/reply', {
        method: 'POST',
        body: {
          threadId: 'thread-123',
          // missing inReplyToId, to, subject, body
        },
      });

      const res = await POST(req);
      
      expect(res._status).toBe(400);
      expect(res._data.error).toBe('missing_fields');
    });

    it('successfully sends reply with valid inputs', async () => {
      mockGetCurrentAuthUser.mockResolvedValueOnce({
        id: 'user-123',
        email: 'sender@thenamkhan.com',
      });

      mockReplyToMessage.mockResolvedValueOnce({
        id: 'reply-msg-id',
        threadId: 'thread-123',
      });

      const req = new (require('next/server').NextRequest)('http://localhost/api/mail/reply', {
        method: 'POST',
        body: {
          threadId: 'thread-123',
          inReplyToId: 'msg-456',
          to: 'recipient@example.com',
          subject: 'Re: Original Subject',
          body: 'This is my reply',
        },
      });

      const res = await POST(req);
      
      expect(res._status).toBe(200);
      expect(res._data.ok).toBe(true);
      expect(res._data.data.id).toBe('reply-msg-id');
      
      expect(mockReplyToMessage).toHaveBeenCalledWith(
        'user-123',
        'thread-123',
        'msg-456',
        'This is my reply',
        'Re: Original Subject',
        'recipient@example.com'
      );
    });

    it('returns 500 on reply failure', async () => {
      mockGetCurrentAuthUser.mockResolvedValueOnce({
        id: 'user-123',
        email: 'sender@thenamkhan.com',
      });

      mockReplyToMessage.mockRejectedValueOnce(new Error('Thread not found'));

      const req = new (require('next/server').NextRequest)('http://localhost/api/mail/reply', {
        method: 'POST',
        body: {
          threadId: 'bad-thread',
          inReplyToId: 'msg-456',
          to: 'recipient@example.com',
          subject: 'Re: Test',
          body: 'Reply',
        },
      });

      const res = await POST(req);
      
      expect(res._status).toBe(500);
      expect(res._data.error).toBe('Thread not found');
    });
  });
});
