# gh-delete

A mobile-first bulk GitHub repository console. Sign in with GitHub, then pin, unpin, transfer, or permanently delete up to 50 owned repositories in a batch.

## Create the GitHub App

The GitHub App Manifest flow needs one GitHub browser approval, then `gh` converts the returned one-time code into credentials.

1. Open <https://gh-delete.vercel.app/github-app.html> and approve the manifest on GitHub.
2. After GitHub redirects back, copy the code displayed and run:

```bash
scripts/convert-github-app.sh CODE
```

3. Add the resulting `client_id` and `client_secret` from `app-credentials.json` to Vercel as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`; set `APP_URL` to `https://gh-delete.vercel.app`.
4. For local development, copy `.env.example` to `.env`, add the values, then load it into your shell:

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
