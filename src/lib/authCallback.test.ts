import { describe, expect, it } from 'vitest';
import {
  AuthCallbackError,
  parseAuthCallbackCode,
} from '@/lib/authCallback';

describe('parseAuthCallbackCode', () => {
  it('accepts the exact PKCE callback URL', () => {
    expect(parseAuthCallbackCode('tanglak://login-callback?code=one-time-code'))
      .toBe('one-time-code');
  });

  it.each([
    'https://login-callback?code=code',
    'tanglak://other-host?code=code',
    'tanglak://login-callback/other?code=code',
    'tanglak://login-callback#code=code',
    'tanglak://login-callback#access_token=token&refresh_token=refresh',
    'not a url',
  ])('rejects callbacks outside the exact registered endpoint: %s', (url) => {
    expect(() => parseAuthCallbackCode(url)).toThrow(AuthCallbackError);
  });

  it('rejects missing, empty, and duplicated authorization codes', () => {
    expect(() => parseAuthCallbackCode('tanglak://login-callback')).toThrow(AuthCallbackError);
    expect(() => parseAuthCallbackCode('tanglak://login-callback?code=')).toThrow(AuthCallbackError);
    expect(() => parseAuthCallbackCode(
      'tanglak://login-callback?code=first&code=second',
    )).toThrow(AuthCallbackError);
  });

  it('does not expose provider error details to the UI', () => {
    const error = (() => {
      try {
        parseAuthCallbackCode(
          'tanglak://login-callback?error=access_denied&error_description=sensitive',
        );
      } catch (cause) {
        return cause;
      }
      return null;
    })();

    expect(error).toBeInstanceOf(AuthCallbackError);
    expect((error as Error).message).not.toContain('sensitive');
  });
});
