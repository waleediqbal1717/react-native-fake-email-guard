# react-native-fake-email-guard

[![npm version](https://img.shields.io/npm/v/react-native-fake-email-guard)](https://www.npmjs.com/package/react-native-fake-email-guard)
[![npm downloads](https://img.shields.io/npm/dm/react-native-fake-email-guard)](https://www.npmjs.com/package/react-native-fake-email-guard)
[![license](https://img.shields.io/npm/l/react-native-fake-email-guard)](./LICENSE)

Lightweight, zero-dependency library to detect disposable and temporary email addresses. Works in **React Native**, **React**, and any JavaScript/TypeScript environment.

Bundles a curated blocklist of **500+ known disposable email providers** (mailinator, tempmail, guerrillamail, yopmail, 10minutemail, trashmail, and hundreds more) — **no network requests, works fully offline**.

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
- **No network requests** — detection is 100% offline
- Blocklist changes via `addBlockedDomains` / `removeBlockedDomains` persist for the lifetime of the module
- Fully typed — ships with TypeScript definitions out of the box

---

## License

MIT
