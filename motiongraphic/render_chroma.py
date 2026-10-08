"""CHROMA: graphics-first, 15s model evolution film. No external visual assets."""
from pathlib import Path
import math, sys, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
from functools import lru_cache

ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'.render-deps'))
import imageio_ffmpeg
W,H,FPS=1920,1080,60
OUT=ROOT/'output-chroma'; OUT.mkdir(exist_ok=True)
TAU=math.tau
PAL=[(82,248,219),(189,255,61),(110,255,187),(255,120,79),(47,209,255),(255,178,29),(180,129,255),(249,88,211),(42,176,255),(227,255,125)]
LABELS=['Transformer','GPT-3','ChatGPT','Claude','Llama 2','Mistral 7B','Gemini','Qwen2.5','DeepSeek-R1','Agents']
YEARS=['2017','2020','2022','2023','2023','2023','2023','2024','2025','2026']
BG=[((6,16,45),(3,75,94)),((17,7,52),(75,15,84)),((0,43,42),(9,106,86)),((62,15,53),(120,30,29)),((5,15,68),(7,76,127)),((83,15,35),(149,38,4)),((26,9,68),(74,27,123)),((37,6,66),(100,16,102)),((1,16,62),(4,65,103)),((10,9,30),(34,27,68))]
def blend(a,b,p):return tuple(int(x*(1-p)+y*p) for x,y in zip(a,b))
def ease(x):x=max(0,min(1,x));return x*x*(3-2*x)
def lerp(a,b,t):return a+(b-a)*t
def circle(d,x,y,r,c,outline=None,width=1):
    if r>0:d.ellipse((x-r,y-r,x+r,y+r),fill=c,outline=outline,width=width)
def line(d,pts,c,w=2):d.line(pts,fill=c,width=w,joint='curve')
@lru_cache(None)
def font(n):return ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',n)
def text(d,s,x,y,n,c=(247,246,252),anchor='mm'):d.text((x,y),s,font=font(n),fill=c,anchor=anchor)
def project(p,t,scale=1,cx=960,cy=510):
    p=np.asarray(p,dtype=float).copy();a=t*.55;b=.42+math.sin(t*.31)*.22
    x=p[:,0]*math.cos(a)+p[:,2]*math.sin(a);z=-p[:,0]*math.sin(a)+p[:,2]*math.cos(a)
    y=p[:,1]*math.cos(b)-z*math.sin(b);z=p[:,1]*math.sin(b)+z*math.cos(b)
    f=1450/(1450-z)
    return np.column_stack((cx+x*f*scale,cy+y*f*scale,z))
@lru_cache(None)
def background(k):
    yy,xx=np.mgrid[0:270,0:480];a,b=BG[k]
    f=np.exp(-(((xx-290)/210)**2+((yy-100)/135)**2))
    arr=np.array(a)[None,None,:]*(1-f[:,:,None])+np.array(b)[None,None,:]*f[:,:,None]
    rng=np.random.default_rng(k);arr+=rng.normal(0,.6,(270,480,1))
    return Image.fromarray(np.uint8(np.clip(arr,0,255))).resize((W,H),Image.Resampling.BILINEAR)

def atmosphere(d,k,t):
    for j in range(95):
        x=(j*379.13+math.sin(j*2.1+t)*25+t*(15+j%7))%W
        y=(j*181.73+math.cos(j+t*.7)*30)%H
        r=1+j%3
        circle(d,x,y,r,blend(BG[k][0],PAL[(j+k)%10],.28))
    # Tiny moving constellations occupy the full frame, not a side panel.
    for j in range(9):
        x=(j*251+t*50)%2100-90;y=120+(j*163)%810
        c=blend(BG[k][0],PAL[k],.35)
        line(d,[(x-8,y),(x+8,y)],c,2);line(d,[(x,y-8),(x,y+8)],c,2)

def transformer(d,u,t):
    # Three revolving token grids connected by traveling signals.
    points=[]
    for layer in range(3):
        for row in range(7):
            for col in range(7):points.append(((col-3)*104,(row-3)*103,(layer-1)*290))
    p=project(points,t+.5,1.05)
    for l in range(2):
        for j in range(0,49,3):
            a=p[l*49+j];b=p[(l+1)*49+(j*13)%49]
            line(d,[tuple(a[:2]),tuple(b[:2])],(38,113,139),2)
            q=(u*1.3+j*.11)%1;v=a+(b-a)*q
            circle(d,*v[:2],4,(231,255,138))
    for j in np.argsort(p[:,2]):
        x,y,z=p[j];r=13+(z+550)/130
        c=PAL[0] if j%4 else PAL[1]
        c=blend((12,61,74),c,.4+.6*(math.sin(j*1.9-u*6)*.5+.5))
        d.rounded_rectangle((x-r,y-r,x+r,y+r),radius=5,fill=c)
    for q in range(3):
        r=420+q*40+math.sin(u*3+q)*12
        d.arc((960-r*1.65,510-r*.83,960+r*1.65,510+r*.83),u*45+q*80,u*45+q*80+90,fill=PAL[q],width=3)

def gpt(d,u,t):
    # A Fibonacci galaxy breathing into a high-density spherical neural net.
    n=850;i=np.arange(n);z=1-2*(i+.5)/n;a=i*2.399963
    r=np.sqrt(1-z*z);breath=1+.055*math.sin(u*7)
    pts=np.column_stack((r*np.cos(a),z,r*np.sin(a)))*340*breath
    p=project(pts,t*1.65,1.18)
    for j in np.argsort(p[:,2]):
        x,y,z=p[j];c=blend((74,27,125),PAL[j%3],(z+450)/900)
        circle(d,x,y,2.5+(z+420)/140,c)
        if j%4==0 and j+13<n:line(d,[tuple(p[j,:2]),tuple(p[j+13,:2])],blend(BG[1][0],c,.38),1)
    for j in range(90):
        a=j*TAU/90+u*.5;r=470+50*math.sin(j*.63+u*2)
        x=960+math.cos(a)*r*1.75;y=510+math.sin(a)*r
        circle(d,x,y,3+j%5,PAL[j%10])
        if j%3==0:line(d,[(x,y),(960+math.cos(a)*r*1.95,510+math.sin(a)*r*1.12)],PAL[j%10],2)

def chat(d,u,t):
    # Rubber-like chat capsules orbit an interlocking six-petal core.
    for j in range(16):
        a=j*TAU/16+u*.36;r=500+35*math.sin(j+u*4)
        x=960+math.cos(a)*r*1.52;y=505+math.sin(a)*r*.78
        ww=65+18*math.sin(u*3+j);hh=32
        c=PAL[(j+2)%10]
        d.rounded_rectangle((x-ww,y-hh,x+ww,y+hh),radius=28,fill=c)
        d.polygon([(x+ww-35,y+20),(x+ww-12,y+50),(x+ww-10,y+20)],fill=c)
        for n in range(3):circle(d,x-24+n*24,y,5,BG[2][0])
    for j in range(6):
        pts=[]
        for q in np.linspace(0,TAU,100):
            a=j*TAU/6+u*.5;rr=210+28*math.sin(u*5)
            x=rr*math.cos(a)+150*math.cos(q);y=rr*math.sin(a)+95*math.sin(q)
            pts.append((960+x,505+y))
        line(d,pts,blend(PAL[2],(231,255,243),j/7),26)
    circle(d,960,505,58,(217,255,61));circle(d,960,505,23,BG[2][0])

def claude(d,u,t):
    # A kinetic coral sun; independent spokes wave, twist and breathe.
    for ring in range(3):
        for j in range(28):
            a=j*TAU/28+u*(.22 if ring%2 else -.2)+ring*.06
            r0=80+ring*92+25*math.sin(u*4+j*.65)
            r1=r0+110+65*math.sin(j*.75+u*4)
            pts=[]
            for f in np.linspace(0,1,22):
                r=lerp(r0,r1,f);aa=a+math.sin(f*math.pi)*.11*math.sin(u*3+j)
                pts.append((960+math.cos(aa)*r*1.18,500+math.sin(aa)*r))
            line(d,pts,[PAL[3],(255,203,133),(252,83,150)][ring],22-ring*4)
            circle(d,*pts[-1],11-ring*2,[PAL[3],(255,203,133),(252,83,150)][ring])
    for j in range(28):
        a=j*2.4+u*.5;r=470+j%4*65
        circle(d,960+math.cos(a)*r*1.35,500+math.sin(a)*r*.8,7+j%9,PAL[(j+3)%10])
    circle(d,960,500,43+10*math.sin(u*8),(255,222,188))

def llama(d,u,t):
    # Iridescent three-dimensional ribbons cross and uncross like a living fabric.
    segments=[]
    for k in range(13):
        v=np.linspace(0,TAU,140)
        a=v+u*.85+k*.018
        rr=295+70*np.cos(3*v+u*2)+k*6
        points=np.column_stack((rr*np.cos(a)*1.5,rr*np.sin(a),120*np.sin(2*v+u*2)+k*8-48))
        p=project(points,t*.6,1.02)
        for j in range(len(p)-1):segments.append((p[j,2],p[j,:2],p[j+1,:2],k,j))
    for z,p,q,k,j in sorted(segments,key=lambda a:a[0]):
        col=blend((25,113,236),(95,255,224),k/12)
        if j%28<5:col=blend(col,(247,159,255),.7)
        line(d,[tuple(p),tuple(q)],col,6)
    for j in range(36):
        a=j*TAU/36-u*.6;r=490+40*math.sin(j+u)
        x=960+math.cos(a)*r*1.5;y=500+math.sin(a)*r*.8
        circle(d,x,y,5+j%4,PAL[j%10])

def mistral(d,u,t):
    # Isometric voxel waterfall, all columns moving on phase-shifted springs.
    blocks=[]
    for i in range(-7,8):
        for j in range(-7,8):
            r=math.sqrt(i*i+j*j)
            if r>8:continue
            ht=65+150*(.5+.5*math.sin(r*.8-u*5))+80*math.exp(-r*r/14)
            x=960+(i-j)*48;y=530+(i+j)*25
            blocks.append((i+j,x,y,ht,i,j))
    for _,x,y,ht,i,j in sorted(blocks):
        c=[(255,72,61),(255,134,26),(255,194,49),(255,222,139)][(i-j)%4]
        d.polygon([(x-43,y-ht),(x,y-ht-22),(x+43,y-ht),(x,y-ht+22)],fill=c)
        d.polygon([(x-43,y-ht),(x,y-ht+22),(x,y+35),(x-43,y+13)],fill=blend(c,(81,9,64),.3))
        d.polygon([(x,y-ht+22),(x+43,y-ht),(x+43,y+13),(x,y+35)],fill=blend(c,(81,9,64),.6))
    for j in range(30):
        x=(j*217+u*160)%1920;y=70+(j*147)%830
        r=7+j%8;d.rectangle((x-r,y-r,x+r,y+r),fill=PAL[(j+3)%10])

def gemini(d,u,t):
    # Nested star portals rotate at alternating speeds and telescope past camera.
    for k in range(24,0,-1):
        phase=(k/24+u*.19)%1
        r=40+phase**1.5*1100
        a=u*.26+k*.045
        pts=[]
        for q in np.linspace(0,TAU,160):
            rr=r*(.52+.48*abs(math.cos(2*q))**3)
            pts.append((960+rr*math.cos(q+a)*1.3,505+rr*math.sin(q+a)))
        c=blend((83,97,255),(255,115,217),phase)
        if k%4==0:c=(112,231,255)
        line(d,pts,c,5+int(phase*11))
    for cx,cy,r in [(740,440,105),(1160,580,80)]:
        a=-u*.7;pts=[]
        for q in np.linspace(0,TAU,100):
            rr=r*(.25+.75*abs(math.cos(2*q))**4)
            pts.append((cx+math.cos(q+a)*rr,cy+math.sin(q+a)*rr))
        d.polygon(pts,fill=(241,236,255))

def qwen(d,u,t):
    # A woven torus knot, depth-sorted into hundreds of colorful beads.
    v=np.linspace(0,TAU,620)
    a=v+u*.4;rr=270+110*np.cos(3*v+u)
    pts=np.column_stack((rr*np.cos(2*a),rr*np.sin(2*a),150*np.sin(3*v+u)))
    p=project(pts,t*.9,1.1)
    for j in np.argsort(p[:,2]):
        x,y,z=p[j];r=12+(z+200)/60
        c=blend((112,71,254),(255,95,212),j/620)
        if j%100<25:c=blend(c,(107,245,248),.8)
        circle(d,x,y,r,c)
        circle(d,x-r*.22,y-r*.3,r*.28,blend(c,(255,255,255),.55))
    for j in range(5):
        r=440+j*48
        d.arc((960-r*1.5,510-r,960+r*1.5,510+r),u*45+j*70,u*45+j*70+100,fill=PAL[(j+4)%10],width=3)

def deepseek(d,u,t):
    # A luminous fluid sheet rises into a wave; camera flies along the surface.
    for j in range(37):
        pts=[]
        for i in range(101):
            x=-80+i*21
            wave=math.sin(i*.066-u*2.8+j*.075)*165+math.sin(i*.11+u*2+j*.1)*50
            y=210+j*14+wave*(.55+math.sin(j/37*math.pi)*.8)
            pts.append((x,y))
        c=blend((20,97,237),(96,252,248),j/37)
        line(d,pts,c,4)
        for i in range((j%4)*5,100,20):circle(d,*pts[i],4,(210,247,255))
    for j in range(65):
        x=(j*163+u*155)%1920;y=(j*117-u*85)%900
        circle(d,x,y,2+j%4,blend((26,83,169),(248,215,255),j%7/7))

def agents(d,u,t):
    # Independent colored modules organize into an active multi-tool system.
    centers=[]
    for j in range(8):
        a=j*TAU/8-math.pi/2+u*.11
        centers.append((960+math.cos(a)*570,490+math.sin(a)*325))
    for j,(x,y) in enumerate(centers):
        for k in [1,3]:
            q=centers[(j+k)%8]
            line(d,[(x,y),q],blend(BG[9][0],PAL[j],.37),2)
        line(d,[(x,y),(960,490)],blend(BG[9][0],PAL[j],.65),3)
        for k in range(4):
            p=(u*.9+k*.25+j*.04)%1
            circle(d,lerp(x,960,p),lerp(y,490,p),5,PAL[j])
    for j,(x,y) in enumerate(centers):
        r=52+8*math.sin(u*5+j)
        for k in range(8):
            a=k*TAU/8+u*(1 if j%2 else -1)
            circle(d,x+math.cos(a)*r,y+math.sin(a)*r,9,PAL[j])
        circle(d,x,y,29,PAL[j]);circle(d,x,y,11,BG[9][0])
    # Tool tiles revolve around a multicolor reactor.
    for j in range(48):
        a=j*TAU/48-u*.7;r=130+15*math.sin(j*.7+u*4)
        x=960+math.cos(a)*r;y=490+math.sin(a)*r
        circle(d,x,y,13,PAL[j%10])
    for j in range(3):
        r=73+j*12;d.arc((960-r,490-r,960+r,490+r),u*110+j*90,u*110+j*90+230,fill=PAL[j*3],width=7)
    # Only model names, no explanatory copy.
    for s,x,y in [('GPT-6.1 Sol',425,870),('Opus 5.5',1495,870)]:text(d,s,x,y,30)

FUNCS=[transformer,gpt,chat,claude,llama,mistral,gemini,qwen,deepseek,agents]
def shot(k,u,t,label=True):
    im=background(k).copy();d=ImageDraw.Draw(im)
    atmosphere(d,k,t)
    # Every scene uses the entire canvas for a moving graphic system.
    FUNCS[k](d,u,t)
    # Restrained bloom softens the luminous high-frequency geometry.
    small=im.resize((480,270),Image.Resampling.BILINEAR).filter(ImageFilter.GaussianBlur(5))
    bloom=small.resize((W,H),Image.Resampling.BILINEAR)
    im=ImageChops.add(im,bloom,scale=1.13)
    if label:
        d=ImageDraw.Draw(im)
        # A single unobtrusive model name, with a small chronological marker.
        c=PAL[k];name=LABELS[k];tw=font(40).getlength(name)
        d.rounded_rectangle((960-tw/2-37,953,960+tw/2+37,1022),radius=34,fill=(12,15,28))
        circle(d,960-tw/2-15,989,4,c)
        text(d,name,972,989,40)
        text(d,YEARS[k],91,994,24,blend(c,(255,255,255),.35))
        for j in range(10):
            circle(d,1660+j*19,994,4,PAL[j] if j<=k else (75,64,88))
    return im

def frame(t):
    k=min(9,int(t/1.5));u=t-k*1.5
    im=shot(k,u,t)
    if k and u<.30:
        # A moving, colored iris carries the viewer into the next visual world.
        p=ease(u/.30);old=shot(k-1,1.5+u,t)
        mask=Image.new('L',(W,H));md=ImageDraw.Draw(mask)
        cx=960+320*math.sin(k*2.1);cy=480+150*math.cos(k)
        r=2400*p
        md.ellipse((cx-r,cy-r,cx+r,cy+r),fill=255)
        im=Image.composite(im,old,mask)
        if p>.01 and p<.95:
            d=ImageDraw.Draw(im);d.ellipse((cx-r,cy-r,cx+r,cy+r),outline=PAL[k],width=12)
    return im

def score():
    sr=48000;n=sr*15;a=np.zeros((n,2));rng=np.random.default_rng(220)
    def put(start,s,amp=1,pan=0):
        i=int(start*sr);end=min(n,i+len(s))
        if i<0:s=s[-i:];i=0
        if end<=i:return
        a[i:end,0]+=s[:end-i]*amp*math.sqrt((1-pan)/2)
        a[i:end,1]+=s[:end-i]*amp*math.sqrt((1+pan)/2)
    # 160 BPM — four beats per visual world.
    beat=.375
    for j in range(40):
        t=np.arange(int(sr*.34))/sr
        f=46+135*np.exp(-t*32)
        kick=np.sin(TAU*np.cumsum(f)/sr)*np.exp(-t*14)
        put(j*beat,kick,.8)
        if j%2:
            t=np.arange(int(sr*.18))/sr
            sn=(rng.normal(0,.35,len(t))+np.sin(TAU*190*t)*.2)*np.exp(-t*24)
            put(j*beat,sn,.5)
    notes=[55,82.4069,110,65.4064,55,98,82.4069,73.4162]
    for j in range(160):
        t=np.arange(int(sr*.045))/sr;noise=rng.normal(0,1,len(t));noise=np.r_[0,np.diff(noise)]
        put(j*beat/4,noise*np.exp(-t*110),.028 if j%2 else .055,math.sin(j)*.7)
        if j%2==0:
            t=np.arange(int(sr*.18))/sr;f=notes[(j//2)%8]
            s=(np.sin(TAU*f*t)+.3*np.sin(TAU*2*f*t)+.15*np.sin(TAU*3*f*t))*np.exp(-t*15)*np.minimum(t/.006,1)
            put(j*beat/4,s,.32)
            lead=np.sin(TAU*f*8*t+1.2*np.sin(TAU*f*4*t))*np.exp(-t*24)*np.minimum(t/.004,1)
            put(j*beat/4,lead,.105,math.sin(j*.4)*.6)
            put(j*beat/4+.14,lead,.035,-math.sin(j*.4)*.6)
    for k in range(1,10):
        t=np.arange(int(sr*.38))/sr
        noise=rng.normal(0,1,len(t));noise=np.convolve(noise,np.ones(8)/8,mode='same')
        env=np.sin(np.linspace(0,math.pi,len(t)))**2
        put(k*1.5-.17,noise*env,.38)
        t=np.arange(int(sr*.55))/sr
        s=np.sin(TAU*(180*t-70*t*t))*np.exp(-t*12)
        put(k*1.5,s,.28)
    t=np.arange(int(sr*1.5))/sr
    chord=sum(np.sin(TAU*f*t) for f in [220,261.63,329.63,493.88])*.08
    put(13.5,chord*np.minimum(t/.015,1)*np.exp(-t*2),.5)
    a=np.tanh(a*1.15)*.88;a[-7200:]*=np.linspace(1,0,7200)[:,None]
    with wave.open(str(OUT/'CHROMA-score.wav'),'wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(sr);f.writeframes((a*32767).astype('<i2').tobytes())

def preview():
    sheet=Image.new('RGB',(1280,1800))
    for k in range(10):sheet.paste(frame(k*1.5+.85).resize((640,360),Image.Resampling.LANCZOS),((k%2)*640,(k//2)*360))
    sheet.save(OUT/'storyboard.jpg',quality=93)
    frame(10.2).save(OUT/'poster.jpg',quality=95)

def render():
    preview();score();ff=imageio_ffmpeg.get_ffmpeg_exe()
    cmd=[ff,'-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(OUT/'CHROMA-score.wav'),'-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','256k','-t','15','-movflags','+faststart',str(OUT/'CHROMA.mp4')]
    with open(OUT/'render.log','w') as log:
        p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        for i in range(900):
            # Two temporal samples add directional blur without muddy trails.
            im=Image.blend(frame(i/60),frame(min(14.999,i/60+1/120)),.5)
            p.stdin.write(im.tobytes())
            if i%60==0:print(f'{i//60}/15 seconds rendered',flush=True)
        p.stdin.close()
        if p.wait():raise RuntimeError('Encoder error: see render.log')
    print('Complete: '+str(OUT/'CHROMA.mp4'),flush=True)

if __name__=='__main__':
    if '--preview' in sys.argv:preview()
    else:render()
