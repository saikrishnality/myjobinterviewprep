const express = require('express');
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

// ── SYSTEM PROMPT ─────────────────────────────────
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

// ── CV UPDATE ENDPOINT ────────────────────────────────────────
const CV_UPDATE_PROMPT = `You are an expert career analyst helping Indian professionals optimise their CV for a specific job.
You will receive a CV and a job description. Rewrite the CV sections that need updating.
RULES: Use JD language throughout. Never fabricate experience. Write out full rewritten text.
REWRITE: Professional headline, Professional Summary, Core Expertise, top 2 experience roles.
ALSO PROVIDE: Match score 1-10, keywords added, genuine gaps.
OUTPUT — return only valid JSON between the delimiters:
%%CV_START%%
{
  "match_score": "7/10",
  "match_reason": "one sentence",
  "headline": "updated headline",
  "summary": "full rewritten summary",
  "expertise": "comma separated items",
  "experience": [{"company":"name","role":"title","dates":"dates","bullets":["bullet1","bullet2","bullet3"]}],
  "keywords_added": ["kw1","kw2"],
  "keywords_missing": ["gap1","gap2"]
}
%%CV_END%%`;

app.post('/cv-update', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Too many requests.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server configuration error.' });

  const { cvBase64, cvMediaType, jdText, jobTitle, companyName } = req.body;
  if (!cvBase64) return res.status(400).json({ error: 'CV is required.' });
  if (!jdText) return res.status(400).json({ error: 'Job description is required.' });

  const userMessage = `Here is the candidate CV (uploaded document above).
Job Title: ${jobTitle || 'Not provided'}
Company: ${companyName || 'Not provided'}
Job Description:
${jdText}
Rewrite the CV sections now. Return only the JSON between %%CV_START%% and %%CV_END%%.`;

  const isPdf = cvMediaType === 'application/pdf';
  const messages = [{
    role: 'user',
    content: [
      isPdf
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: cvBase64 } }
        : { type: 'image', source: { type: 'base64', media_type: cvMediaType || 'image/jpeg', data: cvBase64 } },
      { type: 'text', text: userMessage }
    ]
  }];

  try {
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4000, system: CV_UPDATE_PROMPT, messages })
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

    // Build Word document
    const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, LevelFormat } = require('docx');
    const DARK_BLUE = '1a2e4a', AMBER = 'B8860B', MID_GREY = '666666', BORDER_GREY = 'CCCCCC';

    const divider = (label) => new Paragraph({
      spacing: { before: 200, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: AMBER, space: 1 } },
      children: [new TextRun({ text: label.toUpperCase(), bold: true, size: 22, color: DARK_BLUE, font: 'Arial' })]
    });

    const bullet = (text) => new Paragraph({
      numbering: { reference: 'bullets', level: 0 },
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, size: 20, color: '333333', font: 'Arial' })]
    });

    const jobHead = (role, company, dates) => new Paragraph({
      spacing: { before: 140, after: 40 },
      children: [
        new TextRun({ text: role, bold: true, size: 22, color: DARK_BLUE, font: 'Arial' }),
        new TextRun({ text: '  ·  ', size: 20, color: MID_GREY, font: 'Arial' }),
        new TextRun({ text: company, bold: true, size: 20, color: AMBER, font: 'Arial' }),
        new TextRun({ text: '  ·  ' + dates, size: 18, color: MID_GREY, italics: true, font: 'Arial' })
      ]
    });

    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const safeJob = (jobTitle || 'Role').replace(/[^a-zA-Z0-9]/g,'_');
    const safeCo = (companyName || 'Company').replace(/[^a-zA-Z0-9]/g,'_');
    const kwAdded = (cvData.keywords_added || []).join(' · ');
    const kwMissing = (cvData.keywords_missing || []).join(', ');

    const expParagraphs = [];
    (cvData.experience || []).forEach(exp => {
      expParagraphs.push(jobHead(exp.role||'', exp.company||'', exp.dates||''));
      (exp.bullets||[]).forEach(b => expParagraphs.push(bullet(b)));
    });

    const doc = new Document({
      numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } }, children: [
        new Paragraph({ spacing: { before: 0, after: 60 }, children: [new TextRun({ text: 'SAI KRISHNA YALLAPU', bold: true, size: 48, color: DARK_BLUE, font: 'Arial' })] }),
        new Paragraph({ spacing: { before: 0, after: 40 }, children: [new TextRun({ text: cvData.headline||'', size: 20, color: MID_GREY, font: 'Arial' })] }),
        new Paragraph({ spacing: { before: 0, after: 40 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: AMBER, space: 1 } }, children: [
          new TextRun({ text: 'saikrishnality@gmail.com', size: 18, color: AMBER, font: 'Arial' }),
          new TextRun({ text: '   ·   +91-9848999100   ·   linkedin.com/in/saikrishnality   ·   Hyderabad, India', size: 18, color: MID_GREY, font: 'Arial' })
        ]}),
        new Paragraph({ spacing: { before: 80, after: 40 }, children: [
          new TextRun({ text: '✦ Updated for: ', bold: true, size: 18, color: AMBER, font: 'Arial' }),
          new TextRun({ text: `${jobTitle||'Role'} at ${companyName||'Company'}  ·  Match: ${cvData.match_score||'—'}  ·  ${today}`, size: 18, color: MID_GREY, font: 'Arial' })
        ]}),
        new Paragraph({ spacing: { before: 0, after: 100 }, children: [new TextRun({ text: cvData.match_reason||'', size: 18, color: MID_GREY, italics: true, font: 'Arial' })] }),
        divider('Professional Summary'),
        new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: cvData.summary||'', size: 20, color: '333333', font: 'Arial' })] }),
        new Paragraph({ spacing: { before: 40, after: 80 }, children: [new TextRun({ text: '🏆 40Under40 — BW Business World 2024   ·   Marketing Leader Award — World Marketing Congress 2023, 2024, 2025', size: 18, color: AMBER, font: 'Arial' })] }),
        divider('Core Expertise'),
        new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: cvData.expertise||'', size: 20, color: '333333', font: 'Arial' })] }),
        divider('Professional Experience'),
        ...expParagraphs,
        divider('Education & Certifications'),
        new Paragraph({ spacing: { before: 80, after: 40 }, children: [
          new TextRun({ text: 'B.Tech, Computer Science Engineering', bold: true, size: 20, color: DARK_BLUE, font: 'Arial' }),
          new TextRun({ text: '  ·  Koneru Lakshmaiah University, 2007', size: 20, color: MID_GREY, font: 'Arial' })
        ]}),
        new Paragraph({ spacing: { before: 40, after: 80 }, children: [new TextRun({ text: '6Sense Next-Gen Marketing Certified   ·   Demandbase ABX Certified', size: 20, color: '333333', font: 'Arial' })] }),
        divider('Publications'),
        bullet('The ABM Playbook for B2B Marketing'),
        bullet('Stop Blind Marketing, Start Account-Based Marketing'),
        ...(kwAdded ? [divider('JD Keywords Incorporated'), new Paragraph({ spacing: { before: 60, after: 40 }, children: [new TextRun({ text: kwAdded, size: 18, color: '2d7a4f', font: 'Arial' })] })] : []),
        ...(kwMissing ? [new Paragraph({ spacing: { before: 40, after: 80 }, children: [new TextRun({ text: 'Genuine gaps — not added to avoid fabrication: ', bold: true, size: 18, color: 'c0392b', font: 'Arial' }), new TextRun({ text: kwMissing, size: 18, color: MID_GREY, font: 'Arial' })] })] : []),
        new Paragraph({ spacing: { before: 200, after: 0 }, alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 2, color: BORDER_GREY, space: 1 } }, children: [new TextRun({ text: 'Generated by Job Interview Prep · Built by Sai Krishna Yallapu · GTM Signal', size: 16, color: MID_GREY, italics: true, font: 'Arial' })] })
      ]}]
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="CV_${safeCo}_${safeJob}.docx"`);
    res.send(buffer);

  } catch (err) {
    console.error('CV update error:', err);
    return res.status(500).json({ error: 'Unexpected error. Please try again.' });
  }
});


// Catch all — serve index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Job Interview Prep server running on port ${PORT}`);
});
