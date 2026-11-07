# Content Engine MVP

Local Cursor project for **ACR food IG** test: generate tweet-card carousels → queue → VPS publish.

## Start here (2–3 day sprint)

Read: [../docs/10-SPRINT-2-3-DAYS.md](../docs/10-SPRINT-2-3-DAYS.md)

## Day 1 commands

```bash
cd mvp
# use Node 20+ (nvm). This repo has .nvmrc → 22
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
nvm use   # or: nvm install
npm install
npx playwright install chromium
# edit clients/acr/profile.json (handle, wa.me, optional assets/profile.jpg)
npm run render:sample
# open queue/acr/<today>/carousel/ and check PNGs
# fill VPS_PUBLISH.md then rsync + post once
```

**Note:** System Node may still be v18 (`/usr/bin/node`). Always `nvm use` in new terminals before npm/playwright.
## Telugu copy (no ChatGPT switch)

Skill: **telugu-ig-copy** (personal + project).

In Cursor chat:
```text
Use telugu-ig-copy. Refine clients/acr/sample-carousel.json — spoken Andhra Telugu, keep MENU.
```

Or open `prompts/refine-telugu.md` and ask the agent to follow it.
