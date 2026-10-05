import {
  isDisposableEmail,
  isFakeEmail,
  isValidEmail,
  checkEmail,
  addBlockedDomains,
  removeBlockedDomains,
  getBlockedDomains,
  resetBlocklist,
  syncBlocklist,
} from "../src/index";

afterEach(() => {
  resetBlocklist();
});

describe("isDisposableEmail", () => {
  it("returns true for known disposable domains", () => {
    expect(isDisposableEmail("user@mailinator.com")).toBe(true);
    expect(isDisposableEmail("test@tempmail.com")).toBe(true);
    expect(isDisposableEmail("hello@guerrillamail.com")).toBe(true);
    expect(isDisposableEmail("x@yopmail.com")).toBe(true);
    expect(isDisposableEmail("x@10minutemail.com")).toBe(true);
    expect(isDisposableEmail("x@trashmail.me")).toBe(true);
  });

  it("returns true for domains from the community blocklist", () => {
    expect(isDisposableEmail("x@tempmail.plus")).toBe(true);
    expect(isDisposableEmail("x@mailto.plus")).toBe(true);
    expect(isDisposableEmail("x@dropmail.me")).toBe(true);
    expect(isDisposableEmail("x@1secmail.com")).toBe(true);
    expect(isDisposableEmail("x@tempmailo.com")).toBe(true);
    expect(isDisposableEmail("x@1pad.de")).toBe(true);
    expect(isDisposableEmail("x@pud.org")).toBe(true);
  });

  it("returns false for legitimate email providers", () => {
    expect(isDisposableEmail("user@gmail.com")).toBe(false);
    expect(isDisposableEmail("user@outlook.com")).toBe(false);
    expect(isDisposableEmail("user@yahoo.com")).toBe(false);
    expect(isDisposableEmail("user@icloud.com")).toBe(false);
    expect(isDisposableEmail("user@protonmail.com")).toBe(false);
    expect(isDisposableEmail("user@company.com")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isDisposableEmail("user@Mailinator.COM")).toBe(true);
    expect(isDisposableEmail("USER@TEMPMAIL.COM")).toBe(true);
  });

  it("handles invalid inputs gracefully", () => {
    expect(isDisposableEmail("")).toBe(false);
    expect(isDisposableEmail("notanemail")).toBe(false);
    expect(isDisposableEmail("@nodomain")).toBe(false);
    // @ts-expect-error testing runtime guard
    expect(isDisposableEmail(null)).toBe(false);
    // @ts-expect-error testing runtime guard
    expect(isDisposableEmail(undefined)).toBe(false);
  });
});

describe("isFakeEmail", () => {
  it("is an alias for isDisposableEmail", () => {
    expect(isFakeEmail("user@mailinator.com")).toBe(true);
    expect(isFakeEmail("user@gmail.com")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("returns false for disposable emails", () => {
    expect(isValidEmail("user@mailinator.com")).toBe(false);
  });

  it("returns false for malformed emails", () => {
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("missing@")).toBe(false);
    expect(isValidEmail("@nodomain.com")).toBe(false);
  });

  it("returns true for well-formed legitimate emails", () => {
    expect(isValidEmail("user@gmail.com")).toBe(true);
    expect(isValidEmail("john.doe@company.org")).toBe(true);
  });
});

describe("checkEmail", () => {
  it("returns structured result for disposable email", () => {
    const result = checkEmail("test@mailinator.com");
    expect(result.isDisposable).toBe(true);
    expect(result.domain).toBe("mailinator.com");
    expect(result.email).toBe("test@mailinator.com");
  });

  it("returns structured result for legitimate email", () => {
    const result = checkEmail("john@gmail.com");
    expect(result.isDisposable).toBe(false);
    expect(result.domain).toBe("gmail.com");
    expect(result.email).toBe("john@gmail.com");
  });

  it("normalizes email to lowercase", () => {
    const result = checkEmail("TEST@Gmail.COM");
    expect(result.email).toBe("test@gmail.com");
    expect(result.domain).toBe("gmail.com");
  });
});

describe("addBlockedDomains / removeBlockedDomains", () => {
  it("allows adding a custom domain to the blocklist", () => {
    expect(isDisposableEmail("user@mycustomspam.io")).toBe(false);
    addBlockedDomains(["mycustomspam.io"]);
    expect(isDisposableEmail("user@mycustomspam.io")).toBe(true);
  });

  it("allows removing a domain from the blocklist", () => {
    expect(isDisposableEmail("user@mailinator.com")).toBe(true);
    removeBlockedDomains(["mailinator.com"]);
    expect(isDisposableEmail("user@mailinator.com")).toBe(false);
  });

  it("is case-insensitive when adding domains", () => {
    addBlockedDomains(["MyDomain.IO"]);
    expect(isDisposableEmail("user@mydomain.io")).toBe(true);
  });
});

describe("getBlockedDomains", () => {
  it("returns the current list of blocked domains", () => {
    const domains = getBlockedDomains();
    expect(Array.isArray(domains)).toBe(true);
    expect(domains).toContain("mailinator.com");
    expect(domains.length).toBeGreaterThan(100);
  });
});

describe("syncBlocklist", () => {
  it("fetches and merges new domains using an injected fetchFn", async () => {
    expect(isDisposableEmail("x@freshly-rotated-domain.com")).toBe(false);
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "# comment\nfreshly-rotated-domain.com\nmailinator.com\n",
    });

    const result = await syncBlocklist({ url: "https://example.com/list.txt", fetchFn });

    expect(fetchFn).toHaveBeenCalledWith("https://example.com/list.txt");
    expect(isDisposableEmail("x@freshly-rotated-domain.com")).toBe(true);
    expect(result.added).toBe(1); // mailinator.com was already blocked
  });

  it("throws when the fetch response is not ok", async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" });
    await expect(syncBlocklist({ fetchFn })).rejects.toThrow(/404/);
  });

  it("throws when no fetch implementation is available", async () => {
    const originalFetch = globalThis.fetch;
    // @ts-expect-error simulating an environment with no global fetch
    delete globalThis.fetch;
    try {
      await expect(syncBlocklist({ url: "https://example.com/list.txt" })).rejects.toThrow(/fetch/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("resetBlocklist", () => {
  it("restores defaults after custom changes", () => {
    removeBlockedDomains(["mailinator.com"]);
    addBlockedDomains(["myfakecustom.xyz"]);
    resetBlocklist();
    expect(isDisposableEmail("user@mailinator.com")).toBe(true);
    expect(isDisposableEmail("user@myfakecustom.xyz")).toBe(false);
  });
});
