# gh-delete

A mobile-first bulk GitHub repository console. Sign in with GitHub, then pin, unpin, transfer, or permanently delete up to 50 owned repositories in a batch.

## Create the GitHub OAuth app

GitHub does not expose OAuth-app registration through `gh`; it must be created once in the GitHub UI:

1. Open <https://github.com/settings/developers> → **New OAuth App**.
2. Set Homepage URL to `http://localhost:3000` and callback URL to `http://localhost:3000/auth/callback` (replace both with your deployed URL in production).
3. Copy its client ID and generate a client secret.
4. Copy `.env.example` to `.env`, add the values, then load it into your shell:

```bash
set -a; source .env; set +a
npm start
```

The requested scopes are `repo` and `read:org`. Tokens and sessions are held only in server memory and expire after eight hours. Use HTTPS and a shared encrypted session store before deploying more than one instance.

## GitHub CLI

This project was created as a GitHub repository with the GitHub CLI. To create/push your own private remote after authenticating with `gh auth login`:

```bash
npm run create:repo
```

## Safety behavior

- Only repositories returned by GitHub's `affiliation=owner` listing appear.
- Delete requires typing `DELETE`; GitHub deletion is irreversible.
- Transfer must be accepted by the destination where GitHub requires it.
- Each batch is executed serially and returns an item-by-item result, so a failure does not stop unrelated repositories.
