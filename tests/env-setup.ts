// Imported for its side effect, and it must come before any lib/ import:
// lib/env.ts reads process.env at module scope, so an assignment inside a test
// body runs too late (ESM evaluates imports first).
//
// This exists so the npm scripts don't need `VAR=value cmd` prefixes, which are
// bash syntax — npm runs scripts through cmd.exe on Windows, where the prefix
// form fails with "'SITE_URL' is not recognized as an internal or external
// command". Overridable from the real environment via ??=.
process.env.SITE_URL ??= "https://rolesharp.com";
