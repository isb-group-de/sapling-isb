export type BootstrapAdminInput = {
  loginName: string;
  password: string;
};

function decodeLine(value: string, label: string): string {
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error(`Invalid ${label} encoding.`);
  }

  const decoded = Buffer.from(value, 'base64').toString('utf8');
  if (!decoded || decoded.includes('\0') || /[\r\n]/.test(decoded)) {
    throw new Error(`Invalid ${label}.`);
  }
  return decoded;
}

export function parseBootstrapAdminInput(content: string): BootstrapAdminInput {
  const lines = content.trimEnd().split(/\r?\n/);
  if (lines.length !== 2) {
    throw new Error('Administrator input must contain exactly two lines.');
  }

  const loginName = decodeLine(lines[0], 'administrator login');
  const password = decodeLine(lines[1], 'administrator password');

  if (!/^[A-Za-z0-9._@-]{3,64}$/.test(loginName)) {
    throw new Error(
      'Administrator login must contain 3 to 64 supported characters.',
    );
  }
  if (password.length < 12) {
    throw new Error(
      'Administrator password must contain at least 12 characters.',
    );
  }
  const passwordClasses = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(
    (pattern) => pattern.test(password),
  ).length;
  if (passwordClasses < 3) {
    throw new Error(
      'Administrator password must use at least three character classes.',
    );
  }

  return { loginName, password };
}
