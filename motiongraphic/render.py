"""TOKEN / TO / ACTION — original procedural motion film, 15 seconds.
Run with the bundled Python runtime; local .render-deps supplies FFmpeg.
"""
from pathlib import Path
import sys, math, subprocess, wave, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from functools import lru_cache

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / '.render-deps'))
import imageio_ffmpeg
W,H,FPS,DURATION = 1920,1080,60,15
OUT=ROOT/'output'; OUT.mkdir(exist_ok=True)
INK=(13,15,18); PAPER=(243,241,229); ACID=(219,255,0); VIOLET=(163,141,255)
MUTED=(130,137,141)

@lru_cache(None)
def font(size,kind='bold'):
    file={'bold':'arialbd.ttf','narrow':'ARIALNB.TTF','mono':'consola.ttf','regular':'arial.ttf'}[kind]
    return ImageFont.truetype('C:/Windows/Fonts/'+file,int(size))
def ease(x):
    x=max(0,min(1,x)); return 1-(1-x)**4
def smooth(x):
    x=max(0,min(1,x)); return x*x*(3-2*x)
def mix(a,b,t): return tuple(int(x+(y-x)*t) for x,y in zip(a,b))
def txt(d,s,x,y,size=60,color=PAPER,kind='bold',anchor=None):
    d.text((int(x),int(y)),s,font=font(size,kind),fill=color,anchor=anchor,stroke_width=0)
def width(s,size,kind='bold'): return font(size,kind).getlength(s)
def reveal(im,s,x,y,size,color=PAPER,t=1,delay=0,kind='bold'):
    p=ease((t-delay)/.55)
    if p<=0:return
    layer=Image.new('RGB',(W,int(size*1.35)),INK)
    # Render on transparent layer, then clip the rising glyphs to a baseline mask.
    layer=Image.new('RGBA',(W,int(size*1.4)))
    d=ImageDraw.Draw(layer); txt(d,s,x,(1-p)*size*1.3,size,color,kind)
    im.paste(layer,(0,int(y)),layer)
def line(d,p,q,color=PAPER,w=2):d.line((p,q),fill=color,width=w)
def star(d,x,y,r,col,angle=0):
    for k in range(8):
        a=angle+k*math.pi/8
        line(d,(x-math.cos(a)*r,y-math.sin(a)*r),(x+math.cos(a)*r,y+math.sin(a)*r),col,5)
def arrow(d,x,y,length,col=INK):
    line(d,(x,y),(x+length,y),col,9)
    line(d,(x+length,y),(x+length-32,y-32),col,9)
    line(d,(x+length,y),(x+length-32,y+32),col,9)
def chrome(im,t,chapter,light=False):
    d=ImageDraw.Draw(im); c=INK if light else PAPER
    txt(d,'LATENT / HISTORY IN MOTION',72,43,23,c,'mono')
    txt(d,chapter,1848,43,23,c,'mono','ra')
    line(d,(72,93),(1848,93),mix(c,ACID if light else INK,.65))
    line(d,(72,1000),(1848,1000),mix(c,ACID if light else INK,.65))
    line(d,(72,1000),(72+1776*t/15,1000),c,4)
    txt(d,'2017 — 2026',72,1020,21,c,'mono')
    txt(d,f'{int(t):02d}:{int(t*60)%60:02d} / 00:15',1848,1020,21,c,'mono','ra')
    for i in range(8):
        x=835+i*35; d.rectangle((x,1030,x+17,1034),fill=c if t>i*15/8 else mix(c,ACID if light else INK,.8))

def lattice(d,t,cx,cy,r,col=ACID,mode=0):
    # Perspective-projected, rotating toroidal neural lattice.
    pts=[]
    a=t*.63; b=.55+math.sin(t*.32)*.35
    for i in range(48):
        u=i*math.tau/48
        row=[]
        for j in range(16):
            v=j*math.tau/16
            R=.73+.25*math.cos(v)
            x=R*math.cos(u); y=R*math.sin(u); z=.25*math.sin(v)
            x,z=x*math.cos(a)+z*math.sin(a),-x*math.sin(a)+z*math.cos(a)
            y,z=y*math.cos(b)-z*math.sin(b),y*math.sin(b)+z*math.cos(b)
            p=3.5/(3.5-z)
            row.append((cx+x*r*p,cy+y*r*p,z))
        pts.append(row)
    for i in range(48):
        for j in range(16):
            p=pts[i][j]; q=pts[(i+1)%48][j]; s=pts[i][(j+1)%16]
            c=mix(INK,col,.25+.65*(p[2]+1)/2)
            line(d,p[:2],q[:2],c,2); line(d,p[:2],s[:2],c,1)
            if (i+j)%7==0:
                x,y=p[:2];d.ellipse((x-3,y-3,x+3,y+3),fill=col)

def scene(index,u,t):
    light=index in (2,4)
    bg=ACID if light else INK
    im=Image.new('RGB',(W,H),bg); d=ImageDraw.Draw(im)
    if index==0:
        lattice(d,t,1510,535,450,VIOLET)
        txt(d,'A SHORT HISTORY OF MACHINE INTELLIGENCE',78,156,25,ACID,'mono')
        reveal(im,'TOKEN',63,215,260,t=u)
        reveal(im,'TO ACTION.',67,478,230,ACID,u,.13)
        d=ImageDraw.Draw(im)
        txt(d,'Nine years. A different world.',80,835,40,PAPER,'regular')
        arrow(d,81,940,185,ACID)
        txt(d,'15 SECONDS / SELECTED MILESTONES',330,921,25,MUTED,'mono')
    elif index==1:
        txt(d,'01 / THE ARCHITECTURE',78,151,27,ACID,'mono')
        reveal(im,'2017',64,211,215,PAPER,u)
        reveal(im,'ATTENTION',74,475,137,ACID,u,.08)
        reveal(im,'CHANGES EVERYTHING.',78,627,58,PAPER,u,.19)
        txt(d,'The Transformer',80,807,41,PAPER,'regular')
        txt(d,'RELATIONSHIPS BECOME COMPUTATION',80,874,24,MUTED,'mono')
        # Attention matrix with sweeps that trace dependencies.
        gx,gy,sz=1180,218,58
        for i in range(10):
            for j in range(10):
                v=(math.sin(i*2.2+j*3.1-u*3)+1)/2
                col=mix(INK,ACID,.12+.72*v if j<=i else .05)
                x=gx+j*sz;y=gy+i*sz
                d.rounded_rectangle((x,y,x+49,y+49),radius=4,fill=col)
        scan=gy+(u*.65%1)*sz*10
        line(d,(gx-20,scan),(gx+580,scan),PAPER,3)
        txt(d,'Q × K → V',gx,858,42,ACID,'mono')
    elif index==2:
        txt(d,'02 / SCALE',78,151,27,INK,'mono')
        # Giant numerical type with tightly spaced vertical hierarchy.
        txt(d,'2018  GPT',80,237,53,INK,'mono')
        txt(d,'2019  GPT-2',80,323,53,INK,'mono')
        p=ease(u/.65)
        txt(d,'2020',80,448,72,INK,'mono')
        txt(d,'GPT-3',67+(1-p)*-550,520,265,INK,'narrow')
        txt(d,'LANGUAGE AT SCALE.',83,851,47,INK)
        # Extruded ascending bars, camera-like parallax.
        for i in range(12):
            x=1040+i*62; ht=(90+i*i*4.1)*ease((u-i*.025)/.85)*(1+.025*math.sin(u*6+i*.65))
            y=846-ht
            d.polygon([(x,y),(x+40,y-25),(x+40,821),(x,846)],fill=INK)
            d.polygon([(x,y),(x+40,y-25),(x+57,y-18),(x+17,y+7)],fill=(85,103,0))
            d.polygon([(x+17,y+7),(x+57,y-18),(x+57,827),(x+17,852)],fill=(44,54,0))
        txt(d,'175B',1055,180,148,INK,'narrow')
        txt(d,'PARAMETERS',1062,345,32,INK,'mono')
    elif index==3:
        txt(d,'03 / THE INTERFACE',78,151,27,ACID,'mono')
        txt(d,'2022',73,220,153,PAPER)
        reveal(im,'HELLO,',70,415,200,PAPER,u)
        reveal(im,'ChatGPT.',72,621,173,ACID,u,.12)
        # Cascading conversational cards at right.
        for k,(s,sub) in enumerate([('You','What if we could talk?'),('ChatGPT','Let’s start a conversation.'),('The world','A new interface begins.')]):
            p=ease((u-k*.18)/.6);x=1090+(1-p)*800;y=220+k*205+5*math.sin(u*3+k)
            if p>0:
                d.rounded_rectangle((x,y,x+740,y+166),radius=24,fill=(28,32,35),outline=(65,71,68),width=2)
                d.ellipse((x+27,y+27,x+42,y+42),fill=ACID if k==1 else VIOLET)
                txt(d,s,x+60,y+21,24,ACID,'mono')
                typed=sub[:max(0,int((u-k*.18-.15)*65))]
                txt(d,typed,x+28,y+80,34,PAPER,'regular')
        txt(d,'NOVEMBER 30 / CHAT GOES MAINSTREAM',80,886,25,MUTED,'mono')
    elif index==4:
        txt(d,'04 / A NEW ECOSYSTEM',78,151,27,INK,'mono')
        txt(d,'2023',1450,155,90,INK,'narrow')
        labels=[('GPT-4',80,270),('CLAUDE',650,455),('GEMINI',1070,650)]
        for k,(s,x,y) in enumerate(labels):
            p=ease((u-k*.11)/.6)
            txt(d,s,x+(1-p)*650,y,166,INK,'narrow')
            line(d,(80,y+178),(1835,y+178),INK,2)
            txt(d,f'0{k+1}',80 if k>0 else 1700,y+90,28,INK,'mono')
        star(d,1570,395,75,INK,u)
        txt(d,'THE FIELD EXPANDS.',80,892,39,INK)
    elif index==5:
        txt(d,'05 / REASONING',78,151,27,ACID,'mono')
        txt(d,'2024',75,235,130,PAPER)
        reveal(im,'THINK',66,397,241,PAPER,u)
        reveal(im,'DEEPER.',72,643,165,VIOLET,u,.10)
        txt(d,'o1 / REASONING MODELS',80,883,30,ACID,'mono')
        cx,cy=1450,531
        for k in range(7):
            r=100+k*44; a=u*90*(1 if k%2 else -1)+k*25
            d.arc((cx-r,cy-r,cx+r,cy+r),a,a+260,fill=mix(INK,VIOLET,.25+k*.1),width=3 if k%2 else 7)
        star(d,cx,cy,85,ACID,-u*.5)
        for k,s in enumerate(['PLAN','REASON','REFINE']):
            txt(d,s,1220+k*225,933,24,PAPER,'mono','ma')
    elif index==6:
        txt(d,'06 / THE AGENT SHIFT',78,151,27,ACID,'mono')
        txt(d,'2025',75,211,133,PAPER)
        reveal(im,'TAKE',66,374,231,ACID,u)
        reveal(im,'ACTION.',73,620,191,PAPER,u,.09)
        txt(d,'CHATGPT AGENT / TOOLS + MULTISTEP WORK',80,902,26,MUTED,'mono')
        cx,cy=1430,510
        nodes=[(1430,245,'PLAN'),(1130,510,'BROWSE'),(1730,510,'CODE'),(1430,795,'DELIVER')]
        for k,(x,y,s) in enumerate(nodes):
            line(d,(cx,cy),(x,y),(75,84,63),3)
            p=(u*.9+k*.25)%1
            px=cx+(x-cx)*p;py=cy+(y-cy)*p
            d.ellipse((px-7,py-7,px+7,py+7),fill=ACID)
            d.rounded_rectangle((x-112,y-47,x+112,y+47),radius=15,fill=(26,31,28),outline=ACID,width=2)
            txt(d,s,x,y-17,29,PAPER,'mono','ma')
        d.ellipse((cx-108,cy-108,cx+108,cy+108),fill=ACID)
        star(d,cx,cy,68,INK,u*.5)
    else:
        # Final device: the lattice becomes a connected, orbiting world.
        lattice(d,t,1515,523,415,VIOLET)
        txt(d,'07 / NOW',78,151,27,ACID,'mono')
        reveal(im,'FROM WORDS',72,237,136,PAPER,u)
        reveal(im,'TO WORLDS.',64,396,171,ACID,u,.12)
        txt(d,'2026',78,659,84,PAPER,'narrow')
        txt(d,'GPT-6.1 Sol  /  Claude Opus 5.5',80,778,39,PAPER,'regular')
        txt(d,'MODELS REASON. AGENTS ACT.',80,859,29,ACID,'mono')
        txt(d,'AS OF 07 OCT 2026',80,925,21,MUTED,'mono')
        star(d,1728,842,47,ACID,u*.3)
    chrome(im,t,['00 / PROLOGUE','01 / ATTENTION','02 / SCALE','03 / CONVERSATION','04 / EXPANSION','05 / REASONING','06 / AGENCY','07 / PRESENT'][index],light)
    return im

STARTS=[0,1.5,3.5,5.5,7.5,9,10.5,12.5]
def frame(t):
    idx=max(i for i,s in enumerate(STARTS) if t>=s)
    u=t-STARTS[idx]
    im=scene(idx,u,t)
    # Fast diagonal shutter across cuts. Previous image exits under a moving blade.
    if idx>0 and u<.19:
        p=ease(u/.19)
        old=scene(idx-1,t-STARTS[idx-1],t)
        mask=Image.new('L',(W,H),0);md=ImageDraw.Draw(mask)
        x=-420+(W+840)*p
        md.polygon([(0,0),(x,0),(x-300,H),(0,H)],fill=255)
        im=Image.composite(im,old,mask)
        d=ImageDraw.Draw(im);d.polygon([(x-32,0),(x,0),(x-300,H),(x-332,H)],fill=VIOLET)
    return im

def audio():
    sr=48000; n=15*sr; out=np.zeros((n,2),dtype=np.float64); rng=np.random.default_rng(41)
    def add(start,a,vol=1,pan=0):
        at=int(start*sr);end=min(n,at+len(a))
        if end>at:
            out[at:end,0]+=a[:end-at]*vol*math.sqrt((1-pan)/2)
            out[at:end,1]+=a[:end-at]*vol*math.sqrt((1+pan)/2)
    # 120 BPM. Every narrative edit falls on the musical grid.
    for k in range(30):
        tt=np.arange(int(sr*.38))/sr
        freq=48+110*np.exp(-tt*35)
        phase=2*np.pi*np.cumsum(freq)/sr
        kick=np.sin(phase)*np.exp(-tt*12)+rng.normal(0,.1,len(tt))*np.exp(-tt*100)
        add(k*.5,kick,.72)
        if k%2:
            tt=np.arange(int(sr*.17))/sr
            noise=rng.normal(0,1,len(tt)); noise=np.concatenate(([0],np.diff(noise)))
            snare=(noise*.23+np.sin(2*np.pi*185*tt)*.2)*np.exp(-tt*24)
            add(k*.5,snare,.65)
    for k in range(120):
        tt=np.arange(int(sr*.06))/sr
        noise=rng.normal(0,1,len(tt)); noise=np.concatenate(([0],np.diff(noise)))
        add(k*.125,noise*np.exp(-tt*85),.033 if k%2 else .06,(-1)**k*.55)
    notes=[55,55,82.4069,65.4064,55,110,82.4069,73.4162]
    for k in range(60):
        tt=np.arange(int(sr*.23))/sr;f=notes[k%8]
        bass=(np.sin(2*np.pi*f*tt)+.24*np.sin(2*np.pi*2*f*tt)+.12*np.sin(2*np.pi*3*f*tt))
        env=np.minimum(tt/.012,1)*np.exp(-tt*12)
        add(k*.25,bass*env,.27)
        f2=f*8*(2 if k%3==0 else 1)
        pluck=(np.sin(2*np.pi*f2*tt)+.25*np.sin(2*np.pi*f2*2.003*tt))*np.exp(-tt*21)*np.minimum(tt/.005,1)
        add(k*.25,pluck,.09,math.sin(k)*.65)
        add(k*.25+.1875,pluck,.035,-math.sin(k)*.65)
    for start in STARTS[1:]:
        tt=np.arange(int(sr*.34))/sr
        noise=rng.normal(0,1,len(tt));noise=np.convolve(noise,np.ones(10)/10,mode='same')
        env=np.sin(np.pi*np.arange(len(tt))/len(tt))**2
        add(start-.17,noise*env,.30)
        tt=np.arange(int(sr*.55))/sr
        hit=np.sin(2*np.pi*(65*tt+8*(1-np.exp(-tt*10))))*np.exp(-tt*10)
        add(start,hit,.35)
    # Shimmering final chord.
    tt=np.arange(int(sr*2.5))/sr
    chord=sum(np.sin(2*np.pi*f*tt)*.17 for f in [220,261.6256,329.6276,440,659.255])
    add(12.5,chord*np.minimum(tt/.04,1)*np.exp(-tt*1.25),.28)
    out=np.tanh(out*1.2);out*=.91/max(1,np.max(np.abs(out)))
    out[-int(sr*.18):]*=np.linspace(1,0,int(sr*.18))[:,None]
    with wave.open(str(OUT/'score.wav'),'wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(sr);f.writeframes((out*32767).astype('<i2').tobytes())

def contact():
    times=[.95,2.65,4.75,6.75,8.45,9.9,11.7,14.2]
    sheet=Image.new('RGB',(1280,1440),INK)
    for i,t in enumerate(times):sheet.paste(frame(t).resize((640,360),Image.Resampling.LANCZOS),((i%2)*640,(i//2)*360))
    sheet.save(OUT/'storyboard.jpg',quality=94)
    frame(14.2).save(OUT/'poster.jpg',quality=96)

def render():
    audio();contact();ff=imageio_ffmpeg.get_ffmpeg_exe()
    cmd=[ff,'-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(OUT/'score.wav'),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','256k','-t','15','-movflags','+faststart',str(OUT/'TOKEN-TO-ACTION.mp4')]
    with open(OUT/'render.log','w') as log:
        p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        for i in range(FPS*DURATION):
            p.stdin.write(frame(i/FPS).tobytes())
            if i%60==0:print(f'Rendered {i//60}/15 seconds',flush=True)
        p.stdin.close()
        if p.wait()!=0:raise RuntimeError('FFmpeg failed; see output/render.log')
    print('Complete:',OUT/'TOKEN-TO-ACTION.mp4',flush=True)

if __name__=='__main__':
    if '--preview' in sys.argv:contact()
    else:render()
