# Use a Node.js Proxy to Capture Claude Code's System Prompt

This document explains how to intercept Claude Code's HTTPS requests with a local Node.js proxy and extract the hidden system prompt from the request body.

# Method Overview

Claude Code supports a custom request endpoint. Point it to a local Node.js proxy to intercept all requests.

1. Start the Node.js proxy service.

2. Configure Claude Code to send network requests through the proxy.

```python
# Edit or create the Claude Code config file `~/.claude/settings.json`
# Add or update the `env` field
# Replace `your_zhipu_api_key` with the API key you obtained earlier
{
    "env": {
        "ANTHROPIC_AUTH_TOKEN": "your_zhipu_api_key",
        "ANTHROPIC_BASE_URL": "http://localhost:8787/anthropic",
        "API_TIMEOUT_MS": "3000000",
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": 1
    }
}
```

## Compliance and Security

- This method is for research and educational purposes only. Follow applicable terms of service and laws.
- Keep captured data local; avoid leaking or including sensitive information.
