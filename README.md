# Guardrail Admin Frontend

SolidStart frontend for the Guardrail backend.

## API structure

The backend integrations are now grouped under `src/lib` in the same style as `guardrailfrontend`:

```text
src/lib
├── api.ts
├── types.ts
├── index.ts
├── admin
│   ├── admin.ts
│   ├── index.ts
│   ├── session.ts
│   └── types.ts
├── asset
│   ├── asset.ts
│   ├── index.ts
│   └── types.ts
├── auth
│   ├── auth.ts
│   ├── index.ts
│   ├── session.ts
│   └── types.ts
├── compliance
│   ├── compliance.ts
│   ├── index.ts
│   └── types.ts
├── faucet
│   ├── faucet.ts
│   ├── index.ts
│   └── types.ts
├── health
│   ├── health.ts
│   ├── index.ts
│   └── types.ts
├── oracle
│   ├── index.ts
│   ├── oracle.ts
│   └── types.ts
└── treasury
    ├── index.ts
    ├── treasury.ts
    └── types.ts
```

Each domain client contains:

- public endpoints that do not require admin auth
- token-required endpoints for admin or authenticated user actions
- a `create*Client()` factory and a default singleton client

## Develop

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```
