#!/usr/bin/env python3
"""
Turn the authored weeks-5-8 JSON into a validated, de-patterned apply payload.

Steps: load -> normalise vocabularies -> structural validation -> re-randomise
answer positions (the authors were told not to, so every file arrives skewed)
-> verify the result carries no exploitable pattern -> emit payload.json.
"""
import json, random, collections, sys, hashlib

A = 'authoring/'
L = 'ABCD'
random.seed(20260831)

RC_SKILL = {'Tone/style/figurative': 'Tone/style/figurative language'}
RC_DIFF  = {'Core': 'Standard', 'Stretch': 'Challenge', 'Foundation': 'Foundation',
            'Standard': 'Standard', 'Challenge': 'Challenge'}

def load(*names):
    out = []
    for n in names:
        d = json.load(open(A + n))
        out.extend(d['weeks'])
    return out

SUB = {
 'MA': dict(weeks=load('ma_w56.json', 'ma_w78.json'), blocks=[(7,18),(24,35)], sizes=[12,12]),
 'QR': dict(weeks=load('qr_w56.json', 'qr_w78.json'), blocks=[(7,18),(24,38)], sizes=[12,15]),
 'RC': dict(weeks=load('rc_w56.json', 'rc_w78.json'), blocks=[(7,12),(20,25)], sizes=[6,6]),
 'VR': dict(weeks=load('vr_w5.json','vr_w6.json','vr_w7.json','vr_w8.json'),
            blocks=[(6,25),(30,49),(54,70)], sizes=[20,20,17]),
}

errs, warns = [], []

def chk(cond, msg):
    if not cond: errs.append(msg)

# ---------- normalise + validate ----------
for sub, S in SUB.items():
    chk(len(S['weeks']) == 4, f'{sub}: expected 4 weeks, got {len(S["weeks"])}')
    for w in S['weeks']:
        tag = f'{sub} W{w["week"]}'
        chk(len(w['sessions']) == len(S['sizes']), f'{tag}: session count')
        for si, s in enumerate(w['sessions']):
            n = S['sizes'][si]
            chk(len(s['items']) == n, f'{tag} S{si+1}: {len(s["items"])} items, want {n}')
            if sub == 'RC':
                chk(200 <= len(s['passage'].split()) <= 280, f'{tag} S{si+1}: passage length')
            for i, it in enumerate(s['items']):
                loc = f'{tag} S{si+1} Q{i+1}'
                if sub == 'RC':
                    it['skill'] = RC_SKILL.get(it['skill'], it['skill'])
                    it['difficulty'] = RC_DIFF.get(it['difficulty'], it['difficulty'])
                    chk(it['difficulty'] in ('Foundation','Standard','Challenge'), f'{loc}: diff {it["difficulty"]}')
                elif sub in ('MA','QR'):
                    chk(it['difficulty'] in ('E','M','H'), f'{loc}: diff {it.get("difficulty")}')
                if sub == 'VR' and si == 0:
                    chk(it.get('word') and it.get('task'), f'{loc}: word/task missing')
                    chk(len(it['task']) <= 100, f'{loc}: task too long')
                    continue
                ch = [str(c).strip() for c in it['choices']]
                chk(len(ch) == 4, f'{loc}: {len(ch)} choices')
                chk(all(ch), f'{loc}: blank choice')
                chk(len(set(ch)) == 4, f'{loc}: duplicate choices {ch}')
                chk(it['correct'] in L, f'{loc}: bad key {it.get("correct")}')
                chk(str(it.get('question','')).strip(), f'{loc}: blank question')
                it['choices'] = ch

if errs:
    print('STRUCTURAL ERRORS:'); [print('  -', e) for e in errs]; sys.exit(1)
print('structural validation: OK')

# ---------- re-randomise answer positions ----------
def scramble(items):
    """Shuffle each item's options; retarget so the key letters are balanced
    and carry no cyclic / repeating motif."""
    n = len(items)
    # Draw letters independently, then keep the draw only if it is unbiased
    # enough. Forcing an exactly balanced multiset every session is itself a
    # pattern (every 6-item RC session came out A2 B2 C1 D1), so the quota is
    # allowed to vary; only real skew and real cycles are rejected.
    base = None
    for _ in range(20000):
        tgt = [random.choice(L) for _ in range(n)]
        c = collections.Counter(tgt)
        if len(c) < 4: continue                       # all four letters must appear
        if max(c.values()) > max(3, round(0.40 * n)): continue   # no letter beats ~40%
        if any(tgt[i] == tgt[i+1] == tgt[i+2] for i in range(n-2)): continue      # no 3-in-a-row
        cyc = sum(1 for i in range(n-1) if (L.index(tgt[i+1]) - L.index(tgt[i])) % 4 == 1)
        if cyc / (n-1) > 0.40: continue                                           # no ABCD cycle
        rev = sum(1 for i in range(n-1) if (L.index(tgt[i+1]) - L.index(tgt[i])) % 4 == 3)
        if rev / (n-1) > 0.40: continue                                           # no DCBA cycle
        break
    for it, t in zip(items, tgt):
        correct_text = it['choices'][L.index(it['correct'])]
        others = [c for c in it['choices'] if c != correct_text]
        random.shuffle(others)
        new = others[:]; new.insert(L.index(t), correct_text)
        it['choices'] = new; it['correct'] = t
    return tgt

allkeys = collections.Counter()
for sub, S in SUB.items():
    for w in S['weeks']:
        for si, s in enumerate(w['sessions']):
            if sub == 'VR' and si == 0: continue
            tgt = scramble(s['items'])
            allkeys.update(tgt)
            # re-verify against the actual written items
            got = [it['correct'] for it in s['items']]
            assert got == tgt
            for it in s['items']:
                assert it['choices'][L.index(it['correct'])] , 'key points at blank'

# ---------- verify no exploitable pattern ----------
print('\nkey distribution overall:', dict(allkeys))
bad = []
for sub, S in SUB.items():
    for w in S['weeks']:
        for si, s in enumerate(w['sessions']):
            if sub == 'VR' and si == 0: continue
            ks = [it['correct'] for it in s['items']]
            n = len(ks)
            cyc = sum(1 for i in range(n-1) if (L.index(ks[i+1]) - L.index(ks[i])) % 4 == 1) / (n-1)
            rev = sum(1 for i in range(n-1) if (L.index(ks[i+1]) - L.index(ks[i])) % 4 == 3) / (n-1)
            c = collections.Counter(ks)
            top = max(c.values()) / n
            flag = 'FAIL' if (cyc > .45 or rev > .45 or len(c) < 4
                              or max(c.values()) > max(3, round(0.40 * n))) else 'ok'
            if flag == 'FAIL': bad.append(f'{sub} W{w["week"]} S{si+1}')
            print(f'  {sub} W{w["week"]} S{si+1}: n={n:2d} cyc={cyc:3.0%} rev={rev:3.0%} '
                  f'top={top:3.0%} {"".join(f"{x}{c[x]}" for x in L)} {flag}')
chk(not bad, 'pattern check failed: ' + ', '.join(bad))

# the key must not be findable by option length either
print()
for sub, S in SUB.items():
    lo = sh = tot = 0
    for w in S['weeks']:
        for si, s_ in enumerate(w['sessions']):
            if sub == 'VR' and si == 0: continue
            for it in s_['items']:
                ln = [len(str(c)) for c in it['choices']]
                k = ln[L.index(it['correct'])]; tot += 1
                if k == max(ln) and ln.count(max(ln)) == 1: lo += 1
                if k == min(ln) and ln.count(min(ln)) == 1: sh += 1
    print(f'  {sub} length-tell: key longest {lo/tot:.0%}, shortest {sh/tot:.0%} (chance 25%)')
    chk(lo / tot < 0.40, f'{sub}: key is longest {lo/tot:.0%} of the time')
if errs: print('ERRORS:', errs); sys.exit(1)

json.dump({k: v['weeks'] for k, v in SUB.items()}, open('weeks58.json','w'),
          ensure_ascii=False, indent=1)
tot = sum(len(s['items']) for S in SUB.values() for w in S['weeks'] for s in w['sessions'])
print(f'\nwrote weeks58.json — {tot} items across {sum(len(S["weeks"]) for S in SUB.values())} week-tabs')
