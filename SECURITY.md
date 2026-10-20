# Security policy

SafeSend is under development. No production security certification or independent audit is claimed. See [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) for the implementation's security boundaries and known limitations.

## Report a vulnerability

If GitHub displays **Report a vulnerability** in this repository's Security tab, use that private reporting channel. Its availability depends on repository settings; this document does not imply that it has been enabled.

If private reporting is unavailable, open a minimal issue asking the maintainer to establish a private channel. Do not include exploit instructions, working credentials, personal data, or details that expose other users until a private channel is available. No dedicated security email or response-time commitment is currently published.

A private report should describe the affected component or commit, likely impact, and reproduction steps using disposable test data. Redact API keys, database credentials, access passwords, management tokens, and complete share links.

## Scope and handling

Review is focused on the current development code. There is no published supported-release matrix or guaranteed patch schedule. Test only against environments and data you are authorized to use; do not access another person's secrets or test third-party deployments without permission.

An exposed credential should be revoked or rotated through the affected service. Removing it from a file alone does not invalidate it or remove it from Git history.
