# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 2.x     | ✅ Yes    |
| < 2.0   | ❌ No     |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email details to the maintainers via the [GitHub Security Advisories](https://github.com/kamransethi/gpt-ai-markdown-editor/security/advisories) page
3. Include steps to reproduce and potential impact

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Scope

This extension runs inside VS Code's webview sandbox. Key security considerations:

- **File access**: Limited to files the user explicitly opens
- **Network**: No telemetry or external network calls
- **Data**: All data stays local — no cloud services
- **CSP**: Webview uses a strict Content Security Policy with nonces
