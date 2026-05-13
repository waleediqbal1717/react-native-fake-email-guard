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
