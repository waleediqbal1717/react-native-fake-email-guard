# react-native-fake-email-guard

[![npm version](https://img.shields.io/npm/v/react-native-fake-email-guard)](https://www.npmjs.com/package/react-native-fake-email-guard)
[![npm downloads](https://img.shields.io/npm/dm/react-native-fake-email-guard)](https://www.npmjs.com/package/react-native-fake-email-guard)
[![license](https://img.shields.io/npm/l/react-native-fake-email-guard)](./LICENSE)

Lightweight, zero-dependency library to detect disposable and temporary email addresses. Works in **React Native**, **React**, and any JavaScript/TypeScript environment.

Bundles a blocklist of **64,000+ known disposable email providers** (mailinator, tempmail, guerrillamail, yopmail, 10minutemail, trashmail, and tens of thousands more) — **no network requests, works fully offline**. The list merges a hand-curated set with four community-maintained sources ([disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains), [disposable/disposable-email-domains](https://github.com/disposable/disposable-email-domains), [mailchecker](https://github.com/FGRibreau/mailchecker), [fakefilter](https://github.com/7c/fakefilter)), keeping a domain only when at least two of them agree on it. Run `npm run update-domains` to refresh it.

---

## Installation

```sh
npm install react-native-fake-email-guard
# or
yarn add react-native-fake-email-guard
```

---

## Usage

### Basic check

```ts
import { isDisposableEmail, isFakeEmail, isValidEmail } from "react-native-fake-email-guard";

isDisposableEmail("user@mailinator.com");  // true
isDisposableEmail("user@gmail.com");       // false

isFakeEmail("user@tempmail.com");          // true  (alias)

isValidEmail("user@gmail.com");            // true  (format + not disposable)
isValidEmail("user@trashmail.me");         // false
isValidEmail("notanemail");                // false
```

### Detailed result

```ts
import { checkEmail } from "react-native-fake-email-guard";

const result = checkEmail("test@mailinator.com");
// {
//   email: "test@mailinator.com",
//   domain: "mailinator.com",
//   isDisposable: true
// }
```

### Custom blocklist management

```ts
import { addBlockedDomains, removeBlockedDomains, resetBlocklist } from "react-native-fake-email-guard";

// Block additional domains specific to your use case
addBlockedDomains(["mycustomspam.io", "anotherfake.net"]);

// Whitelist a domain that's in the default blocklist
removeBlockedDomains(["mailinator.com"]);

// Restore the original default blocklist
resetBlocklist();
```

### Keeping up with rotating domains

Disposable-mail services (temp-mail.org and similar) constantly register new
domains and drop old ones — often faster than any bundled list, or an app
release, can track. Both options below are opt-in: nothing in this package
makes a network request unless you call one of them.

#### Set and forget: `enableAutoSync`

Call this once, e.g. in your app's entry file. It syncs immediately, then
again on a timer, for as long as the app runs — nobody has to remember to
call anything again, and newly-rotated domains show up without an app update:

```ts
import { enableAutoSync } from "react-native-fake-email-guard";
import AsyncStorage from "@react-native-async-storage/async-storage";

useEffect(() => {
  const stop = enableAutoSync({
    // Optional: persist the last-synced time so a cold app restart doesn't
    // re-download the list if it already synced recently. Without this,
    // every cold start syncs once (still cheap, but avoidable).
    storage: AsyncStorage,
    intervalMs: 24 * 60 * 60 * 1000, // default: once a day
    onSync: ({ added, total }) => console.log(`+${added} new domains, ${total} total`),
    onError: (err) => console.warn("blocklist sync failed, using cached list:", err),
  });
  return stop; // stop the background refresh on unmount, if desired
}, []);
```

#### Manual control: `syncBlocklist`

The lower-level primitive `enableAutoSync` is built on. Use it directly if you
want to decide exactly when a sync happens instead of a recurring timer:

```ts
import { syncBlocklist } from "react-native-fake-email-guard";

try {
  const { added, total } = await syncBlocklist();
  console.log(`Synced blocklist: +${added} new domains, ${total} total`);
} catch (err) {
  // Network failed, or no `fetch` in this environment — the bundled
  // blocklist is still in effect either way, so this is safe to ignore/log.
  console.warn("syncBlocklist failed, falling back to the bundled list:", err);
}
```

Both default to fetching this package's own list, refreshed weekly:
https://github.com/waleediqbal1717/react-native-fake-email-guard/blob/main/data/disposable-domains.txt
— pass `url` to either one to point at your own list instead.

---

## React Native Example

```tsx
import React, { useState } from "react";
import { TextInput, Text, View, StyleSheet } from "react-native";
import { isDisposableEmail } from "react-native-fake-email-guard";

export function EmailInput() {
  const [email, setEmail] = useState("");
  const isInvalid = email.length > 0 && isDisposableEmail(email);

  return (
    <View>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Enter your email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={[styles.input, isInvalid && styles.inputError]}
      />
      {isInvalid && (
        <Text style={styles.errorText}>
          Temporary email addresses are not allowed.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
  },
  inputError: {
    borderColor: "#e53e3e",
  },
  errorText: {
    color: "#e53e3e",
    fontSize: 12,
    marginTop: 4,
  },
});
```

---

## API

| Function | Signature | Description |
|---|---|---|
| `isDisposableEmail` | `(email: string) => boolean` | Returns `true` if the domain is a known disposable provider |
| `isFakeEmail` | `(email: string) => boolean` | Alias for `isDisposableEmail` |
| `isValidEmail` | `(email: string) => boolean` | Returns `true` if the email is well-formed AND not disposable |
| `checkEmail` | `(email: string) => EmailCheckResult` | Returns a detailed result object |
| `addBlockedDomains` | `(domains: string[]) => void` | Add custom domains to the blocklist |
| `removeBlockedDomains` | `(domains: string[]) => void` | Remove domains from the blocklist (whitelist) |
| `getBlockedDomains` | `() => string[]` | Returns all currently blocked domains |
| `resetBlocklist` | `() => void` | Resets to the built-in default blocklist |
| `syncBlocklist` | `(options?: { url?: string; fetchFn?: FetchLike }) => Promise<{ added: number; total: number }>` | Opt-in: fetches a fresh domain list once and merges it in |
| `enableAutoSync` | `(options?: AutoSyncOptions) => () => void` | Opt-in: syncs immediately and on a recurring timer for as long as the app runs; returns a function to stop it |

### `EmailCheckResult` type

```ts
interface EmailCheckResult {
  email: string;
  domain: string;
  isDisposable: boolean;
}
```

---

## Notes

- All comparisons are **case-insensitive**
- **No network requests by default** — detection is 100% offline unless you explicitly call `syncBlocklist`
- Blocklist changes via `addBlockedDomains` / `removeBlockedDomains` persist for the lifetime of the module
- Fully typed — ships with TypeScript definitions out of the box

---

## License

MIT
