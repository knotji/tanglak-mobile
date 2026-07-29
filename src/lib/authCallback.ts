const CALLBACK_PROTOCOL = 'tanglak:';
const CALLBACK_HOST = 'login-callback';

export class AuthCallbackError extends Error {
  constructor(message = 'ลิงก์เข้าสู่ระบบไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่') {
    super(message);
    this.name = 'AuthCallbackError';
  }
}

export function parseAuthCallbackCode(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AuthCallbackError();
  }

  if (
    url.protocol !== CALLBACK_PROTOCOL
    || url.hostname !== CALLBACK_HOST
    || (url.pathname !== '' && url.pathname !== '/')
    || url.username !== ''
    || url.password !== ''
    || url.port !== ''
    || url.hash !== ''
  ) {
    throw new AuthCallbackError();
  }

  const providerError = url.searchParams.get('error_description')
    ?? url.searchParams.get('error');
  if (providerError) throw new AuthCallbackError();

  const codes = url.searchParams.getAll('code');
  if (codes.length !== 1 || !codes[0].trim()) throw new AuthCallbackError();
  return codes[0];
}
