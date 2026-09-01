#!/usr/bin/env python3
"""Generate site/content/bundle.json from the repo content banks."""
import json, re, os
BANKS={'vr':['vr-september.json','vr-weeks5-8.json'],'qr':['qr-september.json','qr-weeks5-8.json'],
       'ma':['ma-september.json','ma-weeks5-8.json'],'rc':['rc-september.json','rc-weeks5-8.json']}
out={'version':'2026.09.01','subjects':{},'passages':{}}
for sub,files in BANKS.items():
    items=[]
    for f in files:
        for it in json.load(open(f'content/question-banks/{f}'))['items']:
            m=re.match(r'(W[1-8])', str(it.get('form','')))
            items.append({'id':it['id'],'w':m.group(1) if m else 'W1','sk':it.get('skill',''),
                'd':it.get('difficulty',''),'q':it['prompt'],
                'c':[it['choices'][k] for k in 'ABCD'],'k':it['correct'],
                'e':it.get('explanation',''),'p':it.get('passage_id','')})
    items.sort(key=lambda i:(int(i['w'][1:]), i['id']))
    out['subjects'][sub]=items
for f in ['rc-september-passages.json','rc-weeks5-8-passages.json']:
    for p in json.load(open(f'content/passages/{f}'))['items']:
        out['passages'][p['id']]={'t':p.get('title',''),'x':p['text']}
out['weeks']=[{'w':'W1','label':'Aug 31 – Sep 6'},{'w':'W2','label':'Sep 7 – 13'},
 {'w':'W3','label':'Sep 14 – 20'},{'w':'W4','label':'Sep 28 – Oct 4'},
 {'w':'W5','label':'Oct 5 – 11'},{'w':'W6','label':'Oct 12 – 18'},
 {'w':'W7','label':'Nov 9 – 15'},{'w':'W8','label':'Nov 16 – 22'}]
out['starts']={'W1':'2026-08-31','W2':'2026-09-07','W3':'2026-09-14','W4':'2026-09-28',
 'W5':'2026-10-05','W6':'2026-10-12','W7':'2026-11-09','W8':'2026-11-16'}
out['breaks']=[{'label':'Sep 21 – 27','what':'Split baseline mock'},
 {'label':'Oct 19 – 25','what':'Mock 1'},{'label':'Oct 26 – Nov 1','what':'Correction and retest'},
 {'label':'Nov 2 – 8','what':'Mock 2'}]
os.makedirs('site/content',exist_ok=True)
json.dump(out,open('site/content/bundle.json','w'),ensure_ascii=False,separators=(',',':'))
n=sum(len(v) for v in out['subjects'].values())
print(f'bundle.json {os.path.getsize("site/content/bundle.json"):,} bytes · {n} items · {len(out["passages"])} passages')
