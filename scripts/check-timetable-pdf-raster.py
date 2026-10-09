# Compare actual PDF raster ink against the preview canvas geometry.
# Requires Pillow and numpy; render the PDF with pdftoppm -scale-to 1600 first.
import json,sys
from pathlib import Path
from PIL import Image
import numpy as np
scenario=sys.argv[1] if len(sys.argv)>1 else 'full'
base=Path('output/pdf'); labels=json.loads((base/f'timetable-pdf-{scenario}.json').read_text())
img=Image.open(base/f'timetable-pdf-{scenario}.png').convert('RGB'); W,H=img.size
scale=min((W*287/297)/1400,(H*200/210)/976)
ox=(W-1400*scale)/2; oy=(H-976*scale)/2
fail=[]; checked=0
for label in labels:
 x,y,w,h=label['x'],label['y'],label['width'],label['height']; ink=label['ink']
 if not ink: fail.append((label['text'],'empty source'));continue
 if min(ink[0],ink[1],w-ink[2],h-ink[3])<1.8: fail.append((label['text'],'source touches border',ink))
 left,top,right,bottom=[int(round(v)) for v in [ox+(x+1.8)*scale,oy+(y+1.8)*scale,ox+(x+w-1.8)*scale,oy+(y+h-1.8)*scale]]
 crop=np.asarray(img.crop((left,top,right,bottom)))
 ys,xs=np.where(crop.mean(axis=2)<200)
 if len(xs)==0:fail.append((label['text'],'empty PDF'));continue
 actual=[(xs.min()+left-ox)/scale-x,(ys.min()+top-oy)/scale-y,(xs.max()+1+left-ox)/scale-x,(ys.max()+1+top-oy)/scale-y]
 if max(abs(a-b) for a,b in zip(actual,ink))>3: fail.append((label['text'],'ink differs',actual,ink))
 checked+=1
print(scenario,':',checked,'exported labels compared to preview bitmap bounds;',len(fail),'failures')
for failure in fail[:10]:print(failure)
assert not fail

