"""Pose Paulina 08 by skin weights from her original MHR rig.

The upper arm and forearm keep their rest lengths. Finger corrections are
rotations at the base of each finger, followed by small surface adjustments.
"""
import json
from pathlib import Path
import sys
import numpy as np
from scipy.spatial.transform import Rotation
from scipy.optimize import least_squares
from functools import lru_cache
import torch
import trimesh
from scipy.sparse import coo_matrix, diags

here=Path(__file__).resolve().parent
root=here.parents[3]
source=root/'test/dealer/paulina/bordsvila-v2/08-bordsvila-scen.glb'
path=json.loads((here.parent/'bana.json').read_text())
mesh=trimesh.load(source,force='mesh',process=False)
verts=np.asarray(mesh.vertices)
torch.set_num_threads(4)
rig=torch.jit.load(str(root.parent/'sam-3d-body/checkpoints/sam-3d-body-dinov3/assets/mhr_model.pt'),map_location='cpu')
joints=rig.get_joint_names()
lbs=rig.character_torch.linear_blend_skinning
vi,ji,sw=[a.numpy() for a in [lbs.vert_indices_flattened,lbs.skin_indices_flattened,lbs.skin_weights_flattened]]
assert vi.max()+1==len(verts)
def weight(names):
    return np.bincount(vi,weights=sw*np.isin(ji,[joints.index(n) for n in names]),minlength=len(verts))
def unit(x):
    return x/np.linalg.norm(x)
def rotated(a,b):
    a,b=unit(a),unit(b)
    cross=np.cross(a,b)
    if np.linalg.norm(cross)<1e-10: return Rotation.identity()
    return Rotation.from_rotvec(unit(cross)*np.arctan2(np.linalg.norm(cross),a@b))
def mean(mask):
    return verts[mask].mean(axis=0)
names=['index','middle','ring','pinky','thumb']
digitW={d:weight([n for n in joints if n.startswith('l_'+d)]) for d in names}
distal={d:weight(['l_'+d+'3','l_'+d+'_null'])>.55 for d in names}
baseJ={d:mean(weight(['l_'+d+'1'])>.35) for d in names}
pads={}
for d in names:
    candidates=verts[distal[d]]
    pads[d]=candidates[candidates[:,1]<candidates[:,1].min()+.0011].mean(axis=0)
aRest=np.array([.163,.231,-.369])
eRest=np.array([.34689,.06913,-.21534])
wRest=np.array([.143,.043,-.103])
upperWeight=weight([n for n in joints if n.startswith('l_uparm')])
foreWeight=weight([n for n in joints if n.startswith('l_lowarm') or n=='l_wrist_twist'])
handWeight=weight(['l_wrist'])+sum(digitW.values())
restWeight=1-upperWeight-foreWeight-handWeight
edges=mesh.edges_unique
neighbors=coo_matrix((np.ones(len(edges)),(edges[:,0],edges[:,1])),shape=(len(verts),len(verts))).tocsr()
neighbors=neighbors+neighbors.T
neighbors=diags(1/np.maximum(1,np.asarray(neighbors.sum(axis=1)).ravel()))@neighbors

def multiply(a,b):
    av,aw=a[...,:3],a[...,3:]
    bv,bw=b[...,:3],b[...,3:]
    return np.concatenate([aw*bv+bw*av+np.cross(av,bv),aw*bw-np.sum(av*bv,axis=-1,keepdims=True)],axis=-1)

def blend_arm(armA,armB,hRot,elbow,midpoint,destination,distalFore):
    # Blend rotation and translation together as normalized dual quaternions.
    # Move the twist along a broad section of the original forearm. This
    # preserves cross-sectional volume when forearm and palm rotate together.
    weights=np.column_stack([restWeight,upperWeight,foreWeight*(1-distalFore),
                             handWeight+foreWeight*distalFore])
    # Diffuse overlapping skin groups along the mesh to remove sharp transitions
    # at the elbow and the metacarpal base. Keep distal finger assignments fixed.
    distal=np.maximum.reduce(list(digitW.values()))
    blend=(1-np.clip((distal-.05)/.35,0,1))[:,None]
    for _ in range(7):
        weights+=.55*blend*(neighbors@weights-weights)
    qs=[];duals=[]
    for rotation,delta in [(Rotation.identity(),np.zeros(3)),(armA,aRest-armA.apply(aRest)),
                            (armB,elbow-armB.apply(eRest)),(hRot,destination-hRot.apply(midpoint))]:
        q=rotation.as_quat()
        if qs and np.dot(q,qs[-1])<0: q=-q
        qs.append(q)
        duals.append(.5*multiply(np.r_[delta,0],q))
    q=weights@np.array(qs)
    qnorm=np.linalg.norm(q,axis=1,keepdims=True)
    q=q/qnorm;dual=(weights@np.array(duals))/qnorm
    conjugate=q*np.array([-1,-1,-1,1])
    return Rotation.from_quat(q).apply(verts)+2*multiply(dual,conjugate)[:,:3]
up=np.array([0.,1.,0.])
yaw=np.deg2rad(path['shoe']['yawDegrees'])
axis=np.array([np.sin(yaw),0,np.cos(yaw)])
width=np.array([np.cos(yaw),0,-np.sin(yaw)])
origin=np.array([.46,0,-.21])
def project(points):
    return (points-origin)@np.column_stack([width,up,axis])

@lru_cache(1)
def mhr_arm():
    report=json.loads((root/'test/dealer/paulina/bordsvila-v2/matt.json').read_text())['08']
    pack=np.load(next((Path('D:/ultimate-reality-lab/saved')/report['source']).glob('*.npz')))
    fitted=pack['mhr_model_params'].copy()
    pnames=rig.get_parameter_names()
    for name,value in report['spine_and_arm_changes'].items(): fitted[pnames.index(name)]=value
    shape=torch.tensor(pack['shape_params'][None])
    expr=torch.zeros(1,rig.get_num_face_expression_blendshapes())
    character=rig.character_torch
    def tensor(q):return torch.from_numpy(q[None].astype(np.float32))
    def raw(q):
        with torch.no_grad(): return rig(shape,tensor(q),expr)[0][0].numpy()/100
    rest=raw(fitted)
    U,_,V=np.linalg.svd((rest-rest.mean(0)).T@(verts-verts.mean(0)))
    toWorld=U@V
    translate=verts.mean(0)-rest.mean(0)@toWorld
    def skel(q):
        with torch.no_grad():
            jp=character.model_parameters_to_joint_parameters(torch.cat((tensor(q),torch.zeros_like(shape)),1))
            return (character.joint_parameters_to_skeleton_state(jp)[0,:,:3].numpy()/100)@toWorld+translate
    sourceS=skel(fitted)
    armIds=[i for i,n in enumerate(pnames) if n.startswith('l_') and any(k in n for k in ['clavicle_','uparm_','elbow_bend','lowarm_','wrist_'])]
    palmIds=[joints.index('l_'+k) for k in ['wrist','index1','middle1','thumb1','pinky1']]
    elbowId=joints.index('l_lowarm')
    prev=fitted[armIds].astype(float)
    def deform(hand,newHand,elbow):
        nonlocal prev
        goals=hand(sourceS[palmIds]);q=fitted.copy()
        def res(a):
            q[armIds]=a
            s=skel(q)
            return np.r_[(s[palmIds]-goals).ravel()*4,(s[elbowId]-elbow)*.22,
                         (a-fitted[armIds])*.002,(a-prev)*.001]
        steps=np.eye(len(armIds))*.0005
        def jac(a):return np.column_stack([(res(a+s)-res(a-s))/.001 for s in steps])
        sol=least_squares(res,prev,jac=jac,bounds=(fitted[armIds]-2.1,fitted[armIds]+2.1),
                          max_nfev=85,ftol=1e-6,xtol=1e-6)
        prev=sol.x;q[armIds]=prev
        out=verts+(raw(q)-rest)@toWorld
        # The rig supplies the shoulder, elbow, twist and wrist volume. Tie
        # the distal surface to the exact card-contact motion, fading the
        # submillimetre wrist-fit residual over the heel of the hand.
        baseGrip=np.clip(handWeight,0,1)
        out+=baseGrip[:,None]*(newHand-out)
        return out,skel(q)[elbowId]
    return deform

def create(frame, handYaw, handPitch, gap_goal=.00045,mode='linear'):
    targets={d:np.array(frame['contacts'][d]['pad_xyz_m']) for d in ['index','middle']}
    curve=np.array(frame['card_curve_zy_m'])
    hRot=Rotation.from_euler('YX',[handYaw,handPitch],degrees=True)
    midpoint=(pads['index']+pads['middle'])/2
    destination=(targets['index']+targets['middle'])/2
    def hand(points):
        return hRot.apply(points-midpoint)+destination
    wrist=hand(wRest)
    axisArm=unit(wrist-aRest)
    L1,L2=np.linalg.norm(eRest-aRest),np.linalg.norm(wRest-eRest)
    d=np.linalg.norm(wrist-aRest)
    along=(L1**2-L2**2+d*d)/(2*d)
    # Upper arm opens toward the left while the forearm clears the table.
    radial=np.sqrt(max(0,L1**2-along**2))
    arcCenter=aRest+axisArm*along
    vertical=unit(up-axisArm*axisArm[1])
    side=unit(np.cross(axisArm,vertical))
    vOffset=np.clip((.12-arcCenter[1])/vertical[1],-radial,radial)
    alternatives=[arcCenter+vertical*vOffset+sign*side*np.sqrt(max(0,radial**2-vOffset**2)) for sign in [-1,1]]
    elbow=min(alternatives,key=lambda e:e[2])
    armA=rotated(eRest-aRest,elbow-aRest)
    armB=rotated(wRest-eRest,wrist-elbow)
    out=verts*restWeight[:,None]
    out+=(armA.apply(verts-aRest)+aRest)*upperWeight[:,None]
    fore=armB.apply(verts-eRest)+elbow
    newHand=hand(verts)
    # Blend the wrist twist joint to the palm in its distal part.
    distalFore=np.clip(((verts-eRest)@(wRest-eRest)/L2**2-.73)/.27,0,1)
    out+=((1-distalFore[:,None])*fore+distalFore[:,None]*newHand)*foreWeight[:,None]
    out+=newHand*handWeight[:,None]
    if mode=='volym':
        # Choose the long-axis rotation continuously from the distal wrist.
        # Joint centres alone do not determine twist around either bone.
        armB=rotated(hRot.apply(wRest-eRest),wrist-elbow)*hRot
        armA=rotated(armB.apply(eRest-aRest),elbow-aRest)*armB
        out=blend_arm(armA,armB,hRot,elbow,midpoint,destination,distalFore)
    if mode.startswith('mhr'):
        out,elbow=mhr_arm()(hand,newHand,elbow)
    gaps={}
    for name in names:
        pivot=hand(baseJ[name]); reach=hand(pads[name])-pivot
        target=hand(pads[name]).copy()
        if name in targets:
            target=targets[name].copy()
        else:
            # Lift the idle fingertips away from the facing rail; thumb stays
            # open on the free side of the hand.
            target[1]=max(target[1], np.interp(project(target)[2],curve[:,0],curve[:,1])+.017,
                           .048 if frame['frame']<7 else .028)
            if name=='pinky': target[1]+=.009
            if name=='ring':
                target[1]+=.012*np.clip((6-frame['frame'])/3,0,1)
            if mode=='mhr-grepp' and name in ['ring','pinky']:
                # Curl the two inactive fingertips loosely toward the palm.
                # The ring fingertip rises above the rim only near the mouth.
                target-=unit(reach)*(.022 if name=='pinky' else .014)
                lift=np.clip((7-frame['frame'])/4,0,1)
                target[1]=(.021 if name=='ring' else .026)+lift*(.041 if name=='ring' else .038)
        effective=target-pivot
        # A rotation preserves finger length; only the residual (typically a
        # few mm) is distributed along the finger to reach both touching pads.
        correction=rotated(reach,effective)
        alongFinger=np.clip(((newHand-pivot)@reach)/(reach@reach),0,1)
        corrected=correction.apply(newHand-pivot)+pivot
        residual=target-(correction.apply(reach)+pivot)
        corrected+=alongFinger[:,None]*residual
        influence=digitW[name][:,None]
        if mode.startswith('mhr'):
            # Proximal metacarpal skin belongs to the palm. Rotation at the
            # finger base must not pull the heel of the hand backward.
            gate=np.clip(alongFinger/.36,0,1)
            influence=influence*(gate*gate*(3-2*gate))[:,None]
        if mode=='mhr-grepp' and name in ['ring','pinky']:
            # Give the proximal interphalangeal joint a gentle arch above its
            # shortened chord, instead of shortening the whole digit evenly.
            corrected[:,1]+=.011*np.sin(np.pi*alongFinger)
        out+=(corrected-newHand)*influence
        if name not in targets: continue
        for i in range(3):
            loc=project(out[distal[name]])
            mask=(abs(loc[:,0])<.0315)&(loc[:,2]>=curve[0,0])&(loc[:,2]<=curve[-1,0])
            if not mask.any(): raise ValueError(f"{name}: surface outside card")
            gap=(loc[:,1]-np.interp(loc[:,2],curve[:,0],curve[:,1]))[mask].min()
            out[:,1]+=digitW[name]*alongFinger*(gap_goal-gap)
        gaps[name]=round(gap*1000,3)
    return out,gaps,elbow,wrist

def main():
    handYaw=float(sys.argv[1]) if len(sys.argv)>1 else 47
    handPitch=float(sys.argv[2]) if len(sys.argv)>2 else 28
    dst=Path(sys.argv[3]) if len(sys.argv)>3 else here
    gap_goal=float(sys.argv[4])/1000 if len(sys.argv)>4 else .00045
    mode=sys.argv[5] if len(sys.argv)>5 else 'linear'
    dst.mkdir(exist_ok=True)
    rows=[]
    for i,frame in enumerate(path['frames']):
        v,gaps,e,w=create(frame,handYaw,handPitch,gap_goal,mode)
        out=trimesh.Trimesh(vertices=v,faces=mesh.faces,process=False)
        out.visual=mesh.visual.copy()
        out.export(dst/f'drag-{i:02}.glb')
        rows.append({'frame':i+1,'pad_gap_mm':gaps,'elbow':e.tolist(),'wrist':w.tolist()})
    (dst/'matt-rigg.json').write_text(json.dumps({'source':str(source.relative_to(root)),'frames':rows},indent=2)+'\n')
    print('9 poses',rows[0],rows[-1],flush=True)

if __name__=='__main__': main()
