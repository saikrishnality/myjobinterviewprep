# Job Interview Prep
## Deployment Guide — Render.com (Free, No Timeout)

---

### File Structure
```
jobinterviewprep-render/
  public/
    index.html      ← Frontend
  server.js         ← Express server (handles /generate route)
  package.json      ← Dependencies
  README.md         ← This file
```

---

### Why Render instead of Vercel or Netlify?
Both Vercel and Netlify free tiers have a 10-second timeout on backend functions.
Claude takes 20-30 seconds to generate a brief.
Render runs a persistent server — no timeout limit. Free tier.

---

### Step 1 — Push to GitHub
Your files need to be in a GitHub repository.

Option A — Update your existing myjobinterviewprep repo:
1. Go to github.com/saikrishnality/myjobinterviewprep
2. Delete all existing files
3. Upload the three items from this folder:
   - server.js
   - package.json
   - public/ folder (containing index.html)

Option B — Create a new repository called jobinterviewprep-render
and upload these files there.

---

### Step 2 — Create a Render account
Go to https://render.com and sign up free.
Use GitHub login — easiest.

---

### Step 3 — Create a new Web Service
1. Click "New +" in the top right
2. Select "Web Service"
3. Connect your GitHub account if prompted
4. Find and select your repository
5. Click "Connect"

---

### Step 4 — Configure the service
Fill in these settings exactly:

Name:             jobinterviewprep
Region:           Singapore (closest to India)
Branch:           main
Runtime:          Node
Build Command:    npm install
Start Command:    node server.js
Instance Type:    Free

Leave everything else as default.

---

### Step 5 — Add your API key
Before clicking Deploy, scroll down to "Environment Variables".
Click "Add Environment Variable":
  Key:    ANTHROPIC_API_KEY
  Value:  your Claude API key (starts with sk-ant-)

Click "Add".

---

### Step 6 — Deploy
Click "Create Web Service".
Render will install dependencies and start your server.
Takes about 2-3 minutes.

---

### Step 7 — Get your URL
Once deployed you will see:
https://jobinterviewprep.onrender.com
(or similar — Render generates the subdomain from your service name)

Open it on your phone and test.

---

### Important — Cold Start
Render free tier sleeps after 15 minutes of inactivity.
First request after sleep takes 30-50 seconds to wake up.
All requests after that are instant.
For beta with 5 users this is acceptable.

---

### Updating the tool
Push changes to GitHub → Render auto-deploys within 2 minutes.

---

Built by Sai Krishna Yallapu · GTM Signal
saikrishnality@gmail.com · linkedin.com/in/saikrishnality
