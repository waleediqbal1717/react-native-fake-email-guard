import DISPOSABLE_DOMAINS from "./domains";

export interface EmailCheckResult {
  isDisposable: boolean;
  domain: string;
  email: string;
}

// Mutable set that starts as a copy of the built-in blocklist
const blocklist = new Set(DISPOSABLE_DOMAINS);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extractDomain(email: string): string | null {
  const parts = email.toLowerCase().trim().split("@");
  if (parts.length !== 2 || !parts[1]) return null;
  return parts[1];
}

/**
 * Returns true if the email address uses a known disposable/temporary domain.
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const domain = extractDomain(email);
  if (!domain) return false;
  return blocklist.has(domain);
}

/**
 * Alias for isDisposableEmail.
 */
export const isFakeEmail = isDisposableEmail;

/**
 * Returns true if the email passes basic format validation AND is not disposable.
 */
export function isValidEmail(email: string): boolean {
  if (!email || !EMAIL_REGEX.test(email)) return false;
  return !isDisposableEmail(email);
}

/**
 * Returns a detailed result object with domain info.
 */
export function checkEmail(email: string): EmailCheckResult {
  const domain = extractDomain(email) ?? "";
  return {
    email: email.toLowerCase().trim(),
    domain,
    isDisposable: blocklist.has(domain),
  };
}

/**
 * Adds custom domains to the blocklist (e.g. domain-specific throwaway services).
 */
export function addBlockedDomains(domains: string[]): void {
  domains.forEach((d) => blocklist.add(d.toLowerCase().trim()));
}

/**
 * Removes domains from the blocklist (e.g. to whitelist a domain you trust).
 */
export function removeBlockedDomains(domains: string[]): void {
  domains.forEach((d) => blocklist.delete(d.toLowerCase().trim()));
}

/**
 * Returns a copy of all currently blocked domains.
 */
export function getBlockedDomains(): string[] {
  return Array.from(blocklist);
}

/**
 * Resets the blocklist back to the built-in defaults.
 */
export function resetBlocklist(): void {
  blocklist.clear();
  DISPOSABLE_DOMAINS.forEach((d) => blocklist.add(d));
}

// Minimal structural type so this file compiles without the "dom" lib
// (this package targets RN/Node/browser alike) while still accepting the
// real global `fetch` at runtime, or any drop-in replacement.
type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

// This package's own blocklist, refreshed on a schedule independently of npm
// releases (see .github/workflows/update-domains.yml) — see syncBlocklist().
const DEFAULT_REMOTE_URL =
  "https://raw.githubusercontent.com/waleediqbal1717/react-native-fake-email-guard/main/data/disposable-domains.txt";

export interface SyncBlocklistOptions {
  /** Newline-separated list of domains to fetch. Defaults to this package's own list, kept fresh independently of npm releases. */
  url?: string;
  /** Override for `fetch` (e.g. in tests, or runtimes without a global `fetch`). Defaults to `globalThis.fetch`. */
  fetchFn?: FetchLike;
}

export interface SyncBlocklistResult {
  /** How many domains from the response were not already blocked. */
  added: number;
  /** Total domains blocked after merging. */
  total: number;
}

/**
 * Fetches a disposable-domain list over the network and merges it into the
 * blocklist. Opt-in only — isDisposableEmail/isValidEmail work fully offline
 * without ever calling this.
 *
 * Why this exists: disposable-mail services (temp-mail.org and friends)
 * rotate through new domains constantly, faster than any bundled list — let
 * alone an app update — can keep up with. Call this at app startup (and
 * periodically, e.g. once a day) to pick up newly observed domains without
 * shipping a new app release. Already-blocked domains are not double-counted.
 *
 * Throws if no `fetch` is available and `fetchFn` isn't supplied, or if the
 * request itself fails — callers should decide whether to surface, log, or
 * swallow that (the existing bundled list still applies either way).
 */
export async function syncBlocklist(
  options: SyncBlocklistOptions = {}
): Promise<SyncBlocklistResult> {
  const { url = DEFAULT_REMOTE_URL, fetchFn } = options;
  const doFetch: FetchLike | undefined =
    fetchFn ?? (globalThis as { fetch?: FetchLike }).fetch;
  if (!doFetch) {
    throw new Error(
      "syncBlocklist requires a `fetch` implementation. Pass `fetchFn` explicitly in environments without a global fetch."
    );
  }

  const res = await doFetch(url);
  if (!res.ok) {
    throw new Error(`syncBlocklist: failed to fetch ${url} (${res.status})`);
  }

  const domains = (await res.text())
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith("#"));

  const before = blocklist.size;
  addBlockedDomains(domains);
  return { added: blocklist.size - before, total: blocklist.size };
}

/**
 * Minimal key-value storage interface, e.g. an AsyncStorage/MMKV instance,
 * used by `enableAutoSync` to remember when it last synced across app
 * restarts. Without one, auto-sync still works, but re-fetches on every cold
 * start since there's nowhere to remember the last sync time.
 */
export interface AutoSyncStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

export interface AutoSyncOptions extends SyncBlocklistOptions {
  /** How often to refresh, in ms. Default: 24 hours. */
  intervalMs?: number;
  /** Persists the last-synced timestamp across app restarts (e.g. AsyncStorage). Without it, every cold start re-fetches. */
  storage?: AutoSyncStorage;
  /** Called after each successful sync. */
  onSync?: (result: SyncBlocklistResult) => void;
  /** Called if a sync attempt fails. Auto-sync keeps retrying on the next interval regardless — the bundled list still applies in the meantime. */
  onError?: (error: unknown) => void;
}

const LAST_SYNCED_STORAGE_KEY = "react-native-fake-email-guard:lastSyncedAt";

/**
 * Turns on hands-off background refreshing: syncs immediately, then again
 * every `intervalMs`, for as long as the app runs — so new disposable
 * domains show up automatically and nobody has to remember to call
 * `syncBlocklist` or ship an app update. Call it once, e.g. in your app's
 * entry file:
 *
 * ```ts
 * useEffect(() => enableAutoSync(), []);
 * ```
 *
 * Still entirely opt-in — nothing in this package talks to the network
 * unless `syncBlocklist` or `enableAutoSync` is called. Returns a function
 * that stops it.
 */
export function enableAutoSync(options: AutoSyncOptions = {}): () => void {
  const { intervalMs = 24 * 60 * 60 * 1000, storage, onSync, onError, ...syncOptions } = options;

  let stopped = false;

  const maybeSync = async () => {
    if (storage) {
      try {
        const lastSyncedAt = Number(await storage.getItem(LAST_SYNCED_STORAGE_KEY)) || 0;
        if (Date.now() - lastSyncedAt < intervalMs) return; // already fresh, skip the network call
      } catch {
        // Storage read failed — fall through and sync anyway.
      }
    }

    try {
      const result = await syncBlocklist(syncOptions);
      if (stopped) return;
      onSync?.(result);
      if (storage) {
        try {
          await storage.setItem(LAST_SYNCED_STORAGE_KEY, String(Date.now()));
        } catch {
          // Storage write failed — next tick will just sync again, which is harmless.
        }
      }
    } catch (error) {
      if (!stopped) onError?.(error);
    }
  };

  void maybeSync();
  const timer = setInterval(maybeSync, intervalMs);
  // Don't keep a Node process (e.g. tests, scripts) alive just for this timer.
  (timer as unknown as { unref?: () => void }).unref?.();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
