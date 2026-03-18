# Job Interview Prep
## Deployment Guide — Vercel (Free, 60-second timeout)

---

### File Structure
```
jobinterviewprep-vercel/
  api/
    generate.js     ← Serverless function (Claude API call, 60s timeout)
  index.html        ← Frontend
  vercel.json       ← Routing + timeout config
  README.md         ← This file
```

---

### Step 1 — Create a Vercel Account
Go to https://vercel.com and sign up. Use GitHub or Google — either works. Free.

---

### Step 2 — Deploy

1. Go to https://vercel.com/new
2. Click "Browse" or drag the jobinterviewprep-vercel folder
3. Click Deploy
4. Wait ~30 seconds

---

### Step 3 — Set Your API Key (CRITICAL)

1. Go to your project in Vercel dashboard
2. Click Settings → Environment Variables
3. Click Add
   - Name:   ANTHROPIC_API_KEY
   - Value:  your Claude API key (starts with sk-ant-)
   - Check all three environments: Production, Preview, Development
4. Click Save

---

### Step 4 — Redeploy to activate the key

1. Click Deployments in the left menu
2. Click the three dots next to your latest deployment
3. Click Redeploy
4. Wait ~30 seconds

---

### Step 5 — Set a clean URL

1. Go to Settings → Domains
2. Your default URL is something like jobinterviewprep-vercel.vercel.app
3. You can customise the subdomain here for free

---

### Step 6 — Test

Open your URL on mobile, upload your CV, enter a company name, click Generate.
Brief should appear in 20-30 seconds. No timeout errors on Vercel free tier.

---

### Why Vercel instead of Netlify?
Vercel free tier allows 60-second function timeout.
Netlify free tier only allows 10 seconds.
Claude takes 20-30 seconds. Netlify times out. Vercel does not.

---

Built by Sai Krishna Yallapu · GTM Signal
saikrishnality@gmail.com · linkedin.com/in/saikrishnality
