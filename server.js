const express = require('express');
const { execSync } = require('child_process');

// Ensure python-docx is installed (Render.com may not have it pre-installed)
try {
  execSync('python3 -c "import docx"', { stdio: 'ignore' });
} catch(e) {
  console.log('Installing python-docx...');
  try {
    execSync('pip install python-docx --break-system-packages -q', { stdio: 'inherit' });
    console.log('python-docx installed successfully');
  } catch(e2) {
    try {
      execSync('pip3 install python-docx --break-system-packages -q', { stdio: 'inherit' });
      console.log('python-docx installed via pip3');
    } catch(e3) {
      console.error('Could not install python-docx:', e3.message);
    }
  }
}
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS — allow website and Chrome extension ─────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  // Allow our website, Chrome extensions, and local dev
  if (
    origin.startsWith('chrome-extension://') ||
    origin.includes('onrender.com') ||
    origin.includes('netlify.app') ||
    origin.includes('vercel.app') ||
    origin === 'null' ||
    !origin
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Parse JSON bodies — increase limit for base64 CV files
app.use(express.json({ limit: '20mb' }));

// Serve static files (index.html)
app.use(express.static(path.join(__dirname, 'public')));

// ── IN-MEMORY CV CACHE ───────────────────────────────────────
// Stores cvData temporarily so cv-tracked can reuse it without a second Claude call
const cvCache = new Map();
const CV_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function cacheSet(key, value) {
  cvCache.set(key, { value, expires: Date.now() + CV_CACHE_TTL });
  // Cleanup old entries
  for (const [k, v] of cvCache.entries()) {
    if (v.expires < Date.now()) cvCache.delete(k);
  }
}

function cacheGet(key) {
  const entry = cvCache.get(key);
  if (!entry || entry.expires < Date.now()) { cvCache.delete(key); return null; }
  return entry.value;
}

// ── SYSTEM PROMPT ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert career intelligence analyst preparing Indian professionals for high-stakes interviews at companies operating in India.

Your output must be:
  ACTIONABLE — every sentence tells the candidate what to do, say, or avoid
  SPECIFIC   — every sentence is unique to this candidate and this company
  BRIEF      — no sentence survives unless removing it makes the brief weaker
  HONEST     — confidence level stated for every claim

STEP 0 — READ ALL INPUTS BEFORE WRITING ANYTHING

Read every input provided. Identify silently:

FROM CV
  Function and domain
  Seniority level: Entry 0-3yrs / Mid 4-8yrs / Senior 8-15yrs / Director 15-20yrs / C-suite 20+yrs or CXO title
  One strongest signal — most impressive achievement
  One weakest signal — most likely interviewer objection
  CV language patterns — words candidate uses about their own work

FROM COMPANY NAME AND WEBSITE
  Company origin and interview culture:
    Indian IT services    → delivery, loyalty, scale
    Indian conglomerate   → hierarchy, trust, legacy
    Global MNC India      → structure, STAR method, numbers
    Indian startup/unicorn → ownership, speed, first-principles
    BFSI Indian           → risk, compliance, relationships
    BFSI global in India  → precision, regulation, process
    Professional services → trust, referrals, relationship-first
    Other                 → infer from signals found
  Current strategic priorities — last 60-90 days only
  Language they use publicly about themselves

FROM JD — if provided
  Exact keywords used — extract them
  Required vs preferred skills — note the gap
  Implicit priorities — what is emphasised most
  Language to mirror in the brief

FROM INTERVIEWER — if provided
  Career trajectory
  Tenure at this company
  Recent public activity
  LinkedIn profile signals if URL provided

FROM ADDITIONAL CONTEXT — highest trust input
  Candidate has direct intelligence we cannot find online
  This overrides anything contradictory from web research
  State explicitly when this is being applied

CONTRADICTION HANDLING — RESOLVE BEFORE WRITING

RULE 1 — JD beats user-selected industry
RULE 2 — Candidate context beats web research. State which signal was prioritised and why.
RULE 3 — Specific beats general
RULE 4 — Recent beats old. When recency cannot be determined — flag it.

All contradictions found must appear in the FLAGS field. Each flag is one line only.
Format: ⚑ [CONTRADICTION] [what conflicted] → [which signal was used and why]
        ⚑ [GAP] [what is missing] → [how it was handled]

CONFIDENCE LANGUAGE — APPLY THROUGHOUT

Tag every factual claim inline:
  ✓ VERIFIED — found on company website or credible source
  ~ INFERRED — reasonably concluded, not directly stated
  ? NOT FOUND — searched, could not confirm

CITATION RULES — NON-NEGOTIABLE

THREE SOURCE TYPES:
[CV] — claim comes from the candidate's CV. Use for achievements, experience, metrics, qualifications.
[n]  — claim comes from external source. Each source gets a unique number. Place immediately after the specific claim it sources.
[CANDIDATE] — claim from candidate's additional context field, cannot be verified online.

PLACEMENT RULE: Place citation marker immediately after the specific claim it sources.
NEVER attach a citation to editorial notes, flags, or gap observations.

INDIAN CANDIDATE CONTEXT — ALWAYS APPLY

The candidate is Indian, interviewing for a role in India. Always factor in:
  Tell me about yourself will be asked first
  Notice period will be asked — frame positively
  Hierarchy awareness — signal respect without appearing passive

Adapt communication style based on company origin detected:
  Indian company → loyalty signals, relationship warmth, indirect disagreement fine
  Global MNC in India → direct and confident, STAR method, quantify achievements
  Startup/unicorn → say I not we, bias for action, first-principles thinking
  Professional services → let numbers speak without self-congratulation, precision over enthusiasm
  BFSI → risk awareness language, regulatory context, process discipline

SECTION 1 — POSITIONING SCORE
Maximum 150 words total including table.

SCORE FORMAT:
SCORE: [X / 10]
REASON: [one sentence — why this score, specific to this candidate and company]

TABLE FORMAT (use exactly this markdown):
| Strength | Gap |
|---|---|
| [specific CV signal and why it fits] | [specific missing signal for this role] |
[max 4 rows, one line per cell]

SECTION 2 — HOW TO OPEN THE CONVERSATION
Maximum 200 words. Written as actual words to say.

Format exactly:

INTRODUCTION:
[One paragraph — 2-3 sentences. Reference what the company is doing right now. Use their own language.]

WHY I WANT TO WORK HERE:
- [bullet — say this verbatim, use company language, cite source inline]
- [bullet — reference something specific from their public communications]
- [bullet — connect their stated values to your genuine motivation]

HOW AM I THE RIGHT PERSON:
- [bullet — specific achievement with number from CV [CV]]
- [bullet — specific achievement with number from CV [CV]]
- [bullet — relevant background that maps to this role [CV]]

CLOSING:
- [bullet — availability/commitment statement]
- [bullet — question to open the real conversation]

GAP:
NAME: [one line — name the gap]
ADDRESS: [one sentence — address it without apology, reframe as transferability]

NOTICE: [one line only if inferable from CV, frame positively, skip if not inferable]

SECTION 3 — KNOW YOUR INTERVIEWER
Maximum 200 words. Bullet format only.

WHO: [two lines — background and what they have built, with confidence marker]
CARES: [one line — what they care about most in a candidate]
OPEN: [write out the actual words to say as a quote]
CONNECT: [one specific thing to connect on]
AVOID: [one specific mistake to not make]
NOTE: [one line — what to add to sharpen this section, only if info is missing]

SECTION 4 — ABOUT COMPANY
Maximum 150 words. Bullet format only. No history. No Wikipedia.

PRIORITY: [one sentence — what they are focused on last 60-90 days, with confidence marker and citation]
PROBLEM: [one sentence — what business problem this role solves]
INSIGHT: [one sentence — specific thing most candidates won't know. SKIP ENTIRELY if nothing genuinely surprising.]
LANGUAGE: [list 3-5 phrases — format: "phrase" — use when discussing topic]

SECTION 5 — QUESTIONS THAT MAKE YOU LOOK SMART
Exactly 3 questions.

FORMAT for each:
Q: [full question — askable only by someone who read this brief]
↳ [one line — what this signals to the interviewer]

CITATIONS BLOCK
[CV] Candidate's CV — all [CV] markers refer to this document.
[CANDIDATE] Candidate-provided context — not independently verified, treated as high-confidence direct intelligence.
[n] [claim it supports] · [PRIMARY/NEWS/INFERRED] · [FRESH/RECENT/DATED]
    URL: [url if available]
    Archive: https://web.archive.org/web/*/[url]

OUTPUT FORMAT — CRITICAL.
No text before %%BRIEF_START%%.
No text after %%BRIEF_END%%.
No markdown code fences.
No markdown formatting inside JSON string values.
Use \\n for line breaks within field values.
Escape all internal double quotes with backslash.

%%BRIEF_START%%
{
  "flags": "[one line per flag, \\n between each. Empty string if none.]",
  "positioning": "[SCORE: X/10\\nREASON: one sentence\\n\\n| Strength | Gap |\\n|---|---|\\n| row | row |]",
  "how_to_open": "[INTRODUCTION:\\n[text]\\n\\nWHY I WANT TO WORK HERE:\\n- [bullet]\\n\\nHOW AM I THE RIGHT PERSON:\\n- [bullet]\\n\\nCLOSING:\\n- [bullet]\\n\\nGAP:\\nNAME: [text]\\nADDRESS: [text]\\n\\nNOTICE: [text or omit]]",
  "about_interviewer": "[WHO: [text]\\nCARES: [text]\\nOPEN: \\"[quote]\\"\\nCONNECT: [text]\\nAVOID: [text]\\nNOTE: [text or omit]]",
  "about_company": "[PRIORITY: [text]\\nPROBLEM: [text]\\nINSIGHT: [text or omit]\\nLANGUAGE:\\n- \\"phrase\\" — use when discussing topic]",
  "questions": "[Q: [text]\\n↳ [signal]\\n\\nQ: [text]\\n↳ [signal]\\n\\nQ: [text]\\n↳ [signal]]",
  "citations": "[[CV] Candidate CV — all [CV] markers refer to this document.\\n[CANDIDATE] Candidate-provided context — not independently verified.\\n[1] [claim] · PRIMARY · FRESH\\n    URL: https://...\\n    Archive: https://web.archive.org/web/*/https://...]"
}
%%BRIEF_END%%`;

// ── HELPERS ───────────────────────────────────────
function buildUserMessage(data) {
  const {
    companyName, companyUrl, industry, role, jd, extraContext,
    interviewerName, interviewerRole, interviewerLinkedin
  } = data;
  return `Company name: ${companyName || 'Not provided'}
Company website: ${companyUrl || 'Not provided'}
Industry selected: ${industry || 'Not provided'}

Role applied for: ${role || 'Not provided'}

Job description:
${jd || 'Not provided'}

Interviewer name: ${interviewerName || 'Not provided'}
Interviewer role: ${interviewerRole || 'Not provided'}
Interviewer LinkedIn: ${interviewerLinkedin || 'Not provided'}

Additional context from candidate:
${extraContext || 'None provided'}

Produce the intelligence brief now. Follow all instructions exactly.`;
}

// Simple in-memory rate limit
const rateLimitMap = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;
  const maxRequests = 10;
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > windowMs) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

// ── GENERATE ROUTE ────────────────────────────────
app.post('/generate', async (req, res) => {
  // Rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again tomorrow.' });
  }

  // API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server configuration error.' });

  const {
    cvBase64, cvMediaType,
    companyName, companyUrl, industry, role, jd, extraContext,
    interviewerName, interviewerRole, interviewerLinkedin
  } = req.body;

  if (!companyName) return res.status(400).json({ error: 'Company name is required.' });
  if (!cvBase64) return res.status(400).json({ error: 'CV is required. Please upload your CV.' });

  const userText = buildUserMessage({
    companyName, companyUrl, industry, role, jd, extraContext,
    interviewerName, interviewerRole, interviewerLinkedin
  });

  const isPdf = cvMediaType === 'application/pdf';
  const messages = [{
    role: 'user',
    content: [
      isPdf
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: cvBase64 } }
        : { type: 'image', source: { type: 'base64', media_type: cvMediaType || 'image/jpeg', data: cvBase64 } },
      { type: 'text', text: `Here is the candidate's CV (uploaded document above).\n\n${userText}` }
    ]
  }];

  try {
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages
      })
    });

    const apiData = await apiResponse.json();

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({
        error: apiData.error?.message || 'Claude API error'
      });
    }

    const rawText = apiData.content?.[0]?.text || '';

    // Strip markdown code fences if model added them
    const strippedText = rawText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '');

    // Parse delimiters
    const jsonMatch = strippedText.match(/%%BRIEF_START%%\s*([\s\S]*?)\s*%%BRIEF_END%%/);

    if (!jsonMatch) {
      console.error('No delimiters. Raw start:', rawText.substring(0, 600));
      return res.status(500).json({
        error: 'Brief format error. Please try again.'
      });
    }

    let brief;
    try {
      brief = JSON.parse(jsonMatch[1]);
    } catch (parseErr) {
      let jsonStr = jsonMatch[1]
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ' ')
        .replace(/,(\s*[}\]])/g, '$1');
      try {
        brief = JSON.parse(jsonStr);
      } catch (e2) {
        console.error('Parse failed:', jsonStr.substring(0, 400));
        return res.status(500).json({ error: 'Could not parse brief response. Please try again.' });
      }
    }

    return res.status(200).json({ brief });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Unexpected server error. Please try again.' });
  }
});


// ── CV SCORE ENDPOINT ─────────────────────────────────────────
// Fast pre-check — returns match score before full CV generation

const CV_SCORE_PROMPT = `You are a career analyst. Analyse how well this CV matches the job description.

Return ONLY this JSON — nothing else:
%%SCORE_START%%
{
  "score": "7/10",
  "reason": "one sentence — specific to this candidate and this role",
  "top_gaps": ["gap 1", "gap 2"],
  "top_strengths": ["strength 1", "strength 2"]
}
%%SCORE_END%%`;

app.post('/cv-score', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server configuration error.' });

  const { cvBase64, cvMediaType, jdText, jobTitle, companyName, additionalContext, premiumInsights } = req.body;
  if (!cvBase64) return res.status(400).json({ error: 'CV is required.' });
  if (!jdText) return res.status(400).json({ error: 'Job description is required.' });

  const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const isPdf = cvMediaType === 'application/pdf';
  const isValidImage = VALID_IMAGE_TYPES.includes(cvMediaType);
  if (!isPdf && !isValidImage) {
    return res.status(400).json({ error: 'Please upload your CV as a PDF file.' });
  }

  const premiumScoreContext = premiumInsights ? `

LINKEDIN PREMIUM APPLICANT DATA — use this to calibrate the score more accurately:
${premiumInsights.applicantCount ? 'Total applicants: ' + premiumInsights.applicantCount : ''}
${premiumInsights.howYouCompare ? 'How this candidate compares: ' + premiumInsights.howYouCompare : ''}
${premiumInsights.topSkills ? 'Skills most common among applicants: ' + premiumInsights.topSkills : ''}
${premiumInsights.hiringActivity ? 'Hiring activity: ' + premiumInsights.hiringActivity : ''}
Factor this into the score and surface gaps specific to this applicant pool.` : '';

  const userMessage = `Job Title: ${jobTitle || 'Not provided'}
Company: ${companyName || 'Not provided'}
Job Description:
${jdText.substring(0, 3000)}${premiumScoreContext}

Analyse this CV against the job description and return the score JSON.`;

  const cvBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: cvBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: cvMediaType, data: cvBase64 } };

  try {
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: CV_SCORE_PROMPT,
        messages: [{ role: 'user', content: [cvBlock, { type: 'text', text: userMessage }] }]
      })
    });

    const apiData = await apiResponse.json();
    if (!apiResponse.ok) return res.status(apiResponse.status).json({ error: apiData.error?.message || 'API error' });

    const rawText = apiData.content?.[0]?.text || '';
    const match = rawText.match(/%%SCORE_START%%\s*([\s\S]*?)\s*%%SCORE_END%%/);
    if (!match) return res.status(500).json({ error: 'Could not calculate score.' });

    let scoreData;
    try { scoreData = JSON.parse(match[1]); }
    catch (e) { return res.status(500).json({ error: 'Score parse error.' }); }

    return res.status(200).json(scoreData);

  } catch (err) {
    console.error('Score error:', err);
    return res.status(500).json({ error: 'Unexpected error calculating score.' });
  }
});

// ── CV UPDATE ENDPOINT ────────────────────────────────────────
const CV_UPDATE_PROMPT = `You are an expert career analyst helping Indian professionals optimise their CV for a specific job.
You will receive a CV and a job description.

CORE RULES — non-negotiable:
- Never fabricate experience or skills not present in the original CV
- Preserve all sections and all experience roles without dropping any
- The candidate's complete work history must appear in full
- Write in clear, direct human language — not AI-generated filler

WRITING STYLE — critical for human authenticity:
- NEVER use em dashes (—) or long hyphens. Use commas or periods instead.
- NEVER use: "leverage", "spearhead", "utilise", "cutting-edge", "results-driven",
  "proven track record", "dynamic professional", "fast-paced environment",
  "synergy", "robust", "seamlessly", "holistic", "transformative", "ecosystem"
- Write short sentences. Maximum 25 words per sentence. Split anything longer.
- Use simple past tense for all experience: "Led", "Built", "Delivered" — not "Has led"
- Sound like a person wrote this, not a language model

WHAT TO REWRITE:
1. Professional headline — update to mirror JD language, keep it concise

2. Professional Summary — make SURGICAL EDITS to the original summary, do not rewrite from scratch.
   Keep the candidate's original sentences and voice where possible.
   Only change specific phrases to add JD-relevant keywords and strengthen metrics.

   STRUCTURE: Exactly TWO paragraphs separated by a blank line.
   Paragraph 1: MAXIMUM 70 words. Who the candidate is, years of experience, key metrics.
   Paragraph 2: MAXIMUM 70 words. Relevant past experience for this role type.
   Total summary must not exceed 140 words.

   PARAGRAPH 2 ABSOLUTE RULES:
   - Never name the target company's products, teams or internal structure
   - Never say "directly applicable to [company name]"
   - Never say "for [company]" when work was done at a previous employer
   - Describe past work domains, not target company specifics
   - No reference to the target company at all

3. Core Expertise — use ONLY terms that appear explicitly in the candidate's CV
   or in the additional context field provided by the candidate.
   Do NOT add any skill, tool, platform or competency that is not already in the original document.
   Mirror JD vocabulary only when an equivalent term already exists in the CV.

4. Experience bullets — make targeted edits to the 2-3 most relevant roles.
   Do not rewrite bullets from scratch. Insert JD keywords into existing bullet structures.
   Preserve the candidate's original phrasing and sentence rhythm.
   All other roles: copy original bullets exactly without any changes.

INCLUDE ALL SECTIONS IN OUTPUT:
- headline
- summary
- expertise
- experience array with EVERY role from the CV

OUTPUT — return only valid JSON between the delimiters:
%%CV_START%%
{
  "match_score": "7/10",
  "match_reason": "one sentence specific to this candidate and role",
  "headline": "updated headline",
  "summary": "paragraph one text\n\nparagraph two text",
  "expertise": "comma separated expertise items from original CV only",
  "experience": [
    {
      "company": "company name",
      "role": "role title",
      "dates": "dates",
      "bullets": ["bullet 1", "bullet 2", "bullet 3"]
    }
  ],
  "keywords_added": ["keyword1", "keyword2"],
  "keywords_missing": ["gap1", "gap2"]
}
%%CV_END%%`;


// ── EM DASH SANITISER ─────────────────────────────────────────
// Strip all em dashes from CV data after Claude returns it
function sanitiseCvData(cvData) {
  const clean = (str) => typeof str === 'string'
    ? str.replace(/—/g, ',').replace(/–/g, ',').replace(/---/g, ',').replace(/--/g, ',')
    : str;

  if (cvData.headline) cvData.headline = clean(cvData.headline);
  if (cvData.summary)  cvData.summary  = clean(cvData.summary);
  if (cvData.expertise) cvData.expertise = clean(cvData.expertise);
  if (Array.isArray(cvData.experience)) {
    cvData.experience = cvData.experience.map(exp => ({
      ...exp,
      bullets: Array.isArray(exp.bullets) ? exp.bullets.map(clean) : exp.bullets
    }));
  }
  return cvData;
}

// ── AI DETECTION HEURISTIC ─────────────────────────────────────
// Scores CV text for human authenticity (0-100, higher = more human)
function scoreHumanness(cvData) {
  // Combine all text for analysis
  const parts = [cvData.headline || '', cvData.summary || '', cvData.expertise || ''];
  (cvData.experience || []).forEach(exp => {
    (exp.bullets || []).forEach(b => parts.push(b));
  });
  const fullText = parts.join(' ');
  const words = fullText.split(/\s+/).filter(Boolean);
  const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 10);

  let score = 100;
  const issues = [];
  const positives = [];

  // ── MAJOR DEDUCTIONS (5 points each) ──
  const majorFlags = [
    { term: /\bem dash\b|\u2014|\u2013/g, label: 'Em dashes detected' },
    { term: /\bleverag(e|ed|ing)\b/gi, label: '"leverage" — common AI word' },
    { term: /\bspearhead(ed|ing)?\b/gi, label: '"spearhead" — common AI word' },
    { term: /\butili[sz](e|ed|ing)\b/gi, label: '"utilise/utilize" — common AI word' },
    { term: /\bdemonstrat(e|ed|ing)\b/gi, label: '"demonstrate" — common AI word' },
    { term: /\bcutting.edge\b/gi, label: '"cutting-edge" — common AI phrase' },
    { term: /\bresults.driven\b/gi, label: '"results-driven" — common AI phrase' },
    { term: /\bproven track record\b/gi, label: '"proven track record" — common AI phrase' },
    { term: /\bdynamic professional\b/gi, label: '"dynamic professional" — common AI phrase' },
    { term: /\bfast.paced (environment|role)\b/gi, label: '"fast-paced environment" — common AI phrase' },
    { term: /\bsynerg(y|ies)\b/gi, label: '"synergy" — common AI word' },
    { term: /\bseamlessly\b/gi, label: '"seamlessly" — common AI word' },
  ];

  majorFlags.forEach(({ term, label }) => {
    const matches = fullText.match(term);
    if (matches) {
      const count = matches.length;
      score -= count * 5;
      issues.push({ type: 'major', text: label + (count > 1 ? ` (${count}x)` : '') });
    }
  });

  // ── MINOR DEDUCTIONS (2 points each) ──
  const minorFlags = [
    { term: /\brobust\b/gi, label: '"robust"' },
    { term: /\bholistic\b/gi, label: '"holistic"' },
    { term: /\btransformative\b/gi, label: '"transformative"' },
    { term: /\becosystem\b/gi, label: '"ecosystem"' },
    { term: /\bstreamlin(e|ed|ing)\b/gi, label: '"streamline"' },
    { term: /\bbest.in.class\b/gi, label: '"best-in-class"' },
    { term: /\bworld.class\b/gi, label: '"world-class"' },
    { term: /\bthought leader(ship)?\b/gi, label: '"thought leadership"' },
    { term: /\bin order to\b/gi, label: '"in order to" — wordy' },
    { term: /\bfacilitat(e|ed|ing)\b/gi, label: '"facilitate"' },
  ];

  minorFlags.forEach(({ term, label }) => {
    const matches = fullText.match(term);
    if (matches) {
      score -= matches.length * 2;
      issues.push({ type: 'minor', text: label });
    }
  });

  // ── SENTENCE LENGTH CHECK ──
  const longSentences = sentences.filter(s => s.trim().split(/\s+/).length > 35);
  if (longSentences.length > 0) {
    score -= longSentences.length * 4;
    issues.push({ type: 'major', text: `${longSentences.length} sentence(s) over 35 words — consider splitting` });
  }

  // ── POSITIVE SIGNALS (boost score) ──
  const metrics = fullText.match(/\$[\d,.]+[MKBm]?|\d+[%x]|\d+\s*(million|billion|crore|lakh)/gi);
  if (metrics && metrics.length >= 3) {
    score += 5;
    positives.push(`${metrics.length} specific metrics found`);
  }

  const shortSentences = sentences.filter(s => s.trim().split(/\s+/).length <= 15);
  if (shortSentences.length > sentences.length * 0.4) {
    score += 3;
    positives.push('Good mix of short sentences');
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  return {
    humanScore: score,
    label: score >= 80 ? 'Looks human-written' : score >= 60 ? 'Moderate AI signals' : 'Strong AI signals detected',
    issues,
    positives,
    wordCount: words.length
  };
}

app.post('/cv-update', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Too many requests.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server configuration error.' });

  const { cvBase64, cvMediaType, jdText, jobTitle, companyName, additionalContext, premiumInsights } = req.body;
  if (!cvBase64) return res.status(400).json({ error: 'CV is required.' });
  if (!jdText) return res.status(400).json({ error: 'Job description is required.' });

  const addCtx = additionalContext
    ? `\nADDITIONAL CONTEXT FROM CANDIDATE — treat as highest priority. These are real experiences and skills the candidate wants to highlight for this specific role. Weave them naturally into the rewritten sections:\n${additionalContext}`
    : '';

  const premCtx = premiumInsights
    ? `\nLINKEDIN PREMIUM DATA — use when rewriting experience bullets and expertise to target gaps:\n${premiumInsights.topSkills ? 'Skills most common among applicants: ' + premiumInsights.topSkills : ''}\n${premiumInsights.howYouCompare ? 'Applicant comparison: ' + premiumInsights.howYouCompare : ''}`
    : '';

  // Extract role type from JD for summary — do not pass company name to summary
  const roleType = jobTitle || 'senior marketing leader';
  const industry = jdText ? jdText.substring(0, 800) : '';

  const userMessage = `Here is the candidate CV (uploaded document above).

CONTEXT FOR SUMMARY GENERATION:
Role type: ${roleType}
Industry context (first 800 chars of JD — use to understand the domain, not to name the company):
${industry}

CONTEXT FOR EXPERIENCE AND EXPERTISE SECTIONS ONLY:
Job Title: ${jobTitle || 'Not provided'}
Company: ${companyName || 'Not provided'}
Full Job Description:
${jdText}${addCtx}

IMPORTANT: The summary must be written for the ROLE TYPE and DOMAIN only.
Do not mention the target company name in the summary under any circumstances.
Use the full job description only when rewriting experience bullets and expertise.

${premCtx}
Rewrite the CV sections now. Return only the JSON between %%CV_START%% and %%CV_END%%.`;

  // Validate and normalise media type
  const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const isPdf = cvMediaType === 'application/pdf';
  const isValidImage = VALID_IMAGE_TYPES.includes(cvMediaType);

  if (!isPdf && !isValidImage) {
    return res.status(400).json({
      error: 'Your CV must be a PDF or image file (JPEG, PNG). Word documents (.docx) cannot be read directly — please save your CV as a PDF first.'
    });
  }

  const cvContentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: cvBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: cvMediaType, data: cvBase64 } };

  const messages = [{
    role: 'user',
    content: [ cvContentBlock, { type: 'text', text: userMessage } ]
  }];

  try {
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 6000, system: CV_UPDATE_PROMPT, messages })
    });

    const apiData = await apiResponse.json();
    if (!apiResponse.ok) return res.status(apiResponse.status).json({ error: apiData.error?.message || 'Claude API error' });

    const rawText = apiData.content?.[0]?.text || '';
    const jsonMatch = rawText.match(/%%CV_START%%\s*([\s\S]*?)\s*%%CV_END%%/);
    if (!jsonMatch) return res.status(500).json({ error: 'CV format error. Please try again.' });

    let cvData;
    try { cvData = JSON.parse(jsonMatch[1]); }
    catch (e) {
      let cleaned = jsonMatch[1].replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,' ').replace(/,(\s*[}\]])/g,'$1');
      try { cvData = JSON.parse(cleaned); }
      catch (e2) { return res.status(500).json({ error: 'Could not parse CV update.' }); }
    }

    // Sanitise em dashes and score human authenticity
    cvData = sanitiseCvData(cvData);
    const humanScoreResult = scoreHumanness(cvData);

    // Build Word document — dark header + metrics table matching original CV
    const {
      Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle,
      LevelFormat, WidthType, ShadingType, Table, TableRow, TableCell, VerticalAlign
    } = require('docx');

    const DARK_BLUE = '1B3A5C', AMBER = 'B8860B', MID_GREY = '666666',
          BORDER_GREY = 'CCCCCC', LIGHT_BG = 'EEF2F7', WHITE = 'FFFFFF';

    const b = (color) => ({ style: BorderStyle.SINGLE, size: 1, color: color || BORDER_GREY });
    const ab = (c) => ({ top: b(c), bottom: b(c), left: b(c), right: b(c) });
    const nb = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const nbs = { top: nb, bottom: nb, left: nb, right: nb };

    const divider = (label) => new Paragraph({
      spacing: { before: 180, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: DARK_BLUE, space: 1 } },
      children: [new TextRun({ text: label.toUpperCase(), bold: true, size: 22, color: DARK_BLUE, font: 'Arial' })]
    });

    const blt = (text) => new Paragraph({
      numbering: { reference: 'bullets', level: 0 },
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, size: 20, color: '333333', font: 'Arial' })]
    });

    const jobHead = (role, company, dates) => {
      const runs = [
        new TextRun({ text: role || '', bold: true, size: 22, color: DARK_BLUE, font: 'Arial' }),
        new TextRun({ text: company ? '  |  ' : '', size: 20, color: MID_GREY, font: 'Arial' }),
        new TextRun({ text: company || '', bold: true, size: 20, color: AMBER, font: 'Arial' }),
        new TextRun({ text: dates ? '  |  ' + dates : '', size: 18, color: MID_GREY, italics: true, font: 'Arial' })
      ];
      return new Paragraph({ spacing: { before: 160, after: 40 }, children: runs });
    };

    const mCell = (value, label, w) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      borders: ab(BORDER_GREY),
      shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 80, right: 80 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 20 }, children: [
          new TextRun({ text: value, bold: true, size: 36, color: DARK_BLUE, font: 'Arial' })
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: [
          new TextRun({ text: label, size: 15, color: MID_GREY, font: 'Arial' })
        ]})
      ]
    });

    const safeJob = (jobTitle||'Role').replace(/[^a-zA-Z0-9]/g,'_');
    const safeCo = (companyName||'Company').replace(/[^a-zA-Z0-9]/g,'_');

    // Two paragraph summary
    const sumParts = (cvData.summary||'').split(/\n\n+/).filter(p=>p.trim());
    const sumParas = sumParts.length > 0
      ? sumParts.map(p => new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: p.trim(), size: 20, color: '333333', font: 'Arial' })] }))
      : [new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: cvData.summary||'', size: 20, color: '333333', font: 'Arial' })] })];

    const expParas = [];
    (cvData.experience||[]).forEach(exp => {
      expParas.push(jobHead(exp.role||'', exp.company||'', exp.dates||''));
      (exp.bullets||[]).forEach(b2 => expParas.push(blt(b2)));
    });

    // Metrics table
    const metricsTable = new Table({
      width: { size: 9906, type: WidthType.DXA },
      columnWidths: [1651, 1651, 1651, 1651, 1651, 1601],
      rows: [new TableRow({ children: [
        mCell('$14M', 'MRO Generated', 1651),
        mCell('$25M', 'Pipeline Built', 1651),
        mCell('35%', 'Sales Cycle Reduction', 1651),
        mCell('8x', 'Conversion Improvement', 1651),
        mCell('2', 'Published Books', 1651),
        mCell('16+', 'Years Experience', 1601)
      ]})]
    });

    // Header block
    const headerTable = new Table({
      width: { size: 9906, type: WidthType.DXA },
      columnWidths: [9906],
      rows: [new TableRow({ children: [
        new TableCell({
          width: { size: 9906, type: WidthType.DXA },
          borders: nbs,
          shading: { fill: DARK_BLUE, type: ShadingType.CLEAR },
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
          children: [
            new Paragraph({ spacing: { before: 0, after: 40 }, children: [
              new TextRun({ text: 'SAI KRISHNA YALLAPU', bold: true, size: 52, color: WHITE, font: 'Arial' })
            ]}),
            new Paragraph({ spacing: { before: 0, after: 40 }, children: [
              new TextRun({ text: cvData.headline||'', size: 20, color: 'C8D8E8', font: 'Arial' })
            ]}),
            new Paragraph({ spacing: { before: 0, after: 0 }, children: [
              new TextRun({ text: 'saikrishnality@gmail.com   |   +91-9848999100   |   linkedin.com/in/saikrishnality   |   Hyderabad, India', size: 18, color: 'C8D8E8', font: 'Arial' })
            ]})
          ]
        })
      ]})]
    });

    const doc = new Document({
      numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 600, right: 800, bottom: 800, left: 800 } } }, children: [
        headerTable,
        new Paragraph({ spacing: { before: 100, after: 60 }, alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: '40Under40 — BW Business World 2024   |   Marketing Leader Award — World Marketing Congress 2023, 2024, 2025', size: 18, color: AMBER, bold: true, font: 'Arial' })
        ]}),
        metricsTable,
        divider('Professional Summary'),
        ...sumParas,
        divider('Core Expertise'),
        new Paragraph({ spacing: { before: 60, after: 80 }, children: [new TextRun({ text: cvData.expertise||'', size: 20, color: '333333', font: 'Arial' })] }),
        divider('Professional Experience'),
        ...expParas,
        divider('Education & Certifications'),
        new Paragraph({ spacing: { before: 80, after: 40 }, children: [
          new TextRun({ text: 'B.Tech, Computer Science Engineering', bold: true, size: 20, color: DARK_BLUE, font: 'Arial' }),
          new TextRun({ text: '  ·  Koneru Lakshmaiah University, 2007', size: 20, color: MID_GREY, font: 'Arial' })
        ]}),
        new Paragraph({ spacing: { before: 40, after: 80 }, children: [new TextRun({ text: '6Sense Next-Gen Marketing Certified   ·   Demandbase ABX Certified', size: 20, color: '333333', font: 'Arial' })] }),
        divider('Publications'),
        blt('The ABM Playbook for B2B Marketing'),
        blt('Stop Blind Marketing, Start Account-Based Marketing'),
        divider('Marketing Technology'),
        new Paragraph({ spacing: { before: 60, after: 80 }, children: [new TextRun({ text: '6Sense · Demandbase · HubSpot · Make.com · Claude API · Airtable · Notion · ZoomInfo · Clearbit · Clay · Apollo · Google Analytics · LinkedIn Ads · Programmatic · Sales Navigator · Lusha', size: 20, color: '333333', font: 'Arial' })] }),
        new Paragraph({ spacing: { before: 160, after: 0 }, alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 2, color: BORDER_GREY, space: 1 } }, children: [
          new TextRun({ text: 'Generated by Job Interview Prep · Built by Sai Krishna Yallapu · GTM Signal', size: 16, color: MID_GREY, italics: true, font: 'Arial' })
        ]})
      ]}]
    });

        // If Word template provided — edit it using python-docx (preserves formatting)
    // Otherwise fall back to generating fresh document
    let outputBuffer;
    if (req.body.templateBase64) {
      try {
        outputBuffer = await runPythonEditor(req.body.templateBase64, cvData, companyName, jobTitle, false);
      } catch(pyErr) {
        console.error('python-docx fallback to fresh generation:', pyErr.message);
        outputBuffer = await Packer.toBuffer(doc);
      }
    } else {
      outputBuffer = await Packer.toBuffer(doc);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="CV_${safeCo}_${safeJob}.docx"`);
    res.setHeader('X-Human-Score', JSON.stringify(humanScoreResult));
    // Cache cvData server-side and return a small key (avoids large header issues)
    const cacheKey = Date.now().toString(36) + Math.random().toString(36).slice(2);
    cacheSet(cacheKey, cvData);
    res.setHeader('X-CV-Cache-Key', cacheKey);
    res.setHeader('Access-Control-Expose-Headers', 'X-Human-Score, X-CV-Cache-Key');
    res.send(outputBuffer);

  } catch (err) {
    console.error('CV update error:', err);
    return res.status(500).json({ error: 'Unexpected error. Please try again.' });
  }
});





// ── CV FROM COMPANY ENDPOINT ──────────────────────────────────
// Generates CV tailored to a company without needing a JD paste
// Claude researches the company and infers what they need

const CV_FROM_COMPANY_PROMPT = `You are an expert career analyst helping Indian professionals tailor their CV for a specific company.

You will receive a CV and a company name (and optionally a website and target role).

YOUR JOB:
1. Based on the company name and any context provided, infer what kind of marketing leader they need
2. Research what you know about this company — their business model, industry, stage, typical marketing challenges
3. Make surgical edits to the CV to align with what this company would value most

INFERENCE RULES:
- Indian IT services company → delivery, scale, ABM, enterprise accounts, US/EU markets
- Indian startup/unicorn → growth, performance marketing, product-led, speed, ownership
- Indian conglomerate → brand, relationships, hierarchy, trust
- BFSI → compliance awareness, precision, analytical rigour
- SaaS company → pipeline, MQLs, product marketing, PLG
- Manufacturing → trade marketing, channel, dealer networks
- If you cannot confidently infer the company type → write a broadly strong CV that emphasises measurable outcomes

WRITING STYLE — critical for human authenticity:
- NEVER use em dashes (—) or long hyphens. Use commas or periods instead.
- NEVER use: "leverage", "spearhead", "utilise", "cutting-edge", "results-driven",
  "proven track record", "dynamic professional", "synergy", "robust", "seamlessly",
  "holistic", "transformative", "ecosystem"
- Write short sentences. Maximum 25 words per sentence.
- Use simple past tense: "Led", "Built", "Delivered" — never "Has led"

SAME RULES AS ALWAYS:
- Never fabricate experience
- NEVER add any skill, tool or competency not already present in the original CV
- Preserve all experience roles
- Output valid JSON between %%CV_START%% and %%CV_END%%

SUMMARY RULES — CRITICAL:
Paragraph 1: MAXIMUM 70 words. Who the candidate is, experience, key metrics. No target company.
Paragraph 2: MAXIMUM 70 words. Specific past experience relevant to this role type.
Total summary: MAXIMUM 140 words.

ABSOLUTE RULES — violations make the CV unusable:
- NEVER name the target company's products, teams, or internal structure in the summary
- NEVER use "directly applicable to [company name]" — use the role domain instead
- NEVER use "Has led" or "Has built" — use simple past tense: "Led", "Built"
- Past work was done at PREVIOUS employers — this must be clear to any reader
- Do not presume knowledge of the company's internal operations or products

%%CV_START%%
{
  "match_score": "7/10",
  "match_reason": "one sentence about fit with this company",
  "headline": "updated headline",
  "summary": "paragraph 1\n\nparagraph 2",
  "expertise": "comma separated items",
  "experience": [{"company":"name","role":"title","dates":"dates","bullets":["bullet1","bullet2","bullet3"]}],
  "keywords_added": ["kw1","kw2"],
  "keywords_missing": ["gap1"]
}
%%CV_END%%`;

app.post('/cv-from-company', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Too many requests.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server configuration error.' });

  const { cvBase64, cvMediaType, companyName, companyWebsite, targetRole } = req.body;
  if (!cvBase64) return res.status(400).json({ error: 'CV is required.' });
  if (!companyName) return res.status(400).json({ error: 'Company name is required.' });

  const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const isPdf = cvMediaType === 'application/pdf';
  const isValidImage = VALID_IMAGE_TYPES.includes(cvMediaType);
  if (!isPdf && !isValidImage) return res.status(400).json({ error: 'Please upload your CV as a PDF file.' });

  const userMessage = `Here is the candidate CV (uploaded document above).

CONTEXT FOR SUMMARY GENERATION:
Role type: ${targetRole || 'senior marketing leader'}
Company type context: ${companyName} ${companyWebsite ? '(' + companyWebsite + ')' : ''}
Use this to understand the industry, company stage, and culture — but do NOT mention
the company name or its products in the Professional Summary.
The summary must read as strong for this TYPE of role, not this specific company.

CONTEXT FOR EXPERIENCE AND EXPERTISE SECTIONS:
Company: ${companyName}
${companyWebsite ? `Website: ${companyWebsite}` : ''}
${targetRole ? `Target role: ${targetRole}` : ''}
Use this to rewrite experience bullets and expertise with relevant language.

Return only the JSON between %%CV_START%% and %%CV_END%%.`;

  const cvBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: cvBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: cvMediaType, data: cvBase64 } };

  try {
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 6000,
        system: CV_FROM_COMPANY_PROMPT,
        messages: [{ role: 'user', content: [cvBlock, { type: 'text', text: userMessage }] }]
      })
    });

    const apiData = await apiResponse.json();
    if (!apiResponse.ok) return res.status(apiResponse.status).json({ error: apiData.error?.message || 'API error' });

    const rawText = apiData.content?.[0]?.text || '';
    const jsonMatch = rawText.match(/%%CV_START%%\s*([\s\S]*?)\s*%%CV_END%%/);
    if (!jsonMatch) return res.status(500).json({ error: 'CV format error. Please try again.' });

    let cvData;
    try { cvData = JSON.parse(jsonMatch[1]); }
    catch (e) {
      let cleaned = jsonMatch[1].replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,' ').replace(/,(\s*[}\]])/g,'$1');
      try { cvData = JSON.parse(cleaned); }
      catch (e2) { return res.status(500).json({ error: 'Could not parse CV update.' }); }
    }

    // Build Word document — reuse same builder logic from cv-update
    const {
      Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle,
      LevelFormat, WidthType, ShadingType, Table, TableRow, TableCell, VerticalAlign
    } = require('docx');

    const DARK_BLUE = '1B3A5C', AMBER = 'B8860B', MID_GREY = '666666',
          BORDER_GREY = 'CCCCCC', LIGHT_BG = 'EEF2F7', WHITE = 'FFFFFF';

    const b2 = (color) => ({ style: BorderStyle.SINGLE, size: 1, color: color || BORDER_GREY });
    const ab2 = (c) => ({ top: b2(c), bottom: b2(c), left: b2(c), right: b2(c) });
    const nb2 = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const nbs2 = { top: nb2, bottom: nb2, left: nb2, right: nb2 };

    const div2 = (label) => new Paragraph({
      spacing: { before: 180, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: DARK_BLUE, space: 1 } },
      children: [new TextRun({ text: label.toUpperCase(), bold: true, size: 22, color: DARK_BLUE, font: 'Arial' })]
    });

    const blt2 = (text) => new Paragraph({
      numbering: { reference: 'bullets', level: 0 },
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, size: 20, color: '333333', font: 'Arial' })]
    });

    const jh2 = (role, company, dates) => {
      const runs2 = [
        new TextRun({ text: role || '', bold: true, size: 22, color: DARK_BLUE, font: 'Arial' }),
        new TextRun({ text: company ? '  |  ' : '', size: 20, color: MID_GREY, font: 'Arial' }),
        new TextRun({ text: company || '', bold: true, size: 20, color: AMBER, font: 'Arial' }),
        new TextRun({ text: dates ? '  |  ' + dates : '', size: 18, color: MID_GREY, italics: true, font: 'Arial' })
      ];
      return new Paragraph({ spacing: { before: 160, after: 40 }, children: runs2 });
    };

    const mc2 = (value, label, w) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      borders: ab2(BORDER_GREY),
      shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 80, right: 80 },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 20 }, children: [new TextRun({ text: value, bold: true, size: 36, color: DARK_BLUE, font: 'Arial' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: [new TextRun({ text: label, size: 15, color: MID_GREY, font: 'Arial' })] })
      ]
    });

    const safeCo2 = (companyName||'Company').replace(/[^a-zA-Z0-9]/g,'_');
    const safeRole2 = (targetRole||'Role').replace(/[^a-zA-Z0-9]/g,'_').substring(0,30);

    const sumParts2 = (cvData.summary||'').split(/\n\n+/).filter(p=>p.trim());
    const sumParas2 = sumParts2.length > 0
      ? sumParts2.map(p => new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: p.trim(), size: 20, color: '333333', font: 'Arial' })] }))
      : [new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: cvData.summary||'', size: 20, color: '333333', font: 'Arial' })] })];

    const expParas2 = [];
    (cvData.experience||[]).forEach(exp => {
      expParas2.push(jh2(exp.role||'', exp.company||'', exp.dates||''));
      (exp.bullets||[]).forEach(bl => expParas2.push(blt2(bl)));
    });

    const doc = new Document({
      numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 600, right: 800, bottom: 800, left: 800 } } }, children: [
        new Table({ width: { size: 9906, type: WidthType.DXA }, columnWidths: [9906], rows: [new TableRow({ children: [new TableCell({
          width: { size: 9906, type: WidthType.DXA }, borders: nbs2,
          shading: { fill: DARK_BLUE, type: ShadingType.CLEAR },
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
          children: [
            new Paragraph({ spacing: { before: 0, after: 40 }, children: [new TextRun({ text: 'SAI KRISHNA YALLAPU', bold: true, size: 52, color: WHITE, font: 'Arial' })] }),
            new Paragraph({ spacing: { before: 0, after: 40 }, children: [new TextRun({ text: cvData.headline||'', size: 20, color: 'C8D8E8', font: 'Arial' })] }),
            new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: 'saikrishnality@gmail.com   |   +91-9848999100   |   linkedin.com/in/saikrishnality   |   Hyderabad, India', size: 18, color: 'C8D8E8', font: 'Arial' })] })
          ]
        })]})] }),
        new Paragraph({ spacing: { before: 100, after: 60 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: '40Under40 — BW Business World 2024   |   Marketing Leader Award — World Marketing Congress 2023, 2024, 2025', size: 18, color: AMBER, bold: true, font: 'Arial' })] }),
        new Table({ width: { size: 9906, type: WidthType.DXA }, columnWidths: [1651,1651,1651,1651,1651,1601], rows: [new TableRow({ children: [mc2('$14M','MRO Generated',1651),mc2('$25M','Pipeline Built',1651),mc2('35%','Sales Cycle Reduction',1651),mc2('8x','Conversion Improvement',1651),mc2('2','Published Books',1651),mc2('16+','Years Experience',1601)] })] }),
        div2('Professional Summary'), ...sumParas2,
        div2('Core Expertise'),
        new Paragraph({ spacing: { before: 60, after: 80 }, children: [new TextRun({ text: cvData.expertise||'', size: 20, color: '333333', font: 'Arial' })] }),
        div2('Professional Experience'), ...expParas2,
        div2('Education & Certifications'),
        new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: 'B.Tech, Computer Science Engineering', bold: true, size: 20, color: DARK_BLUE, font: 'Arial' }), new TextRun({ text: '  ·  Koneru Lakshmaiah University, 2007', size: 20, color: MID_GREY, font: 'Arial' })] }),
        new Paragraph({ spacing: { before: 40, after: 80 }, children: [new TextRun({ text: '6Sense Next-Gen Marketing Certified   ·   Demandbase ABX Certified', size: 20, color: '333333', font: 'Arial' })] }),
        div2('Publications'),
        blt2('The ABM Playbook for B2B Marketing'),
        blt2('Stop Blind Marketing, Start Account-Based Marketing'),
        div2('Marketing Technology'),
        new Paragraph({ spacing: { before: 60, after: 80 }, children: [new TextRun({ text: '6Sense · Demandbase · HubSpot · Make.com · Claude API · Airtable · Notion · ZoomInfo · Clearbit · Clay · Apollo · Google Analytics · LinkedIn Ads · Programmatic · Sales Navigator · Lusha', size: 20, color: '333333', font: 'Arial' })] }),
        new Paragraph({ spacing: { before: 160, after: 0 }, alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 2, color: BORDER_GREY, space: 1 } }, children: [new TextRun({ text: 'Generated by Job Interview Prep · Built by Sai Krishna Yallapu · GTM Signal', size: 16, color: MID_GREY, italics: true, font: 'Arial' })] })
      ]}]
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="CV_${safeCo2}_${safeRole2}.docx"`);
    res.send(buffer);

  } catch (err) {
    console.error('cv-from-company error:', err);
    return res.status(500).json({ error: 'Unexpected error. Please try again.' });
  }
});


// ── CV TRACKED CHANGES ENDPOINT ──────────────────────────────
// Edits the candidate's original Word CV with tracked changes
// Summary, Expertise, and Experience bullets shown as del/ins
// Candidate can accept/reject each change in Word

app.post('/cv-tracked', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Too many requests.' });

  const { templateBase64, jobTitle, companyName, cacheKey } = req.body;
  if (!templateBase64) return res.status(400).json({ error: 'Word template is required.' });
  if (!cacheKey)       return res.status(400).json({ error: 'Please generate a clean CV first, then use Track Changes.' });

  try {
    // Retrieve cvData from server cache — no second Claude call needed
    const cvData = cacheGet(cacheKey);
    if (!cvData) return res.status(400).json({ error: 'Session expired. Please generate a clean CV again then use Track Changes.' });
    // cvData already sanitised when cached from cv-update

    // Edit Word template with tracked changes using Node.js word editor
    const outputBuffer = await runPythonEditor(templateBase64, cvData, companyName, jobTitle, true);

    const safeCo = (companyName || 'Company').replace(/[^a-zA-Z0-9]/g, '_');
    const safeJob = (jobTitle || 'Role').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="CV_${safeCo}_${safeJob}_tracked.docx"`);
    res.send(outputBuffer);

  } catch (err) {
    console.error('cv-tracked error:', err);
    return res.status(500).json({ error: 'Unexpected error generating tracked CV: ' + err.message });
  }
});


// ── NODE.JS WORD EDITOR ──────────────────────────────────────
// Edits Word template directly — no Python dependency

function escXml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

// Get all text content from a paragraph XML block (concatenates all w:t)
function paraText(xml) {
  return (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g)||[]).map(m=>m.replace(/<[^>]*>/g,'')).join('');
}

// Extract w:pPr from a paragraph
function getPPr(xml) {
  const m = xml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  return m ? m[0] : '';
}

// Extract w:rPr from first run in paragraph
function getRPr(xml) {
  const m = xml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
  return m ? m[0] : '';
}

// Build clean replacement paragraph
function cleanPara(orig, text) {
  const pPr = getPPr(orig);
  const rPr = getRPr(orig);
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escXml(text)}</w:t></w:r></w:p>`;
}

// Build tracked change paragraph
function trackedPara(orig, oldText, newText, id) {
  const pPr = getPPr(orig);
  const rPr = getRPr(orig);
  const d = new Date().toISOString().split('.')[0]+'Z';
  const a = 'CV Match';
  return `<w:p>${pPr}<w:del w:id="${id}" w:author="${a}" w:date="${d}"><w:r>${rPr}<w:delText xml:space="preserve">${escXml(oldText)}</w:delText></w:r></w:del><w:ins w:id="${id+1}" w:author="${a}" w:date="${d}"><w:r>${rPr}<w:t xml:space="preserve">${escXml(newText)}</w:t></w:r></w:ins></w:p>`;
}

// Extract paragraphs with positions from XML
function getParas(xml) {
  const out = [];
  let i = 0;
  while (i < xml.length) {
    const a = xml.indexOf('<w:p>', i);
    const b = xml.indexOf('<w:p ', i);
    let s = -1;
    if (a >= 0 && b >= 0) s = Math.min(a, b);
    else if (a >= 0) s = a;
    else if (b >= 0) s = b;
    else break;
    let d = 1, j = s + 4;
    while (j < xml.length && d > 0) {
      if (xml.startsWith('<w:p>', j) || xml.startsWith('<w:p ', j)) d++;
      if (xml.startsWith('</w:p>', j)) { d--; if (!d) { j += 6; break; } }
      j++;
    }
    out.push({ s, e: j, xml: xml.slice(s, j) });
    i = j;
  }
  return out;
}

// Apply replacements in reverse order to preserve positions
function applyReplacements(xml, replacements) {
  const sorted = Object.entries(replacements)
    .map(([k,v]) => [parseInt(k), v])
    .sort((a,b) => b[0] - a[0]);
  let result = xml;
  const paras = getParas(xml);
  for (const [idx, newXml] of sorted) {
    const p = paras[idx];
    if (p) result = result.slice(0, p.s) + newXml + result.slice(p.e);
  }
  return result;
}

async function runPythonEditor(templateBase64, cvData, companyName, jobTitle, tracked = false) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(Buffer.from(templateBase64, 'base64'));
  let xml = zip.readAsText('word/document.xml');

  let id = 500;
  const reps = {}; // paraIndex -> replacement XML

  // ── FIND SECTIONS ────────────────────────────────────
  const paras = getParas(xml);
  let sumStart = -1, expIdx = -1, expStart = -1;

  paras.forEach((p, i) => {
    const t = paraText(p.xml).trim().toUpperCase();
    if (t === 'PROFESSIONAL SUMMARY' && sumStart === -1) sumStart = i;
    else if (t.includes('EXPERTISE') && sumStart > -1 && expIdx === -1) expIdx = i;
    else if (t === 'PROFESSIONAL EXPERIENCE' && expIdx > -1 && expStart === -1) expStart = i;
  });

  // ── REPLACE SUMMARY ──────────────────────────────────
  if (sumStart > -1 && expIdx > -1) {
    const parts = (cvData.summary || '').split(/\n\n+/).filter(Boolean);
    let pi = 0;
    for (let i = sumStart + 1; i < expIdx; i++) {
      const old = paraText(paras[i].xml).trim();
      if (!old) continue;
      const nw = parts[pi] || '';
      pi++;
      if (!nw || old === nw) continue;
      reps[i] = tracked ? trackedPara(paras[i].xml, old, nw, (id+=2)) : cleanPara(paras[i].xml, nw);
    }
  }

  // ── REPLACE EXPERTISE (▸ paragraphs in tables) ───────
  const expertItems = (cvData.expertise || '').split(',').map(e => e.trim()).filter(Boolean);
  let eCount = 0;
  paras.forEach((p, i) => {
    const t = paraText(p.xml).trim();
    if (t.startsWith('▸') && eCount < expertItems.length) {
      const nw = '▸ ' + expertItems[eCount++];
      if (t !== nw) reps[i] = tracked ? trackedPara(p.xml, t, nw, (id+=2)) : cleanPara(p.xml, nw);
    }
  });

  // ── REPLACE EXPERIENCE BULLETS (ListParagraph style) ─
  const allBullets = [];
  (cvData.experience || []).forEach(exp => (exp.bullets || []).forEach(b => allBullets.push(b)));
  let bCount = 0;
  if (expStart > -1) {
    paras.slice(expStart + 1).forEach((p, ri) => {
      const i = expStart + 1 + ri;
      const isListPara = p.xml.includes('ListParagraph') || p.xml.includes('List Paragraph');
      const t = paraText(p.xml).trim();
      if (isListPara && t && bCount < allBullets.length) {
        const nw = allBullets[bCount++];
        if (t !== nw) reps[i] = tracked ? trackedPara(p.xml, t, nw, (id+=2)) : cleanPara(p.xml, nw);
      }
    });
  }

  // Apply all replacements in single pass
  xml = applyReplacements(xml, reps);

  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
  return zip.toBuffer();
}

// Catch all — serve index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Job Interview Prep server running on port ${PORT}`);
});
