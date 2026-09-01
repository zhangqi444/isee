#!/usr/bin/env python3
"""Full audit of the authored weeks-5-8 content, in code, no agents."""
import json, re, collections, itertools

A='authoring/'
FILES={'MA':['ma_w56.json','ma_w78.json'],'QR':['qr_w56.json','qr_w78.json'],
       'VR':['vr_w5.json','vr_w6.json','vr_w7.json','vr_w8.json'],
       'RC':['rc_w56.json','rc_w78.json']}
data={}
for sub,fs in FILES.items():
    ws=[]
    for f in fs: ws.extend(json.load(open(A+f))['weeks'])
    data[sub]=ws

def mc(sub):
    for w in data[sub]:
        for si,s in enumerate(w['sessions']):
            for qi,it in enumerate(s['items']):
                if 'choices' in it: yield f'{sub} W{w["week"]} S{si+1} Q{qi+1}', it

# --- 1. letter references in explanations (tight patterns) ---
PAT=re.compile(r'\b(?:choice|option|answer)s?\s+[ABCD]\b'
               r'|\b[ABCD]\s+(?:and|or|,)\s+[ABCD]\b'
               r'|\b[ABCD]\s+is\s+(?:wrong|incorrect|contradicted|unsupported|true|correct)'
               r'|\b[ABCD]\s+(?:misreads?|contradicts?|overstates?|names?)\b'
               r'|\bthe (?:last|first|second|third|fourth) choice\b')
print('=== 1. letter/positional references in explanations ===')
n=0
for sub in FILES:
    for loc,it in mc(sub):
        m=PAT.search(it.get('explanation','') or '')
        if m: print(f'  {loc}: ...{m.group(0)}...'); n+=1
print(f'  total: {n}')

# --- 2. length tell ---
print('\n=== 2. length tell (key is strictly longest / shortest) ===')
for sub in FILES:
    lo=sh=tot=0
    for loc,it in mc(sub):
        L=[len(str(c)) for c in it['choices']]; k=L['ABCD'.index(it['correct'])]
        tot+=1
        if k==max(L) and L.count(max(L))==1: lo+=1
        if k==min(L) and L.count(min(L))==1: sh+=1
    print(f'  {sub}: longest {lo}/{tot} ({lo/tot:.0%})  shortest {sh}/{tot} ({sh/tot:.0%})   [chance 25%]')

# --- 3. duplicate / near-duplicate stems across ALL subjects ---
print('\n=== 3. duplicate stems across subjects ===')
def norm(s):
    s=re.sub(r'[^a-z0-9 ]',' ',str(s).lower())
    s=re.sub(r'\b(the|a|an|of|is|are|to|in|and|what|how|many|much)\b',' ',s)
    return ' '.join(s.split())
stems=[]
for sub in FILES:
    for loc,it in mc(sub): stems.append((loc,norm(it['question']),it['question']))
seen=collections.defaultdict(list)
for loc,n_,raw in stems: seen[n_].append(loc)
dups=[(k,v) for k,v in seen.items() if len(v)>1]
for k,v in dups: print('  EXACT:',v,'->',k[:70])
import difflib
near=0
for (l1,n1,r1),(l2,n2,r2) in itertools.combinations(stems,2):
    if n1==n2: continue
    if abs(len(n1)-len(n2))>18: continue
    if difflib.SequenceMatcher(None,n1,n2).ratio()>0.86:
        print(f'  NEAR {difflib.SequenceMatcher(None,n1,n2).ratio():.2f}: {l1} | {l2}')
        print(f'        {r1[:88]}')
        print(f'        {r2[:88]}'); near+=1
print(f'  exact={len(dups)} near={near}')

# --- 4. out-of-level notation ---
print('\n=== 4. out-of-level notation ===')
BAD=[(r'\d\s*(?:²|³|\^)', 'exponent notation'),
     (r'\bsquared\b|\bcubed\b|to the \w+ power','exponent wording'),
     (r'√','radical sign'),
     (r'\(\s*-\s*\d','negative coordinate')]
for sub in FILES:
    for loc,it in mc(sub):
        blob=str(it['question'])+' '+' '.join(map(str,it['choices']))
        for rx,label in BAD:
            if re.search(rx,blob): print(f'  {loc}: {label} -> {it["question"][:80]}')

# --- 5. VR headwords ---
print('\n=== 5. VR headwords ===')
used=set(json.load(open(A+'used_vr_words.json')))
wk={}
for w in data['VR']:
    s1={it['word'].lower() for it in w['sessions'][0]['items']}
    s2={it['word'].lower() for it in w['sessions'][1]['items']}
    s3={it['word'].lower() for it in w['sessions'][2]['items']}
    wk[w['week']]=(s1,s2,s3)
    print(f'  W{w["week"]}: s1={len(s1)} s2={len(s2)} s3={len(s3)} s1==s2:{s1==s2} s1&s3={s1&s3 or "-"}')
    if w['week']!=8:
        bad=(s1|s3)&used
        if bad: print(f'    REUSES weeks1-4 words: {sorted(bad)}')
    else:
        new=(s1|s3)-used
        if new: print(f'    W8 words NOT from weeks1-4: {sorted(new)}')
for a,b in itertools.combinations([5,6,7],2):
    ov=(wk[a][0]|wk[a][2])&(wk[b][0]|wk[b][2])
    if ov: print(f'  W{a}/W{b} overlap: {sorted(ov)}')

# --- 6. difficulty ---
print('\n=== 6. difficulty distribution ===')
for sub in ['MA','QR','RC']:
    c=collections.Counter()
    for w in data[sub]:
        for s in w['sessions']:
            for it in s['items']:
                if 'choices' in it: c[it.get('difficulty')]+=1
    print(f'  {sub}: {dict(c)}')
print('  (weeks1-4 baseline: MA 32E/32M/32H · QR 55E/35M/18H · RC 12F/24S/12C)')

# --- 7. structural ---
print('\n=== 7. structural ===')
errs=[]
for sub in FILES:
    for loc,it in mc(sub):
        ch=[str(c).strip() for c in it['choices']]
        if len(ch)!=4: errs.append(f'{loc} choices={len(ch)}')
        if not all(ch): errs.append(f'{loc} blank choice')
        if len(set(ch))!=4: errs.append(f'{loc} dup choices')
        if it['correct'] not in 'ABCD': errs.append(f'{loc} key={it["correct"]}')
        if not str(it.get('question','')).strip(): errs.append(f'{loc} blank q')
        if not (it.get('explanation') or '').strip(): errs.append(f'{loc} no explanation')
print('  errors:', errs if errs else 'none')
