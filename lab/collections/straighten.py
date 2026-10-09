# Perspective-corrects a photographed cover to a flat scan: four front-cover corners
# (TL, TR, BR, BL, read by eye on a pixel grid) mapped to a rectangle of the paperback's shape.
import sys, numpy as np
from PIL import Image
def coeffs(dst, src):
    A=[];B=[]
    for (x,y),(u,v) in zip(dst,src):
        A.append([x,y,1,0,0,0,-u*x,-u*y]); B.append(u)
        A.append([0,0,0,x,y,1,-v*x,-v*y]); B.append(v)
    return np.linalg.solve(np.array(A,float),np.array(B,float)).tolist()
def straighten(path, corners, out, ratio=1.62, w=420):
    im=Image.open(path).convert('RGB'); h=round(w*ratio)
    dst=[(0,0),(w,0),(w,h),(0,h)]
    im.transform((w,h),Image.PERSPECTIVE,coeffs(dst,corners),Image.BICUBIC).save(out,quality=95)
if __name__=='__main__':
    C={'13679047':[(43,4),(326,1),(326,488),(45,490)],
       '10663008':[(49,63),(289,43),(297,486),(53,485)],
       '14155494':[(74,52),(288,55),(290,429),(76,431)]}
    for k,c in C.items(): straighten(f'{k}.jpg',c,f'flat-{k}.jpg')
    ims=[Image.open(f'{k}.jpg') for k in C]+[Image.open(f'flat-{k}.jpg') for k in C]
    s=Image.new('RGB',(6*260,440),(20,20,20))
    for i,im in enumerate(ims): im=im.copy(); im.thumbnail((250,430)); s.paste(im,(i*260,5))
    s.save('/tmp/claude-501/flat.jpg')
