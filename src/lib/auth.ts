/**
 * Client-side sign-in gate for the EMB Region 7 Planning Dashboard.
 *
 * Passwords are stored as PBKDF2-SHA256 hashes rather than plaintext, and the
 * session lives in `sessionStorage` so closing the tab signs the user out.
 *
 * NOTE: this is a browser-level gate for a static build. It stops casual
 * access and gives each account a named role, but it is NOT a substitute for
 * server-side authentication. If the dashboard is published publicly, put it
 * behind Microsoft Entra ID, SharePoint, or an Azure Static Web Apps
 * function before relying on it for real access control.
 */

export type UserRole =
  | 'administrator'
  | 'planning_focal'
  | 'ord'
  | 'cpd'
  | 'ambient';

export interface AuthUser {
  username: string;
  displayName: string;
  role: UserRole;
  roleLabel: string;
  initials: string;
  unit: string;
}

interface Account extends AuthUser {
  salt: string;
  passwordHash: string;
  iterations: number;
}

const SESSION_KEY = 'emb7-planning-dashboard-session-v1';
const PBKDF2_ITERATIONS = 120_000;

/**
 * Issued accounts. Passwords are shown here for the first sign-in; they should
 * be rotated before the dashboard is shared outside the office.
 *
 *   admin        / Admin@2026!   Administrator / IT Support
 *   planning     / Planning@2026! Planning Focal
 *   ord.focal    / Ord@2026!     ORD
 *   cpd.focal    / Cpd@2026!     CPD
 *   ambient.focal / Ambient@2026! Ambient
 */
const ACCOUNTS: Account[] = [
  {
    username: 'admin',
    displayName: 'Administrator',
    role: 'administrator',
    roleLabel: 'IT Support',
    initials: 'AD',
    unit: 'EMB Region 7 Planning Unit',
    salt: '6f1a2c8e5b73d0491a6e3c58b2d7f10',
    passwordHash:
      '763001352fc66f8c8a14b58f5f5afcb98c8e8625f936d1f23109284a6cd5e9c2',
    iterations: PBKDF2_ITERATIONS,
  },
  {
    username: 'planning',
    displayName: 'Planning Focal',
    role: 'planning_focal',
    roleLabel: 'Planning Focal',
    initials: 'PF',
    unit: 'ORD-PLANNING',
    salt: '2d9e4b7a1c60f8357b2ad94e6f01c38',
    passwordHash:
      'ae13308179ad070b64295f9b3718ec086226e8ef040647e6ece50f367660a6b9',
    iterations: PBKDF2_ITERATIONS,
  },
  {
    username: 'ord.focal',
    displayName: 'ORD Focal',
    role: 'ord',
    roleLabel: 'ORD Focal',
    initials: 'OR',
    unit: 'ORD',
    salt: '8c3a1f650db2749e5a86c019f3b7d2e4',
    passwordHash:
      'b3a041591cd56167fae712b509b7357431dfe02f46f0da2adea2b630b516b8f2',
    iterations: PBKDF2_ITERATIONS,
  },
  {
    username: 'cpd.focal',
    displayName: 'CPD Focal',
    role: 'cpd',
    roleLabel: 'CPD Focal',
    initials: 'CP',
    unit: 'CPD',
    salt: '4b7e2d9a06c1f53819a4e7b0c6d3f85',
    passwordHash:
      'c9a33a62b681994f3c5a4807e5d1762800e94f545bc4a6415305538cdde3058e',
    iterations: PBKDF2_ITERATIONS,
  },
  {
    username: 'ambient.focal',
    displayName: 'Ambient Focal',
    role: 'ambient',
    roleLabel: 'Ambient Focal',
    initials: 'AM',
    unit: 'Ambient Air Quality Monitoring',
    salt: '1e5a7c93b4d028f619a3e5c7b0d8426',
    passwordHash:
      'a0be9b4b9a259cd00a3b41ca94b69639cfbec60daa71e622b8210e35c868ff6c',
    iterations: PBKDF2_ITERATIONS,
  },
];

const encoder = new TextEncoder();

function toHex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function fromHex(value: string): ArrayBuffer {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes.buffer;
}

async function derivePasswordHash(
  password: string,
  salt: string,
  iterations: number,
): Promise<string> {
  if (!window.crypto?.subtle) {
    throw new Error('Web Crypto is unavailable in this browser.');
  }

  const key = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromHex(salt),
      iterations,
      hash: 'SHA-256',
    },
    key,
    256,
  );

  return toHex(bits);
}

function toAuthUser(account: Account): AuthUser {
  return {
    username: account.username,
    displayName: account.displayName,
    role: account.role,
    roleLabel: account.roleLabel,
    initials: account.initials,
    unit: account.unit,
  };
}

/** Resolves the account list so hashes stay in sync with the source file. */
async function readAccounts(): Promise<Account[]> {
  return ACCOUNTS;
}

/**
 * Verifies a username/password pair. A key derivation always runs, even for
 * an unknown username, so a failed sign-in does not reveal which accounts
 * exist.
 */
export async function authenticate(
  rawUsername: string,
  password: string,
): Promise<AuthUser | null> {
  const username = rawUsername.trim().toLowerCase();
  const accounts = await readAccounts();
  const account = accounts.find(
    (item) => item.username.toLowerCase() === username,
  );
  const candidate = account ?? accounts[0];

  const hash = await derivePasswordHash(
    password,
    candidate.salt,
    candidate.iterations,
  );
  if (!account || hash !== account.passwordHash) return null;

  const user = toAuthUser(account);
  saveSession(user);
  return user;
}

export function saveSession(user: AuthUser): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    // sessionStorage can be unavailable in locked-down browser contexts.
  }
}

export function loadSession(): AuthUser | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (typeof parsed.username !== 'string') return null;

    const lookup = parsed.username.toLowerCase();
    const account = ACCOUNTS.find(
      (item) => item.username.toLowerCase() === lookup,
    );
    return account ? toAuthUser(account) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clean up if sessionStorage is unavailable.
  }
}

/**
 * The seeded accounts, without password material. Used by the sign-in screen
 * to show the issued credentials for the current rollout.
 */
export function listIssuedAccounts(): {
  username: string;
  displayName: string;
  roleLabel: string;
  unit: string;
  initials: string;
}[] {
  return ACCOUNTS.map((account) => ({
    username: account.username,
    displayName: account.displayName,
    roleLabel: account.roleLabel,
    unit: account.unit,
    initials: account.initials,
  }));
}
