"""Export a poseable seated SAM/MHR surface, using side views to refine sagittal posture."""
import argparse
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import struct

import numpy as np
from scipy.spatial import cKDTree
from scipy.spatial.transform import Rotation
import torch
import trimesh
from material_versions import AVATARS, register_model, save_version, store_for


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rigid(rotation, pivot, target):
    matrix = np.eye(4)
    matrix[:3, :3] = rotation
    matrix[:3, 3] = target - rotation @ pivot
    return matrix


def move(matrix, points):
    return points @ matrix[:3, :3].T + matrix[:3, 3]


def unit(vector):
    return vector / np.linalg.norm(vector)


def align(first, second):
    a, b = unit(first), unit(second)
    axis = np.cross(a, b)
    if np.linalg.norm(axis) < 1e-10:
        if a @ b > 0:
            return np.eye(3)
        axis = np.cross(a, np.eye(3)[np.argmin(abs(a))])
    return Rotation.from_rotvec(unit(axis) * np.arccos(np.clip(a @ b, -1, 1))).as_matrix()


def pitch(vector):
    return float(np.degrees(np.arctan2(vector[2], vector[1])))


def require(condition, message):
    if not condition:
        raise ValueError(message)


class Skeleton:
    def __init__(self, model_path):
        self.model = torch.jit.load(str(model_path), map_location="cpu")
        self.names = list(self.model.get_joint_names())
        char = self.model.character_torch
        self.parents = char.skeleton.joint_parents.numpy()
        require(self.parents[0] == -1 and all(0 <= p < i for i, p in enumerate(self.parents[1:], 1)),
                "Expected the ordered, single-root MHR hierarchy")
        lbs = char.linear_blend_skinning
        vi = lbs.vert_indices_flattened.numpy()
        ji = lbs.skin_indices_flattened.numpy()
        wt = lbs.skin_weights_flattened.numpy()
        keep = wt > 0
        vi, ji, wt = vi[keep], ji[keep], wt[keep]
        order = np.argsort(vi, kind="stable")
        vi, ji, wt = vi[order], ji[order], wt[order]
        counts = np.bincount(vi)
        require(counts.min() >= 1 and counts.max() <= 4, "Expected 1–4 MHR influences per vertex")
        slots = np.arange(len(vi)) - np.repeat(np.cumsum(counts) - counts, counts)
        self.indices = np.zeros((len(counts), 4), np.uint16)
        self.weights = np.zeros((len(counts), 4), np.float32)
        self.indices[vi, slots] = ji
        self.weights[vi, slots] = wt
        require(np.allclose(self.weights.sum(1), 1, atol=2e-6), "Unexpected MHR weights")
        self.weights /= self.weights.sum(1, keepdims=True)

    def mask(self, prefixes):
        matches = np.array([name.startswith(prefixes) for name in self.names])
        return (matches[self.indices] * self.weights).sum(1) > .5

    def deform(self, vertices, transforms):
        result = np.zeros_like(vertices)
        for ids, weights in zip(self.indices.T, self.weights.T):
            result += (np.einsum("nij,nj->ni", transforms[ids, :3, :3], vertices)
                       + transforms[ids, :3, 3]) * weights[:, None]
        return result

    def world(self, data, normalizer):
        char = self.model.character_torch
        params = np.r_[data["mhr_model_params"], np.zeros_like(data["shape_params"])]
        pose = char.model_parameters_to_joint_parameters(torch.from_numpy(params[None]))
        state = char.joint_parameters_to_skeleton_state(pose).numpy()[0]
        camera_axes = np.diag([1., -1., -1.])
        require(np.max(abs(state[:, :3] @ camera_axes / 100 - data["pred_joint_coords"])) < 2e-6,
                "Saved joint positions do not match the installed MHR model")
        world = np.tile(np.eye(4), (len(self.names), 1, 1))
        world[:, :3, :3] = normalizer[:3].T @ camera_axes @ Rotation.from_quat(state[:, 3:7]).as_matrix()
        world[:, :3, :3] *= state[:, 7, None, None]
        world[:, :3, 3] = data["pred_joint_coords"] @ normalizer[:3] + normalizer[3]
        return world


@dataclass
class Source:
    photo: Path
    npz: Path
    glb: Path
    vertices: np.ndarray
    faces: np.ndarray
    world: np.ndarray


def source(run, index, photo, record, skeleton):
    require(digest(photo) == record["sha256"], f"Photo mismatch for index {index}")
    prefix = f"{index:02d}-{Path(record['path']).stem}"
    npz = run / (prefix + ".npz")
    glb = run / (prefix + "-front.glb")
    mesh = trimesh.load(glb, force="mesh", process=False)
    vertices, faces = np.array(mesh.vertices), np.array(mesh.faces)
    with np.load(npz) as data:
        require(np.array_equal(faces, data["faces"]) and len(vertices) == len(skeleton.weights),
                "Reference topology differs from the saved estimate or skin")
        raw = np.column_stack([data["pred_vertices"], np.ones(len(vertices))])
        affine = np.linalg.lstsq(raw, vertices, rcond=None)[0]
        require(np.max(abs(raw @ affine - vertices)) < 1e-6 and
                abs(np.linalg.det(affine[:3]) - 1) < 1e-6 and
                np.allclose(affine[:3].T @ affine[:3], np.eye(3), atol=1e-6), "Expected rigid front normalization")
        world = skeleton.world(data, affine)
    return Source(photo, npz, glb, vertices, faces, world)


def posture(joints):
    hip = (joints["l_upleg"] + joints["r_upleg"]) / 2
    eye = (joints["l_eye"] + joints["r_eye"]) / 2
    return dict(upperSpineDegrees=pitch(joints["c_neck"] - joints["c_spine2"]),
                cervicalDegrees=pitch(joints["c_head"] - joints["c_neck"]),
                headToEyesDegrees=pitch(eye - joints["c_head"]),
                headForwardOfHipsMm=float((joints["c_head"]-hip)[2]*1000))


def hand_gaps(skeleton, vertices, faces, side):
    """Signed vertical gaps over the top intersected thigh triangle, in metres."""
    digits = ("pinky", "ring", "middle", "index", "thumb")
    hand = skeleton.mask(tuple(side + "_" + name for name in (*digits, "wrist")))
    leg = skeleton.mask((side + "_upleg", side + "_lowleg"))
    triangles = vertices[faces[leg[faces].all(axis=1)]]
    plane = triangles[:, :, [0, 2]]
    centers = plane.mean(1)
    radius = np.linalg.norm(plane - centers[:, None], axis=2).max()
    ids = np.flatnonzero(hand)
    points = vertices[ids]
    near = cKDTree(centers).query_ball_point(points[:, [0, 2]], radius + 1e-9)
    pi = np.repeat(np.arange(len(points)), [len(a) for a in near])
    ti = np.concatenate(near).astype(int)
    a, b, c = plane[ti].transpose(1, 0, 2)
    ab, ac, ap = b-a, c-a, points[pi][:, [0, 2]]-a
    def cross(u, v):
        return u[:, 0]*v[:, 1] - u[:, 1]*v[:, 0]
    det = cross(ab, ac)
    s = cross(ap, ac) / np.where(abs(det)>1e-12, det, np.inf)
    t = cross(ab, ap) / np.where(abs(det)>1e-12, det, np.inf)
    hit = (abs(det)>1e-12) & (s>=0) & (t>=0) & (s+t<=1)
    y = triangles[ti, :, 1]
    top = np.full(len(points), -np.inf)
    np.maximum.at(top, pi[hit], (y[:, 0] + s*(y[:, 1]-y[:, 0]) + t*(y[:, 2]-y[:, 0]))[hit])
    gaps = points[:, 1] - top
    finite = np.isfinite(gaps)
    require(finite.any(), "No projected hand/thigh overlap")
    per_digit = {}
    for digit in digits:
        mask = skeleton.mask(side + "_" + digit)[ids] & finite
        if np.any(mask):
            per_digit[digit] = float(1000 * gaps[mask].min())
    return dict(minimumMm=float(1000*gaps[finite].min()), sampledVertices=int(finite.sum()),
                penetratingVertices=int((gaps < -1e-6).sum()), digitMinimumMm=per_digit)


def correct_pose(skeleton, front, target, hand_lift):
    j = dict(zip(skeleton.names, front.world[:, :3, 3]))
    base = posture(j)
    transforms = np.tile(np.eye(4), (len(j), 1, 1))
    trunk = transforms[0].copy()
    for bone, field in (("c_spine2","upperSpineDegrees"), ("c_neck","cervicalDegrees"), ("c_head","headToEyesDegrees")):
        pivot = j[bone]
        rot = Rotation.from_euler("x", target[field] - base[field], degrees=True).as_matrix()
        trunk = rigid(rot, pivot, move(trunk, pivot))
        root = skeleton.names.index(bone)
        for i in range(root, len(j)):
            ancestor = i
            while ancestor > root:
                ancestor = skeleton.parents[ancestor]
            if ancestor == root:
                transforms[i] = trunk
    for side in ("l", "r"):
        shoulder, elbow, wrist = (j[side + "_" + name] for name in ("uparm","lowarm","wrist"))
        new_shoulder = move(transforms[skeleton.names.index(side + "_clavicle")], shoulder)
        new_wrist = wrist + [0, hand_lift[side], 0]
        axis = unit(new_wrist - new_shoulder)
        reach = np.linalg.norm(new_wrist - new_shoulder)
        upper = np.linalg.norm(elbow-shoulder)
        lower = np.linalg.norm(wrist-elbow)
        along = (upper**2-lower**2+reach**2)/(2*reach)
        require(abs(along) < upper, "Wrist target out of reach")
        center = new_shoulder + along*axis
        pole = elbow - center
        new_elbow = center + unit(pole-(pole@axis)*axis)*np.sqrt(upper**2-along**2)
        arm = rigid(align(elbow-shoulder, new_elbow-new_shoulder), shoulder, new_shoulder)
        fore = rigid(align(wrist-elbow, new_wrist-new_elbow), elbow, new_elbow)
        hand = rigid(np.eye(3), wrist, new_wrist)
        descendants = {skeleton.names.index(side+"_wrist_twist")}
        for i, name in enumerate(skeleton.names):
            if name.startswith(side+"_uparm"):
                transforms[i] = arm
            elif name.startswith(side+"_lowarm"):
                transforms[i] = fore
            elif i in descendants or skeleton.parents[i] in descendants:
                transforms[i] = hand
                descendants.add(i)
    return transforms


class Gltf:
    def __init__(self):
        self.data = bytearray()
        self.doc = dict(asset={"version":"2.0","generator":"Ultimate Reality MHR rig"},scene=0,
                        scenes=[{"nodes":[0,1]}],nodes=[], meshes=[], skins=[], materials=[],
                        buffers=[], bufferViews=[], accessors=[])

    def accessor(self, values, dtype, shape, target=None, bounds=False):
        values = np.ascontiguousarray(values, dtype=dtype)
        self.data.extend(b"\0" * (-len(self.data)%4))
        view = dict(buffer=0, byteOffset=len(self.data), byteLength=values.nbytes)
        if target is not None:
            view["target"] = target
        acc = dict(bufferView=len(self.doc["bufferViews"]), count=len(values), type=shape,
                   componentType={"<f4":5126,"<u2":5123,"<u4":5125}[dtype])
        if bounds:
            vals = values.reshape(len(values), -1)
            acc.update(min=vals.min(0).tolist(),max=vals.max(0).tolist())
        self.doc["bufferViews"].append(view)
        self.doc["accessors"].append(acc)
        self.data.extend(values.tobytes())
        return len(self.doc["accessors"])-1

    def encode(self):
        self.doc["buffers"] = [dict(byteLength=len(self.data))]
        raw = json.dumps(self.doc, ensure_ascii=True,allow_nan=False,separators=(",",":")).encode()
        raw += b" " * (-len(raw)%4)
        binary = bytes(self.data) + b"\0" * (-len(self.data)%4)
        return (struct.pack("<4sIII4s",b"glTF",2,28+len(raw)+len(binary),len(raw),b"JSON") + raw +
                struct.pack("<I4s",len(binary),b"BIN\0") + binary)


def export(skeleton, vertices, faces, world, extras):
    glb = Gltf()
    nodes = [dict(name="Seated body",mesh=0,skin=0)]
    world_rest = np.empty_like(world)
    for i, (name,parent) in enumerate(zip(skeleton.names, skeleton.parents)):
        local = world[i].copy() if parent < 0 else np.linalg.solve(world[parent],world[i])
        scale = np.linalg.norm(local[:3, :3], axis=0)
        quat = Rotation.from_matrix(local[:3, :3]/scale).as_quat()
        node = dict(name=name,translation=local[:3,3].tolist(),rotation=quat.tolist(),scale=scale.tolist())
        children = (np.flatnonzero(skeleton.parents == i)+1).tolist()
        if children:
            node["children"] = children
        nodes.append(node)
        local[:3,:3] = Rotation.from_quat(quat).as_matrix()*scale
        world_rest[i] = local if parent < 0 else world_rest[parent] @ local
    inverse = np.linalg.inv(world).transpose(0,2,1).astype("<f4")
    bind_error = float(np.max(abs(world_rest @ inverse.transpose(0,2,1)-np.eye(4))))
    require(bind_error<2e-6,"Inverse bind matrix mismatch")
    glb.doc["asset"]["extras"] = extras
    glb.doc["nodes"] = nodes
    glb.doc["skins"] = [dict(name="MHR",skeleton=1,joints=list(range(1,len(world)+1)),
                             inverseBindMatrices=glb.accessor(inverse,"<f4","MAT4"))]
    norms = trimesh.Trimesh(vertices=vertices,faces=faces,process=False).vertex_normals
    attrs = dict(POSITION=glb.accessor(vertices,"<f4","VEC3",34962,True),
                 NORMAL=glb.accessor(norms,"<f4","VEC3",34962),
                 JOINTS_0=glb.accessor(skeleton.indices,"<u2","VEC4",34962),
                 WEIGHTS_0=glb.accessor(skeleton.weights,"<f4","VEC4",34962))
    glb.doc["materials"] = [dict(name="Neutral body", doubleSided=True,
            pbrMetallicRoughness=dict(baseColorFactor=[.54,.60,.56,1],roughnessFactor=.88,metallicFactor=0))]
    glb.doc["meshes"] = [dict(name="Seated body",primitives=[dict(attributes=attrs,material=0,mode=4,
            indices=glb.accessor(faces.ravel(),"<u4","SCALAR",34963))])]
    return glb.encode(), bind_error


@torch.inference_mode()
def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--photos", type=Path, nargs=3, required=True, metavar=("FRONT","THREE_QUARTER","PROFILE"))
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    torch.set_num_threads(4)
    manifest = json.loads((args.run/"run.json").read_text(encoding="utf8"))
    require(manifest["state"] == "complete" and manifest["id"] == args.run.name and
            manifest["method"] == "SAM 3D Body / DINOv3", "Expected a completed SAM/DINOv3 run")
    skeleton = Skeleton(args.model)
    sources = [source(args.run,i,photo,manifest["inputs"][i-1],skeleton) for i,photo in enumerate(args.photos,1)]
    protected = {p.resolve() for s in sources for p in (s.photo, s.npz, s.glb)}
    protected.update((args.model.resolve(), (args.run / "run.json").resolve()))
    outputs = {args.output.resolve(), args.report.resolve()}
    require(len(outputs) == 2 and not protected.intersection(outputs), "Use distinct destinations for the new version")
    front = sources[0]
    def measure(vertices,faces,world):
        joints = dict(zip(skeleton.names, world[:, :3, 3]))
        return dict(posture=posture(joints), hands={s:hand_gaps(skeleton,vertices,faces,s) for s in ("l","r")})
    measured = [measure(s.vertices,s.faces,s.world) for s in sources]
    # Profile exposes sagittal depth most clearly. Three-quarter is a secondary check.
    target = {k:.8*measured[2]["posture"][k]+.2*measured[1]["posture"][k] for k in measured[0]["posture"]}
    lift = {s:max(0, (1-measured[0]["hands"][s]["minimumMm"])/1000) for s in ("l","r")}
    transforms = correct_pose(skeleton,front,target,lift)
    vertices = skeleton.deform(front.vertices,transforms)
    world = transforms @ front.world
    after = measure(vertices,front.faces,world)
    require(all(after["hands"][s]["minimumMm"] >= -.1 for s in lift),"Residual hand penetration")
    sources_meta = [dict(index=i,photo=s.photo.name,photoSha256=digest(s.photo),estimate=s.npz.name,
                         estimateSha256=digest(s.npz), normalizedMesh=s.glb.name, meshSha256=digest(s.glb))
                    for i,s in enumerate(sources,1)]
    extras = dict(run=manifest["id"], inputIndex=1, input=front.photo.name, sourceViews=sources_meta,
                  unit="metre",up="+Y",forward="+Z",mhrModelSha256=digest(args.model))
    encoded, bind_error = export(skeleton,vertices,front.faces,world,extras)
    output = save_version(args.output, encoded)
    if output.resolve().is_relative_to(AVATARS):
        dealer = output.resolve().relative_to(AVATARS).parts[0]
        register_model(store_for(dealer), output, args.run)
    report = dict(**extras, estimatedFromViews=measured, after=after, handLiftMm={s:1000*v for s,v in lift.items()},
                  postureReferenceWeights=[0,.2,.8], joints=len(world), vertices=len(vertices), faces=len(front.faces),
                  inverseBindMaxError=bind_error, outputSha256=digest(output))
    save_version(args.report, (json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False)+"\n").encode())
    print(output)
    print(json.dumps(after))


if __name__ == "__main__":
    main()
