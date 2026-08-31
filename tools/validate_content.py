#!/usr/bin/env python3
"""Validate the exported content tree. Fails loudly; exit 1 on any error."""
import json, os, sys, collections, hashlib, re
L='ABCD'; errs=[]; warns=[]; total=0
BANKS='content/question-banks'
pass_ids=set()
for f in os.listdir('content/passages'):
    for p in json.load(open(f'content/passages/{f}'))['items']:
        pass_ids.add(p['id'])
        if not p.get('text') or len(str(p['text']))<100: errs.append(f'{p["id"]}: passage text missing/short')

seen=set()
for f in sorted(os.listdir(BANKS)):
    d=json.load(open(f'{BANKS}/{f}'))
    for it in d['items']:
        total+=1; i=it['id']
        if i in seen: errs.append(f'{i}: duplicate id')
        seen.add(i)
        for k in ('schema_version','content_version','subject','prompt','choices','correct','source','content_hash'):
            if k not in it or it[k] in (None,''): errs.append(f'{i}: missing {k}')
        ch=it.get('choices',{})
        if sorted(ch)!=list(L): errs.append(f'{i}: choices not A-D')
        if any(v is None or str(v).strip()=='' for v in ch.values()): errs.append(f'{i}: blank choice')
        if len({str(v).strip() for v in ch.values()})!=4: errs.append(f'{i}: duplicate choice values')
        if it.get('correct') not in L: errs.append(f'{i}: correct={it.get("correct")!r}')
        if it.get('passage_id') and it['passage_id'] not in pass_ids: errs.append(f'{i}: unknown passage {it["passage_id"]}')
        h=hashlib.sha256(json.dumps({k:v for k,v in it.items() if k!='content_hash'},sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()[:16]
        if h!=it['content_hash']: errs.append(f'{i}: content_hash mismatch')
        if not it.get('explanation'): warns.append(f'{i}: no explanation')

# answer-position sanity per bank/form
for f in sorted(os.listdir(BANKS)):
    d=json.load(open(f'{BANKS}/{f}'))
    g=collections.defaultdict(list)
    for it in d['items']: g[(it.get('form') or '-', it['subject'])].append(it['correct'])
    for k,v in g.items():
        s=''.join(v)
        if len(s)<8: continue
        st=L.index(s[0]); exp=''.join(L[(st+i)%4] for i in range(len(s)))
        cyc=sum(a==b for a,b in zip(s,exp))/len(s)
        if cyc>0.60: errs.append(f'{d["bank"]} {k}: answer positions still {100*cyc:.0f}% cyclic')

print(f'items validated: {total}')
print(f'passages: {len(pass_ids)}')
print(f'warnings: {len(warns)}  (items without explanation)')
print(f'ERRORS: {len(errs)}')
for e in errs[:20]: print('  !',e)
sys.exit(1 if errs else 0)
