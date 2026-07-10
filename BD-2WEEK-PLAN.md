# 2-Week Plan — Ship BurningDemand (CSlopSlop = narrative thread, not a co-launch)

**Strategy (why this shape):**
- **BurningDemand (BD) is the product and the cash.** Built by hand (agent-assisted), aimed at the hot, time-sensitive market of stranded GummySearch users. Real users, real dollars.
- **CSlopSlop is the story and the future — never falsely credited.** You do *not* claim CSlopSlop built BD (it can't yet; claiming it would torch the "honest & reliable" moat). Instead, building BD by hand *is the origin story and proof-of-need* for CSlopSlop, and BD becomes CSlopSlop's ground-truth test case later ("can it rebuild BD as well as I did?").
- **Validate before building. Chase one real dollar, not 100 free signups.** Talk to refugees first; the real gate is a paying customer, not curiosity.
- **The launch is a seed, not a finish line** — Day 13 opens a 30-day follow-through, it doesn't close the project.

~6–7h/day, **two real buffer days** (7, 12) so one bad day doesn't collapse the sprint.

| Day | Focus | Build — task · hrs | Content (build-in-public, ≈0.5h) | Distribution — task · hrs | Total |
|---|---|---|---|---|---|
| **Pre** | Warming | — | — | Register + warm 3 Reddit + 2 HN accts (genuine comments, no links); build the refugee target list · ~0.5h/day, starting ASAP | — |
| 1 | **Validate** | — (research only) | "GummySearch died. I'm building the multi-source replacement — but first I'm talking to 8 people who lost it. [thread]" | 5–8 DMs/calls with ex-GummySearch users: what they used it for, what they paid, what's missing · 4h | 5h |
| 2 | **Validate + infra** | Synthesize interviews → 1-page spec + pricing hypothesis; stand up domain, landing, **Stripe (real keys, not just test)**, analytics funnel, API proxy w/ caching + spend caps · 5h | "What 8 stranded users actually want (turns out it's not more Reddit). [screenshot of notes]" | Reply to 5; 1 value comment · 1h | 6.5h |
| 3 | **Build: intake** | Multi-source intake (Grok + Perplexity) for a keyword/topic → dedup identical complaints · 6h | "Day 1 of building: it now pulls demand from 3 sources, not just Reddit. [clip]" | Reply to 5; answer a "GummySearch alternative?" thread · 1h | 7.5h |
| 4 | **Build: scoring** | Score = frequency × intensity; **every claim cites a source URL** (the trust differentiator) · 6h | "It scores each pain by how often × how hard people complain — and cites every source. No hallucinated demand. [clip]" | Reply to 5; DM 3 more refugees from the list · 1h | 7.5h |
| 5 | **Build: WTP + soft launch** | Willingness-to-pay extraction + auto MVP brief; **ship the FREE single-keyword page live** (soft launch → demand signal starts) · 6h | "Now it extracts willingness-to-pay + writes a build brief. Cost/report: $0.xx. Free tool live → [link]." | Native "I built a free tool for GummySearch refugees" post in best sub · 1.5h | 8h |
| 6 | **Build: gate + samples** | Gate the full report behind signup (free single-keyword stays open); pre-generate 3–5 genuinely impressive sample reports so first-visitors see it *working* · 5h | "Someone ran it on [niche] and found a $X gap in 90s. [the actual report]" | Reply to 5; share a sample report in a relevant thread · 1h | 6.5h |
| 7 | **BUFFER / catch-up** | Finish anything slipped from Days 3–6; harden the demo path · 3–5h | "Behind the scenes: what broke and what I cut. [honest clip]" | Reply to 5 · 1h | ~5h |
| 8 | **Monetize — chase $1** | **Paid checkout live (real Stripe).** "Founding user" offer ($X, lifetime/discount) → take it directly to your interview contacts · 5h | "It's paid now. First 10 founding users get [offer]. Ex-GummySearch users, this is for you." | DM every warm contact with the founding offer + a personalized reason · 2h | 7.5h |
| 9 | **Polish + SEO** | "GummySearch alternative" + comparison landing pages; fix the top conversion drop-off from analytics · 6h | "The one thing GummySearch never did — and why. [comparison]" | Reply to 5; post the comparison where refugees search · 1h | 7.5h |
| 10 | **Proof** | Onboard the first users hands-on; collect 3–5 testimonials / a mini case study · 4h | "Real user, real result: [testimonial + report]." | Reply to 5; ask happy users to be part of launch day · 1.5h | 6h |
| 11 | **Launch prep** | PH page + Show HN title + Reddit-native post + launch-day assets; nothing new built · 4h | "Launching [product] on [day]. Here's the story so far. [recap thread]" | Line up launch squad (5–10 real people); schedule everything · 2h | 6.5h |
| 12 | **BUFFER + rehearsal** | Final polish, load-test the demo path, dry-run checkout end-to-end · 3–4h | "Tomorrow. Here's what's done and what's honestly not. [teaser]" | Confirm launch squad; final acct check · 1h | ~5h |
| 13 | **LAUNCH** | Go-live + monitor; hotfix only · 2h | Launch thread: pain → build → real users/$ → live now → "what niche should I cover next?" | Fire PH (**00:01 PT, first 2h fully on PH**) → then HN + Reddit-native + X; reply all day · 6h | 8.5h |
| 14 | **Follow-through + bridge** | Fix the top launch-day issues; write the next-30-days backlog from launch feedback · 3h | **The CSlopSlop bridge post:** "Building BurningDemand by hand showed me the exact loop I want to automate. That's the machine I'm building next: CSlopSlop." | Reply to every launch comment; thank the squad · 2.5h | 6h |

---

## Gates (what advances / stops the plan)
- **End of Day 2 — demand gate.** If ≥5 interviews confirm the pain is real *and* worth paying for → build. If not, fix the wedge or the niche *before* writing code. (Cheapest possible pivot.)
- **End of Day 6 — the tool works.** Free tool live, sample reports are genuinely impressive, demand signal (signups + report runs) is being measured *alongside traffic* so you can tell a demand miss from a distribution miss.
- **End of Day 8 — the real gate: 1 paying customer.** With a warm, previously-paying audience and a founding offer, one real dollar is achievable and is the only honest validation. **Zero paid after genuine effort = a real signal** — reassess price/wedge/niche before spending launch attention. (Keep free signups as a soft read; make *paid* the gate.)
- **Day 13 — launch** only if the demo path and checkout are rock-solid end-to-end.

## The CSlopSlop narrative thread (honest build-in-public)
Run this *under* the BD content the whole two weeks — it builds CSlopSlop's audience without a single false claim:
- You are the **first user of your own future product.** Every manual, tedious step of building BD (research → score → spec → build → GTM) is a live demo of the pain CSlopSlop will automate.
- **Never say "CSlopSlop built this."** Say: *"I built this by hand — here's the loop I want a machine to run."*
- The Day 14 bridge post converts BD's launch audience into CSlopSlop's waitlist: same loop, now automated.
- **Later (out of scope here):** BD becomes CSlopSlop's ground-truth benchmark — the truest test is "can it rebuild BurningDemand as well as I did?", valid precisely because you know the right answer.

## Content arc (narrative with stakes)
grief (GummySearch died) → bet (I'm building the replacement) → build (daily proof) → **proof** (real users + real dollars) → reveal (launch) → bridge (why I'm building CSlopSlop). The Day-8 founding offer and any real dollar are the emotional peak — lead with them.

## Budget
Same rules as `LAUNCH-PLAN.md` (production quality + COGS + launch squad + a held-back "amplify the winner" reserve; **no cold ads into the demand gate**). One addition for the 2-week version: a small budget to *pre-pay for or comp the first few reports* for interview contacts, so testimonials come from real usage, not favors.

## Reality check
- **Realistic?** Yes — BD alone, by hand, over two weeks with two buffer days is a normal solo sprint. The thing that made the 7-day version fiction (building CSlopSlop *and* BD *and* faking that one built the other) is gone.
- **Biggest risk now:** BD's build slips and eats the buffer days → launch with a weak demo. Mitigation: Days 3–6 build *only* the demo path; everything else waits.
- **Second risk:** you drift back into building CSlopSlop mid-sprint. Don't. CSlopSlop is content and future here — zero build hours until BD has shipped and shown real dollars.
