# Push this repo to GitHub (when you're back)

Everything is committed locally (`git log` shows all commits on `master`) and
already backed up two ways — OneDrive cloud sync of the folder, and a full-
history bundle at `OneDrive/yewogen-derash-backup.bundle`. GitHub just adds a
third, off-machine copy. It needs **your** GitHub login, which is why it wasn't
done automatically.

## Option A — GitHub CLI (easiest)

GitHub CLI (`gh`) was being installed. Confirm it's there, then:

```bash
gh --version                     # if "not found", reopen the terminal first
gh auth login                    # choose: GitHub.com → HTTPS → login with browser
gh repo create yewogen-derash --private --source . --remote origin --push
```

That one `repo create` line makes the private repo **and** pushes every commit.

## Option B — you already made an empty repo on github.com

```bash
git remote add origin https://github.com/<your-username>/yewogen-derash.git
git push -u origin master
```

When the browser/credential prompt appears, log in once — Windows stores it for
next time.

## Option C — hand me a token and I'll push for you

Create a token at <https://github.com/settings/tokens?type=beta> (Fine-grained →
repo access → *Contents: Read and write*), paste it in chat, and I'll create the
repo and push in one go. (Revoke it afterwards if you like.)

---

Keep it **private** — the repo contains the full business logic. Your secrets
are safe either way: `.env` is gitignored and has never been committed (only
`.env.example` with placeholders is tracked).
