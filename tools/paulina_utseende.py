"""Bake the Fas 1 portraits and the rig's actual seated photo sources onto its surface."""
import argparse
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import struct

import cv2
import numpy as np
from PIL import Image
from scipy.interpolate import LinearNDInterpolator, RBFInterpolator
from scipy.spatial import cKDTree
from scipy.ndimage import distance_transform_edt
import torch
import trimesh
from material_versions import read_json, register_model, save_version, store_for

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "avatars/paulina/fas-1/v1"
BASENAME = "paulina-fas1-v2"
BASE = ROOT / "avatars/paulina/3d/fas1-v2" / (BASENAME + ".glb")
# Historical v2 review tools import these paths and the original SAM run.
DEST = BASE.parent / "utseende" / (BASENAME + "-utseende.glb")
REVIEW = ROOT / "test/dealer/paulina/fas1-sittande-v2/utseende"
RUN_ID = "sam-20261120T015406Z-f427a95156b7"
VIEWS = ("front", "trekvart", "profil")

# Inward contours from the 410-pixel-wide seated proofs exclude the chair,
# floor and the negative space between the limbs. Clothing samples outside
# the photographed neckline must also match the actual charcoal fabric.
CONTOURS = [
    [[(149,138),(183,124),(200,120),(222,124),(260,140),(276,174),(288,233),(289,250),(270,288),(264,317),(266,344),(256,458),(248,471),(250,512),(244,524),(217,524),(216,508),(218,471),(217,467),(214,387),(215,354),(205,329),(198,353),(196,452),(191,469),(192,514),(187,524),(163,524),(161,511),(166,471),(160,464),(148,374),(148,350),(140,334),(137,318),(141,293),(123,270),(119,248),(131,181)]],
    [[(179,140),(206,124),(238,120),(278,139),(294,177),(299,221),(297,264),(286,283),(289,323),(278,338),(222,344),(191,348),(177,371),(173,457),(171,483),(165,512),(157,520),(120,521),(126,511),(147,496),(148,468),(151,444),(142,368),(136,368),(133,463),(128,495),(117,514),(87,517),(88,511),(113,487),(111,464),(98,360),(98,328),(105,310),(119,300),(122,290),(138,273),(149,248),(165,222)]],
    [[(251,137),(265,122),(278,127),(296,157),(303,181),(304,215),(295,251),(297,289),(297,344),(292,356),(251,356),(197,357),(155,356),(135,350),(132,389),(128,460),(130,486),(131,510),(90,511),(57,509),(49,506),(49,499),(74,494),(92,477),(92,462),(90,400),(90,345),(92,328),(101,317),(128,309),(146,301),(165,289),(188,286),(210,271),(218,250),(215,211),(221,188)]]
]
# Corresponding photographic landmarks in the seated head crop and portrait
# (the portrait coordinates below are at half resolution).
OFFSETS = [(300,25),(290,30),(445,35)]
SEATED_MARKS = [
    [(210,161),(275,161),(246,203),(243,228),(245,262),(242,75),(167,72),(307,80),(139,183),(344,184),(181,280),(297,280),(195,300),(287,300)],
    [(239,163),(287,163),(247,202),(258,229),(259,266),(255,83),(226,95),(364,37),(215,159),(241,274),(350,273),(281,304)],
    [(176,162),(135,205),(149,230),(155,272),(183,77),(240,53),(294,40),(366,138),(373,217),(328,279),(264,301),(212,306)]
]
# Measured in the corrected 1083 × 1452 seated profile. The twelve points
# correspond in order to PORTRAIT_MARKS[2]; the clothing contour is at 410 px.
CORRECTED_PROFILE_SHA = "13e98b1eeac531a1feeadcc866016a930b5145aa6211b1086e40f5469bcd3580"
CORRECTED_PROFILE_MARKS = [(565,184),(522,219),(535,251),(545,289),(556,104),(615,70),
                           (664,59),(755,130),(770,229),(739,294),(676,312),(607,332)]
CORRECTED_PROFILE_CONTOUR = [
    (257,124),(267,122),(275,136),(284,157),(287,176),(284,201),(278,225),
    (276,252),(278,282),(273,320),(263,343),(137,347),(128,350),(122,358),
    (121,406),(119,448),(119,487),(120,514),(84,515),(45,512),(42,509),
    (45,503),(70,498),(80,485),(84,468),(83,419),(82,365),(83,327),(88,315),
    (99,307),(113,303),(127,300),(156,282),(173,281),(180,274),(189,267),
    (194,247),(195,224),(189,207),(189,190),(195,174),(210,154),(231,137)
]
PORTRAIT_MARKS = [
    [(226,222),(329,222),(284,289),(279,328),(284,382),(282,80),(168,72),(395,88),(108,252),(440,252),(173,410),(376,410),(205,432),(353,432)],
    [(161,219),(248,219),(190,284),(205,328),(208,384),(211,87),(153,99),(351,17),(124,216),(168,398),(351,411),(224,439)],
    [(146,232),(82,298),(101,350),(120,410),(157,103),(246,43),(314,21),(471,154),(494,319),(408,421),(304,458),(218,463)]
]
# Hair outline and opening in the seated frontal photograph: y, outer-left,
# opening-left, opening-right, outer-right. A decreasing width closes the crown.
HAIR = np.array([
    [57,541,545,545,550],[60,526,544,544,557],[65,511,544,544,572],[72,496,545,545,584],
    [84,482,545,545,600],[95,471,537,558,612],[107,462,529,571,620],[124,453,522,583,630],
    [145,446,513,590,637],[164,441,503,597,642],[187,438,486,604,645],[209,437,482,606,646],
    [232,439,483,605,645],[251,443,489,604,641],[269,448,496,600,637],[285,453,497,596,630],
    [300,463,490,594,622],[311,471,485,596,615],[319,478,482,601,607]
],float)
# Real profile lock edges in the half-size portrait. The far rear is synthesized
# from this side since the Fas 1 series has no rear photograph.
PROFILE_HAIR = np.array([
    [22,296,322],[30,268,354],[46,229,383],[66,187,406],[86,154,420],[109,150,434],
    [138,166,448],[170,179,459],[205,195,471],[242,215,481],[281,244,486],
    [319,263,483],[357,265,471],[389,266,455],[416,268,426],[438,272,397],[450,287,365]
],float)


# Portrait face boundaries separate uncovered skin from the bob and the tattooed
# neck. The margin also supplies a smooth cheek colour beneath unseen locks.
FACE = [
    [(185,231),(198,201),(218,167),(233,123),(249,91),(276,84),(314,96),(342,114),(365,152),(377,195),(378,247),(372,285),(366,316),(349,344),(319,366),(289,384),(268,381),(235,367),(208,350),(193,320),(181,285),(180,255)],
    [(148,190),(155,141),(182,102),(211,84),(244,93),(263,126),(288,167),(313,203),(338,239),(346,269),(339,309),(316,343),(270,370),(228,384),(204,382),(184,366),(173,347),(167,334),(164,315),(151,299),(150,283),(147,260),(145,237)],
    [(118,201),(126,154),(139,127),(155,108),(170,146),(178,180),(193,214),(211,246),(235,274),(259,293),(265,329),(257,363),(246,380),(212,393),(184,403),(147,408),(123,410),(114,400),(114,383),(115,368),(104,359),(103,350),(108,343),(99,338),(99,329),(103,318),(88,311),(82,301),(86,288),(100,266),(112,242),(119,226)]
]
HAND_MARKS = {
    "l": {"wrist": (116,355), "pinky": [(76,177),(74,135),(74,104),(75,78)],
          "ring": [(110,169),(108,120),(111,63),(112,33)],
          "middle": [(144,157),(145,104),(148,50),(148,16)],
          "index": [(171,157),(181,109),(186,64),(187,39)],
          "thumb": [(181,247),(211,190),(229,162),(247,145)]},
    "r": {"wrist": (413,354), "pinky": [(449,180),(459,137),(458,103),(459,77)],
          "ring": [(423,167),(425,120),(424,65),(423,34)],
          "middle": [(393,158),(390,100),(388,48),(389,16)],
          "index": [(364,158),(355,103),(350,65),(349,35)],
          "thumb": [(344,249),(312,194),(291,165),(281,147)]}
}


class HandPhoto:
    def __init__(self,ref,names):
        self.file=PHOTOS/"hander/handryggar.png"
        self.image=np.array(Image.open(self.file).convert("RGB"))
        recorded=np.load(ref.npz)
        joints=recorded["pred_joint_coords"]+recorded["pred_cam_t"]
        self.ref=ref
        self.models=[]
        for side,marks in HAND_MARKS.items():
            wrist=joints[names.index(side+"_wrist")]
            src=[wrist]
            dst=[marks["wrist"]]
            for digit in ("thumb","index","middle","ring","pinky"):
                for suffix,pixel in zip(("1","2","3","_null"),marks[digit]):
                    src.append(joints[names.index(side+"_"+digit+suffix)])
                    dst.append(pixel)
            middle=joints[names.index(side+"_middle1")]
            index=joints[names.index(side+"_index1")]
            normal=unit(np.cross(middle-wrist,index-wrist))
            if normal@np.array([0,-1.,-1.])<0:
                normal=-normal
            # Parallel rays along the palm normal map to the same reference
            # pixel. The artificial off-plane anchors stabilize fingers on a
            # bent hand without copying their underside from the photograph.
            pts=np.asarray(src)
            target=np.asarray(dst)*self.image.shape[1]/640
            interp=RBFInterpolator(np.vstack([pts,pts+.018*normal])*100,np.vstack([target,target]),smoothing=.04)
            self.models.append((wrist,normal,interp))

    def sample(self,corners,bw,hand):
        rgb=np.zeros((len(hand),3))
        q=np.zeros(len(hand))
        choose=np.flatnonzero(hand>.06)
        if not len(choose):
            return rgb,q
        c=corners[choose];w=bw[choose]
        points=(self.ref.v[c]*w[:,:,None]).sum(axis=1)
        normals=unit((self.ref.n[c]*w[:,:,None]).sum(axis=1))
        dist=[np.linalg.norm(points-a[0],axis=1) for a in self.models]
        owners=np.argmin(dist,axis=0)
        for i,(wrist,n,interp) in enumerate(self.models):
            local=np.flatnonzero(owners==i)
            idx=choose[local]
            xy=interp(points[local]*100)
            colour=rgb_at(self.image,xy)
            warm=mix(10,39,colour[:,0]-colour[:,2])
            q[idx]=mix(.17,.80,normals[local]@n)*warm*hand[idx]
            rgb[idx]=colour
        return rgb,q


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def mix(lo, hi, v):
    t = np.clip((v-lo)/(hi-lo), 0, 1)
    return t*t*(3-2*t)


def unit(a):
    return a / np.maximum(np.linalg.norm(a,axis=-1,keepdims=True), 1e-9)


def rgb_at(im, xy):
    x=np.clip(xy[:,0],0,im.shape[1]-1.001)
    y=np.clip(xy[:,1],0,im.shape[0]-1.001)
    i,j=x.astype(int),y.astype(int)
    u,v=(x-i)[:,None],(y-j)[:,None]
    return (1-v)*((1-u)*im[j,i]+u*im[j,i+1])+v*((1-u)*im[j+1,i]+u*im[j+1,i+1])


def triangles_at(xy,faces,width,height,order):
    ids=np.full((height,width),-1,np.int32)
    triangles=np.rint(xy[faces]*16).astype(np.int32)
    for k in order:
        cv2.fillConvexPoly(ids,triangles[k],int(k),lineType=cv2.LINE_8,shift=4)
    return ids


def barycentric(xy, triangles):
    a,b,c=triangles.transpose(1,0,2)
    ab,ac,ap=b-a,c-a,xy-a
    det=ab[:,0]*ac[:,1]-ab[:,1]*ac[:,0]
    det=np.where(abs(det)>1e-9,det,1.)
    s=(ap[:,0]*ac[:,1]-ap[:,1]*ac[:,0])/det
    t=(ab[:,0]*ap[:,1]-ab[:,1]*ap[:,0])/det
    w=np.clip(np.stack([1-s-t,s,t],axis=1),0,1)
    return w/np.maximum(w.sum(1,keepdims=True),1e-10)


class Glb:
    def __init__(self,path):
        raw=path.read_bytes()
        jl=struct.unpack_from("<I",raw,12)[0]
        self.doc=json.loads(raw[20:20+jl])
        self.data=bytearray(raw[28+jl:])

    def read(self,index):
        a=self.doc["accessors"][index]
        view=self.doc["bufferViews"][a["bufferView"]]
        dtype={5126:"<f4",5123:"<u2",5125:"<u4"}[a["componentType"]]
        n={"VEC3":3,"VEC2":2,"VEC4":4,"SCALAR":1,"MAT4":16}[a["type"]]
        return np.frombuffer(self.data,dtype,count=a["count"]*n,offset=view.get("byteOffset",0)+a.get("byteOffset",0)).reshape(-1,n).copy()

    def buffer(self,raw,target=None):
        self.data.extend(b"\0"*(-len(self.data)%4))
        view={"buffer":0,"byteOffset":len(self.data),"byteLength":len(raw)}
        if target:
            view["target"]=target
        self.data.extend(raw)
        self.doc["bufferViews"].append(view)
        return len(self.doc["bufferViews"])-1

    def accessor(self,arr,kind,is_index=False):
        arr=np.ascontiguousarray(arr)
        code={np.dtype("float32"):5126,np.dtype("uint16"):5123,np.dtype("uint32"):5125}[arr.dtype]
        a={"bufferView":self.buffer(arr.tobytes(),34963 if is_index else 34962),"componentType":code,"count":len(arr),"type":kind}
        if kind=="VEC3":
            a.update(min=arr.min(0).tolist(),max=arr.max(0).tolist())
        self.doc["accessors"].append(a)
        return len(self.doc["accessors"])-1

    def material(self,name,image,roughness):
        image=np.uint8(np.clip(image,0,255))
        io=BytesIO()
        Image.fromarray(image).save(io,format="JPEG",quality=96,subsampling=0)
        images=self.doc.setdefault("images",[])
        textures=self.doc.setdefault("textures",[])
        images.append({"name":name,"bufferView":self.buffer(io.getvalue()),"mimeType":"image/jpeg"})
        textures.append({"source":len(images)-1})
        materials=self.doc.setdefault("materials",[])
        materials.append({"name":name,"doubleSided":True,"pbrMetallicRoughness":{"baseColorTexture":{"index":len(textures)-1},"metallicFactor":0,"roughnessFactor":roughness}})
        return len(materials)-1

    def save(self,path):
        self.data.extend(b"\0"*(-len(self.data)%4))
        self.doc["buffers"][0]["byteLength"]=len(self.data)
        js=json.dumps(self.doc,separators=(",",":")).encode()
        js+=b" "*(-len(js)%4)
        header=struct.pack("<4sII",b"glTF",2,28+len(js)+len(self.data))
        return save_version(path,header+struct.pack("<I4s",len(js),b"JSON")+js+struct.pack("<I4s",len(self.data),b"BIN\0")+self.data)


class Source:
    def __init__(self,idx,lab,faces,registered,run_input=None,edition=None):
        view=VIEWS[idx]
        original="sittande/"+view+".png"
        if run_input is None:
            run_input=read_json(lab/"run.json")["inputs"][idx]
        if edition is None:
            edition={row["fil"]:row["sha256"] for row in read_json(PHOTOS/"bildregister.json")["bilder"]}
        input_hash=run_input["sha256"]
        if input_hash != registered["photoSha256"]:
            raise ValueError("The photo in run.json does not match the geometry source")
        self.file=Path(run_input["path"]).resolve()
        if not self.file.is_relative_to(PHOTOS) or not self.file.is_file():
            # Legacy runs used lab input copies. Resolve the edition original
            # only when the saved input bytes have the very same fingerprint.
            self.file=PHOTOS/original
            if input_hash != edition[original] and idx == 2:
                for row in read_json(PHOTOS/"granskning/sittprofilprov.json")["views"]:
                    if row["sourceSha256"] == input_hash:
                        self.file=(PHOTOS/row["file"]).resolve()
                        if not self.file.is_relative_to(PHOTOS):
                            raise ValueError("The profile photograph is outside the edition")
                        break
        self.portrait_file=PHOTOS/"ansikte"/(view+".png")
        if sha(self.portrait_file) != edition["ansikte/"+view+".png"]:
            raise ValueError("The portrait does not match its registered photograph")
        name=registered["estimate"]
        if Path(name).name != name or registered["index"] != idx+1 or sha(self.file) != registered["photoSha256"]:
            raise ValueError("The seated photograph does not match the geometry source")
        self.npz=lab/name
        if sha(self.npz) != registered["estimateSha256"]:
            raise ValueError("The saved estimate does not match the geometry source")
        a=np.load(self.npz)
        if not np.array_equal(a["faces"],faces):
            raise ValueError(f"Different topology in {self.npz}")
        self.v=a["pred_vertices"]+a["pred_cam_t"]
        self.n=trimesh.Trimesh(self.v,faces,process=False).vertex_normals
        self.photo=np.array(Image.open(self.file).convert("RGB"))
        self.portrait=np.array(Image.open(self.portrait_file).convert("RGB"))
        mask=np.zeros(self.portrait.shape[:2],np.uint8)
        cv2.fillPoly(mask,[np.rint(np.array(FACE[idx])*self.portrait.shape[1]/543).astype(np.int32)],255)
        mask=cv2.erode(mask,np.ones((5,5),np.uint8))
        dist,nearest=distance_transform_edt(mask==0,return_indices=True)
        extended=self.portrait[nearest[0],nearest[1]]
        alpha=mix(0,28,dist)[:,:,None]
        self.face_photo=np.uint8((1-alpha)*extended+alpha*cv2.GaussianBlur(extended,(0,0),9))
        self.mid=a["original_size"]*.5
        self.scale=a["focal_length"]*a["original_size"]/a["inference_size"]
        self.xy=self.project(self.v)
        h,w=self.photo.shape[:2]
        self.faces=faces
        self.ids=triangles_at(self.xy,faces,w,h,np.argsort(self.v[:,2][faces].mean(axis=1))[::-1])
        self.mask=np.zeros((h,w),np.uint8)
        if idx == 2 and input_hash == CORRECTED_PROFILE_SHA:
            contours=[CORRECTED_PROFILE_CONTOUR]
            src=np.asarray(CORRECTED_PROFILE_MARKS)
        elif input_hash == edition[original]:
            contours=CONTOURS[idx]
            src=np.array(SEATED_MARKS[idx])+OFFSETS[idx]
        else:
            raise ValueError(f"No calibrated photographic landmarks for {view} {input_hash}")
        for contour in contours:
            cv2.fillPoly(self.mask,[np.rint(np.array(contour)*w/410).astype(np.int32)],255)
        dst=np.array(PORTRAIT_MARKS[idx])*2
        aff=np.linalg.lstsq(np.column_stack([src,np.ones(len(src))]),dst,rcond=None)[0]
        self.aff=aff
        self.portrait_residual=LinearNDInterpolator(src,dst-(src@aff[:2]+aff[2]),fill_value=0.)

    def portrait_xy(self,xy):
        return xy@self.aff[:2]+self.aff[2]+self.portrait_residual(xy)

    def project(self,v):
        return v[:,:2]/v[:,2:]*self.scale+self.mid

    def sample(self,corner,bw,skin,hand,torso,face,idx):
        point=(self.v[corner]*bw[:,:,None]).sum(1)
        xy=self.project(point)
        n=unit((self.n[corner]*bw[:,:,None]).sum(1))
        x=np.rint(xy[:,0]).astype(int).clip(0,self.photo.shape[1]-1)
        y=np.rint(xy[:,1]).astype(int).clip(0,self.photo.shape[0]-1)
        ids=self.ids[y,x]
        tri=self.faces[np.maximum(ids,0)]
        depth=1/(barycentric(np.stack((x,y),1),self.xy[tri])/self.v[tri,2]).sum(1)
        facing=-(n*unit(point)).sum(1)
        quality=mix(.08,.74,facing)*(1-mix(.002,.012,point[:,2]-depth))*(ids>=0)
        raw=rgb_at(self.photo,xy)
        # Chair upholstery and wooden legs have neither the dark cloth chroma
        # nor valid skin/cuff positions. The only pale cloth admitted is the
        # photographed shirt inside the central torso and neckline.
        dark=1-mix(55,82,raw.max(1))
        warm=mix(7,25,raw[:,0]-raw[:,2])
        cloth=dark+torso*warm*(1-dark)
        valid=(self.mask[y,x]/255)*((1-hand)*cloth+hand*warm)
        portrait_uv=self.portrait_xy(xy)
        skin_photo=rgb_at(self.portrait,portrait_uv)
        # A skin vertex at the edge of the cheek must not sample a hair lock
        # or the neck tattoo simply because two views yield different edges.
        cheek=face*mix(163,239,portrait_uv[:,1]/2)
        # Frontal fringe and part continue onto the crown beneath the shell.
        # Where the photo shows real hair preserve those strands on the scalp.
        protected=np.maximum(cheek,face*(1-mix(2,16,skin_photo[:,0]-skin_photo[:,2])))
        skin_photo=skin_photo*(1-protected[:,None])+rgb_at(self.face_photo,portrait_uv)*protected[:,None]
        portrait_weight=skin*(1-mix(248,281,xy[:,1]/self.photo.shape[1]*410))
        raw=(1-portrait_weight[:,None])*raw+portrait_weight[:,None]*skin_photo
        valid=valid*(1-skin)+skin*mix(1,17,skin_photo[:,0]-skin_photo[:,2])
        # Front establishes the facial features. Side views primarily supply
        # the cheek and temple round the turn where the front loses coverage.
        face_strength=mix(.14,.85,facing) if idx==0 else 1.
        return raw,quality*valid*(1+skin*(8.*face_strength if idx==0 else 0.)+torso*(22. if idx==0 else 0.))


def body_atlas(sources,faces,uv,uvfaces,groups,mirror,hands,size):
    uvtri=uv[uvfaces]*(size-1)
    ids=triangles_at(uv*(size-1),uvfaces,size,size,np.arange(len(faces)))
    y,x=np.nonzero(ids>=0)
    image=np.zeros((size,size,3),np.uint8)
    coverage=np.zeros(5)
    for start in range(0,len(x),50000):
        xs,ys=x[start:start+50000],y[start:start+50000]
        f=ids[ys,xs]
        c=faces[f]
        w=barycentric(np.column_stack((xs,ys)),uvtri[f])
        skin,hand,torso,face=(groups[c]*w[:,:,None]).sum(1).T
        visible_skin=np.maximum(skin,hand)
        fallback=(1-visible_skin[:,None])*[33.,31.,35.]+visible_skin[:,None]*[196.,145.,122.]
        colors,weights=zip(*(s.sample(c,w,skin,hand,torso,face,i) for i,s in enumerate(sources)))
        colors=list(colors);weights=list(weights)
        head_texels=np.flatnonzero(face>.05)
        if len(head_texels):
            k=head_texels
            for i in (1,2):
                mirror_rgb,mq=sources[i].sample(mirror[c[k]],w[k],skin[k],hand[k],torso[k],face[k],i)
                mq=mq*face[k]*(1-mix(.04,.30,weights[i][k]))
                old=weights[i][k]
                colors[i][k]=(colors[i][k]*old[:,None]+mirror_rgb*mq[:,None])/np.maximum((old+mq)[:,None],1e-7)
                weights[i][k]=old+mq
        hand_rgb,hand_w=hands.sample(c,w,hand)
        colors.append(hand_rgb)
        weights=[q*(1-hand_w*.84) for q in weights]+[hand_w*5]
        weights=np.stack(weights,axis=1)
        total=weights.sum(1)
        alpha=mix(.06,.66,total)
        weights=weights/np.maximum(total[:,None],1e-7)*alpha[:,None]
        rgb=fallback*(1-alpha[:,None])+(weights[:,:,None]*np.stack(colors,1)).sum(1)
        coverage+=np.r_[weights.sum(0),(1-alpha).sum()]
        image[ys,xs]=np.clip(rgb,0,255).astype(np.uint8)
    empty=ids<0
    nearest=distance_transform_edt(empty,return_distances=False,return_indices=True)
    image[empty]=image[nearest[0][empty],nearest[1][empty]]
    return image,coverage/len(x)

def hair_surface(ref,profile,body,head):
    source=ref.v[head]
    target=body[head]
    src0,dst0=source.mean(0),target.mean(0)
    u,_,vt=np.linalg.svd((source-src0).T@(target-dst0))
    rot=u@vt
    if np.linalg.det(rot)<0:
        u[:,-1]*=-1
        rot=u@vt
    scale=np.sum(((source-src0)@rot)*(target-dst0))/np.sum((source-src0)**2)

    # Align the profile portrait with sagittal coordinates of the final head.
    # Midline skin vertices carry no parallax from the small camera yaw.
    xmid=np.median(target[:,0])
    middle=head & (abs(body[:,0]-xmid)<.008)
    profile_plane=np.column_stack((-body[middle,2],-body[middle,1],np.ones(middle.sum())))
    portrait_plane=profile.portrait_xy(profile.xy[middle])/2
    profile_fit=np.linalg.lstsq(profile_plane,portrait_plane,rcond=None)[0]
    profile_inverse=np.linalg.inv(profile_fit[:2])

    def surface(t,s):
        y=57+262*t
        left,il,ir,right=[np.interp(y,HAIR[:,0],HAIR[:,i]) for i in range(1,5)]
        center=(right+left)/2
        radius=(right-left)/2
        a=np.arcsin(np.clip((ir-center)/radius,0,.995))
        b=2*np.pi-np.arcsin(np.clip((center-il)/radius,0,.995))
        theta=a+s*(b-a)
        cosine=np.cos(theta)
        strand=np.sin(35*theta+1.5*t)+.6*np.sin(15*theta-2*t)
        screen_x=center+radius*np.sin(theta)
        center_z=np.interp(y,[57,77,110,155,230,319],[1.912,1.922,1.928,1.937,1.947,1.971])
        depth_radius=np.interp(y,[57,60,65,75,92,115,160,210,260,319],[.004,.024,.044,.067,.09,.105,.119,.119,.113,.091])
        z=center_z-depth_radius*cosine+.0012*strand*np.sin(np.pi*t)
        # Keep the crown round in world space, including the portion hidden
        # behind its highest projected point in the frontal photograph.
        crown=mix(.02,.31,t)
        y_corrected=y+mix(.7,1,t)*(2.4*strand-5*(1-cosine))
        world_y=(y_corrected-ref.mid[1]) / ref.scale[1] * (center_z+(z-center_z)*(.38+.62*crown))
        raw=np.stack(((screen_x-ref.mid[0])*z/ref.scale[0],world_y,z),axis=-1)
        near_xy=np.stack((screen_x,y),axis=-1)
        open_face=(ir-il)>4
        near_xy[...,0]=np.where(open_face & (np.sin(theta)>0),np.maximum(screen_x,ir+2),near_xy[...,0])
        near_xy[...,0]=np.where(open_face & (np.sin(theta)<=0),np.minimum(screen_x,il-2),near_xy[...,0])
        near_xy[...,0]=np.clip(near_xy[...,0],left+2,right-2)
        portrait=ref.portrait_xy(near_xy.reshape(-1,2))
        near=rgb_at(ref.portrait,portrait).reshape(*y.shape,3)
        # For the outer silhouette in the scanned portraits, pulling a sample
        # a few pixels inward avoids lilac background from the wispy edge.
        seated_sample=rgb_at(ref.photo,near_xy.reshape(-1,2)).reshape(*y.shape,3)
        valid=mix(12,34,near[...,0]-near[...,2])
        near=near*valid[...,None]+seated_sample*(1-valid[...,None])
        profile_y=23+426*t
        pleft=np.interp(profile_y,PROFILE_HAIR[:,0],PROFILE_HAIR[:,1])
        pright=np.interp(profile_y,PROFILE_HAIR[:,0],PROFILE_HAIR[:,2])
        front_cos=np.where(np.sin(theta)>=0,np.cos(a),np.cos(2*np.pi-b))
        fraction=(front_cos-cosine)/np.maximum(1+front_cos,.01)
        q=np.clip(fraction,.035,.965)
        bx=pleft+q*(pright-pleft)
        profile_xy=2*np.stack((bx,profile_y),axis=-1)
        far=rgb_at(profile.portrait,profile_xy.reshape(-1,2)).reshape(*y.shape,3)
        side=mix(-.60,-.03,-cosine)
        near_valid=mix(5,24,near[...,0]-near[...,2])
        side=np.maximum(side,1-near_valid)
        color=near*(1-side[...,None])+far*side[...,None]
        points=(raw-src0)@rot*scale+dst0
        exterior=pleft+fraction*(pright-pleft)
        plane=(np.stack((exterior,profile_y),axis=-1)-profile_fit[2])@profile_inverse
        points[...,2]=-plane[...,0]
        points[...,1]=points[...,1]*.82-plane[...,1]*.18
        return points,color

    t,s=np.mgrid[0:81,0:161]
    points,_=surface(t/80,s/160)
    uv=np.stack((s/160,t/80),axis=-1).reshape(-1,2)
    a=(t[:-1,:-1]*161+s[:-1,:-1]).ravel()
    faces=np.vstack([np.column_stack((a,a+161,a+1)),np.column_stack((a+1,a+161,a+162))])
    points=points.reshape(-1,3)
    normals=trimesh.Trimesh(points,faces,process=False).vertex_normals
    rear=40*161+80
    if normals[rear,2]>0:
        faces=faces[:,::-1]
        normals=-normals
    t,s=np.mgrid[0:512,0:768]
    t_texture=t/511
    # Keep the lock tips inside blonde photographed lengths, away from the
    # necklace, neck ink and backdrop just beyond the silhouette.
    _,texture=surface(t_texture-.075*mix(.74,1.,t_texture),s/767)
    return points,normals,uv,faces,texture


def build(args):
    torch.set_num_threads(4)
    cv2.setNumThreads(4)
    glb=Glb(args.base)
    provenance=glb.doc["asset"]["extras"]
    run_path=args.run
    if run_path is None:
        run_id=provenance["run"]
        if Path(run_id).name != run_id or run_id in ("", ".", ".."):
            raise ValueError("Invalid run ID in the seated rig")
        storage=Path(os.environ.get("ULTIMATE_REALITY_STORAGE","D:/" if Path("D:/").is_dir() else ROOT/".lab-data"))
        run_path=storage/"ultimate-reality-lab/saved"/run_id
    run=read_json(run_path/"run.json")
    if run["state"] != "complete" or run["id"] != provenance["run"] or sha(args.model) != provenance["mhrModelSha256"]:
        raise ValueError("The run or MHR weights do not belong to this seated rig")
    if len(run["inputs"]) != len(VIEWS) or len(provenance["sourceViews"]) != len(VIEWS):
        raise ValueError("Expected three seated photos and three estimates for this rig")
    edition={row["fil"]:row["sha256"] for row in read_json(PHOTOS/"bildregister.json")["bilder"]}
    rig_version=args.base.parent.name
    output_path=args.output or args.base.parent/"utseende"/(args.base.stem+"-utseende.glb")
    review=args.review or ROOT/"test/dealer/paulina"/rig_version.replace("fas1-", "fas1-sittande-", 1)/"utseende"
    prim=glb.doc["meshes"][0]["primitives"][0]
    attrs=prim["attributes"]
    original_attrs={name:glb.read(index) for name,index in attrs.items()}
    joints,weights=original_attrs["JOINTS_0"],original_attrs["WEIGHTS_0"]
    faces=glb.read(prim["indices"]).reshape(-1,3)
    indices=glb.doc["skins"][0]["joints"]
    names=[glb.doc["nodes"][i]["name"] for i in indices]
    if len(names)!=127:
        raise ValueError("Expected the versioned 127-joint seated rig")

    def mass(fn):
        return (np.array([fn(name) for name in names])[joints]*weights).sum(1)

    model=torch.jit.load(str(args.model),map_location="cpu")
    m=model.character_torch.mesh
    if not np.array_equal(m.faces.numpy(),faces):
        raise ValueError("UV and seated rig topology differ")
    uv=m.texcoords.numpy().copy()
    uv[:,1]=1-uv[:,1]
    uvfaces=m.texcoord_faces.numpy()
    head=mass(lambda n:n.startswith(("c_head","c_jaw","c_teeth","c_tongue","l_eye","r_eye")))
    neck=mass(lambda n:n.startswith("c_neck"))
    hand=mass(lambda n:any(x in n for x in ("wrist","thumb","pinky","ring","middle","index")) and "wrist_twist" not in n)
    torso=mass(lambda n:n.startswith("c_spine") or "clavicle" in n)
    groups=np.column_stack([mix(.15,.75,head+.88*neck),mix(.32,.79,hand),mix(.20,.76,torso),mix(.19,.72,head)])
    refs=[Source(i,run_path,faces,source,run["inputs"][i],edition)
          for i,source in enumerate(provenance["sourceViews"])]
    hands=HandPhoto(refs[0],names)
    if sha(hands.file) != edition["hander/handryggar.png"]:
        raise ValueError("The hand reference does not match its registered photograph")
    rest=m.rest_vertices.numpy()
    reflected=rest.copy()
    reflected[:,0]*=-1
    mirror=cKDTree(rest).query(reflected)[1]
    atlas,coverage=body_atlas(refs,faces,uv,uvfaces,groups,mirror,hands,args.size)
    pairs,indices=np.unique(np.column_stack((faces.ravel(),uvfaces.ravel())),axis=0,return_inverse=True)
    vertex,uv_index=pairs.T
    for name,array in original_attrs.items():
        attrs[name]=glb.accessor(array[vertex],"VEC"+str(array.shape[1]))
    attrs["_SAM_INDEX"]=glb.accessor(vertex.astype("<u2"),"SCALAR")
    attrs["TEXCOORD_0"]=glb.accessor(uv[uv_index].astype("<f4"),"VEC2")
    prim["indices"]=glb.accessor(indices.ravel().astype("<u2"),"SCALAR",True)
    label=rig_version.removeprefix("fas1-")
    prim["material"]=glb.material("Paulina Fas 1 · ansikte, hals, kostym och händer "+label,atlas,.83)
    points,normals,huv,hfaces,hair=hair_surface(refs[0],refs[2],original_attrs["POSITION"],head>.89)
    headjoint=names.index("c_head")
    bj=np.zeros((len(points),4),"<u2")
    bw=np.zeros((len(points),4),"<f4")
    bj[:,0]=headjoint
    bw[:,0]=1.
    hair_attrs={k:glb.accessor(np.asarray(v,dtype=d),kind) for k,v,d,kind in [
        ("POSITION",points,"<f4","VEC3"),("NORMAL",normals,"<f4","VEC3"),
        ("TEXCOORD_0",huv,"<f4","VEC2"),("JOINTS_0",bj,"<u2","VEC4"),("WEIGHTS_0",bw,"<f4","VEC4")]}
    hprim={"attributes":hair_attrs,"material":glb.material("Paulina Fas 1 · blond page "+label,hair,.82),
           "indices":glb.accessor(hfaces.ravel().astype("<u2"),"SCALAR",True),"mode":4}
    glb.doc["meshes"].append({"name":"Blond page","extras":{"appearancePart":"hair"},"primitives":[hprim]})
    glb.doc["meshes"][0]["extras"]={"appearancePart":"body"}
    glb.doc["nodes"].append({"name":"Paulinas hår","mesh":len(glb.doc["meshes"])-1,"skin":0})
    glb.doc["scenes"][0]["nodes"].append(len(glb.doc["nodes"])-1)
    version=rig_version+"-utseende"
    inputs={str(p.relative_to(PHOTOS)).replace(chr(92),"/"):sha(p) for r in refs for p in [r.file,r.portrait_file]}
    inputs["hander/handryggar.png"]=sha(hands.file)
    glb.doc["asset"].setdefault("extras",{}).update(appearanceVersion=version,appearanceInputSHA256=inputs,
                                                     sourceModelSHA256=sha(args.base),sourceModel=args.base.name)
    output=glb.save(output_path)
    check=Glb(output)
    for k,array in original_attrs.items():
        if not np.array_equal(check.read(attrs[k]),array[vertex]):
            raise ValueError(f"Modified source body attribute {k}")
    check_faces=check.read(prim["indices"]).ravel()
    if not np.array_equal(vertex[check_faces],faces.ravel()):
        raise ValueError("Topology changed")
    register_model(store_for("paulina"), args.base, run_path)
    register_model(store_for("paulina"), output)
    record={"version":version,"rig":output.name,"sha256":sha(output),"baseSha256":sha(args.base),"sources":inputs,
            "run":run["id"],"npz":{r.npz.name:sha(r.npz) for r in refs},"joints":len(names),
            "materialRevision":2,"bodyAtlasSize":[args.size,args.size],"bodyTriangles":len(faces),"hairTriangles":len(hfaces),"verifiedBodyAttributes":list(original_attrs),
            "bodySourceWeights":dict(zip([*VIEWS,"handryggar","inferred"],coverage.tolist())),
            "limitations":["Hair at rear inferred from side locks. Left side mirrored for unseen locks.",
                           "Rear clothing, occluded skin and soles filled with material colours; no rear photograph.",
                           "Body is the neutral fitted SAM surface beneath the suit. Photos represent three separate poses."]}
    if provenance["sourceViews"][2]["photoSha256"] == CORRECTED_PROFILE_SHA:
        record["profileAlignment"] = {"photoSha256":CORRECTED_PROFILE_SHA,
            "seatedPixels":CORRECTED_PROFILE_MARKS, "portraitPixels":(2*np.array(PORTRAIT_MARKS[2])).tolist(),
            "method":"Twelve visually estimated corresponding facial, hair and neck landmarks."}
    save_version(review/"kallor.json",(json.dumps(record,indent=2,ensure_ascii=False)+"\n").encode())
    print(output,coverage,flush=True)


if __name__=="__main__":
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--base",type=Path,default=BASE)
    cli.add_argument("--output",type=Path)
    cli.add_argument("--review",type=Path)
    cli.add_argument("--run",type=Path,help="Saved SAM run; defaults to the run recorded inside --base")
    cli.add_argument("--model",type=Path,default=Path(os.environ.get("SAM3D_ROOT",ROOT.parent/"sam-3d-body"))/"checkpoints/sam-3d-body-dinov3/assets/mhr_model.pt")
    cli.add_argument("--size",type=int,default=2048)
    build(cli.parse_args())
