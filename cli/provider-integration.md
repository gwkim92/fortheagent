# forTheAgent Provider Integration

## Purpose

This document covers provider-oriented behavior inside the `fortheagent`
session.

These features are not the product definition. The product definition is still
the shared foundation bootstrap described in [`README.md`](./README.md). The
features here are extensions that may be layered on top of that core flow.

## Extension Scope

Provider integration may add:

- provider selection
- local provider detection
- login and logout flows
- OAuth-based authentication
- API key-based authentication
- session startup after foundation setup

Provider integration must not change:

- the repository contract
- the generated file set
- the manifest schema for foundation selection
- the behavior of `init`, `sync`, and `doctor`

## Supported Providers

The launcher currently supports:

- `codex-local`
- `claude-local`
- `openai-api`
- `anthropic-api`
- `hosted-oauth`

## Extended Flow

Provider-backed flow:

1. User launches `fortheagent`.
2. User asks for work directly, or hints a provider directly.
3. The launcher checks repository readiness.
4. If the repo is missing or unresolved, the launcher runs Guided Setup first.
5. The launcher routes any built-in workflow locally.
6. When an AI-backed turn is required, the launcher chooses or confirms the target provider.
7. If the provider is not configured, the launcher runs inline login.
8. The launcher builds provider-specific startup context from the resolved repo.
9. The launcher sends the turn through the selected provider backend.

This is an extension path after repository setup, not a replacement for it.

## Authentication Model

Support multiple authentication strategies, but keep secrets outside the
repository.

Rules:

- never write tokens or API keys into project files
- prefer OS keychain when available and fall back to secure local config storage
- keep provider config outside Git-tracked paths
- require explicit user action before remote login flows

Current implementation:

1. local adapters reuse installed provider CLIs
2. `openai-api` and `anthropic-api` use API keys
3. `hosted-oauth` uses auth code + PKCE + refresh tokens against an
   OpenAI-compatible chat endpoint
4. secrets prefer OS keychain when available and fall back to the secure local
   store

## Provider Session Contract

The launcher generates a normalized startup payload for each adapter:

- selected project profile
- manifest values
- relevant document paths
- startup instructions
- optional user prompt

The adapter then decides how to pass that payload into the real provider
session.

## Risks

- provider APIs and session models will diverge
- OAuth adds real product and security complexity
- session startup features can overshadow the bootstrap product if they are not
  kept clearly separate

## Recommendation

Treat provider integration as an extension layer that stays outside the bootstrap
contract. The repository contract is still driven by the same manifest,
templates, and docs as the npm form.
