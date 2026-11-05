"""Bake a Quaternius Universal Animation Library punch onto the complete Tiga body.

Blender 5.2, --background --factory-startup --disable-autoexec --python-exit-code 1
--python art/import_body_motion.py -- --library PATH/UAL1_Standard.glb
The original model never executes its legacy drivers.
"""

import argparse
import sys
import math
import hashlib
from pathlib import Path
import bpy
from mathutils import Vector, Matrix, Quaternion

repo = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument(
    "--library",
    type=Path,
    required=True,
    help="UAL1_Standard.glb from the free Quaternius Standard pack",
)
parser.add_argument(
    "--clip", choices=["Punch_Cross", "Punch_Jab"], default="Punch_Cross"
)
parser.add_argument(
    "--output", type=Path, default=repo / "public/motion-preview/tiga-punch.glb"
)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])
source_hash = hashlib.sha256(args.library.read_bytes()).hexdigest()
if source_hash != "69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997":
    raise ValueError(
        "Use the documented free UAL1_Standard.glb release. Other rigs need their own mapping."
    )
V = Vector
bpy.ops.wm.open_mainfile(
    filepath=str(repo / "art/sources/tiga/Ultraman Tiga.blend"),
    load_ui=False,
    use_scripts=False,
)
old = bpy.data.objects["Armature.001"]
old.data.pose_position = "REST"
bpy.context.view_layer.update()
landmarks = {
    b.name: (old.matrix_world @ b.head_local, old.matrix_world @ b.tail_local)
    for b in old.data.bones
}
head = lambda n: landmarks[n][0]
defs = {}


def bone(name, start, end, parent=None):
    defs[name] = (start.copy(), end.copy(), parent)


bone("pelvis", head("hip"), head("spineLower"))
bone("spine_01", head("spineLower"), head("spineUpper"), "pelvis")
bone("spine_02", head("spineUpper"), head("spineChest"), "spine_01")
bone("spine_03", head("spineChest"), head("neckLower"), "spine_02")
bone("neck_01", head("neckLower"), head("headBase"), "spine_03")
bone("Head", head("headBase"), head("headBase") + V((0, 0, 0.25)), "neck_01")
for side in ("L", "R"):
    s = side.lower()
    tag = lambda n: n + "_" + side
    dest = lambda n: n + "_" + s
    for n, a, b, par in [
        ("clavicle", "Collar", "armBase", "spine_03"),
        ("upperarm", "armBase", "ForearmBase", dest("clavicle")),
        ("lowerarm", "ForearmBase", "HandBase", dest("upperarm")),
        ("hand", "HandBase", "Mid1", dest("lowerarm")),
        ("thigh", "ThighBase", "Shin", "pelvis"),
        ("calf", "Shin", "Foot", dest("thigh")),
        ("foot", "Foot", "Toe01_1", dest("calf")),
    ]:
        bone(dest(n), head(tag(a)), head(tag(b)), par)
    bone(dest("ball"), head(tag("Toe01_1")), landmarks[tag("Toe01_2")][1], dest("foot"))
    for src, dst in [
        ("Index", "index"),
        ("Mid", "middle"),
        ("Ring", "ring"),
        ("Pinky", "pinky"),
        ("Thumb", "thumb"),
    ]:
        for j in (1, 2, 3):
            bone(
                dest(f"{dst}_0{j}"),
                *landmarks[tag(f"{src}{j}")],
                dest("hand") if j == 1 else dest(f"{dst}_0{j-1}"),
            )


def mapped(name):
    name = name.split(".")[0]
    side = name[-1:].lower() if name.endswith(("_R", "_L")) else ""
    stem = name[:-2] if side else name
    if stem.startswith(("hip", "pelvis", "Buttock", "CMIDF")):
        return "pelvis"
    if stem in ("spineLower", "spineUpper"):
        return "spine_01" if stem == "spineLower" else "spine_02"
    if stem.startswith(("spineChest", "chestUpper", "Back")):
        return "spine_03"
    if stem.startswith("neck"):
        return "neck_01"
    if stem == "head":
        return "Head"
    for prefix, target in [
        ("Collar", "clavicle"),
        ("Shoulder", "upperarm"),
        ("UpperArm", "upperarm"),
        ("Forearm", "lowerarm"),
        ("elbow", "lowerarm"),
        ("Carpal", "hand"),
        ("Thigh", "thigh"),
        ("Shin", "calf"),
        ("Foot", "foot"),
        ("Toe", "ball"),
    ]:
        if stem.startswith(prefix):
            return target + "_" + side
    for prefix, target in [
        ("Index", "index"),
        ("Mid", "middle"),
        ("Ring", "ring"),
        ("Pinky", "pinky"),
        ("Thumb", "thumb"),
    ]:
        if stem.startswith(prefix):
            return f"{target}_0{stem[len(prefix)]}_{side}"
    return None


parts = []
eye = bpy.data.objects["TigaEyes"]
eyeids = {
    i
    for p in eye.data.polygons
    if eye.data.materials[p.material_index].name == "EYESEMI"
    for i in p.vertices
}
eyeOrigin = sum(
    (eye.matrix_world @ eye.data.vertices[i].co for i in eyeids), V()
) / len(eyeids)
for name in ["TigaBody", "TigaEyes", "TigaEnergy", "TigaEnergyContainer"]:
    obj = bpy.data.objects[name]
    vs = [obj.matrix_world @ v.co for v in obj.data.vertices]
    ws = []
    for v in obj.data.vertices:
        w = {}
        for g in v.groups:
            key = mapped(obj.vertex_groups[g.group].name)
            if key in defs:
                w[key] = w.get(key, 0) + g.weight
        if not w:
            w = {"Head" if name == "TigaEyes" else "spine_03": 1}
        ws.append(w)
    uv = obj.data.uv_layers.active
    faces = [
        (
            list(p.vertices),
            p.material_index,
            [tuple(uv.data[i].uv) if uv else (0, 0) for i in p.loop_indices],
        )
        for p in obj.data.polygons
    ]
    for hidden in [False, True]:
        batch = [
            f
            for f in faces
            if (
                name == "TigaEyes"
                or (
                    name == "TigaBody"
                    and sum(ws[i].get("Head", 0) for i in f[0]) / len(f[0]) > 0.35
                )
            )
            == hidden
        ]
        if batch:
            parts.append((name + ("Head" if hidden else ""), vs, ws, batch, hidden))
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
ad = bpy.data.armatures.new("Tiga FK")
rig = bpy.data.objects.new("Tiga Full Body", ad)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
for name, (start, end, parent) in defs.items():
    b = ad.edit_bones.new(name)
    b.head = start
    b.tail = end
    b.align_roll(
        V((0, -1, 0)) if abs((end - start).normalized().y) < 0.9 else V((0, 0, 1))
    )
    if parent:
        b.parent = ad.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")
rig.select_set(False)
rig["model_author"] = "Extrazhang"
rig["model_source"] = "https://blendswap.com/blend/26877"
rig["model_license"] = "CC BY-NC"
rig["motion_author"] = "Quaternius"
rig["motion_source"] = "https://quaternius.com/packs/universalanimationlibrary.html"
rig["clips"] = args.clip
rig["motion_license"] = "CC0 1.0"


def mat(name, color, metal=0.15, rough=0.48, emission=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    if emission:
        p.inputs["Emission Color"].default_value = (*color, 1)
        p.inputs["Emission Strength"].default_value = emission
    return m


silver = mat("Silver", (0.58, 0.62, 0.65), 0.45)
suit = mat("Multi-Type", (1, 1, 1))
gold = mat("Gold", (0.68, 0.43, 0.075), 0.5)
light = mat("Eye Light", (0.92, 0.87, 0.66), 0.15, 0.35, 0.6)
timer = mat("Color Timer", (0.02, 0.52, 0.83), 0.2, 0.35, 0.8)
tex = suit.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(str(repo / "art/textures/tiga/tiga-pbr-color.jpg"))
tex.image.pack()
suit.node_tree.links.new(
    tex.outputs["Color"],
    suit.node_tree.nodes.get("Principled BSDF").inputs["Base Color"],
)
meshes = []
for name, vs, ws, faces, hidden in parts:
    ids = sorted({i for f, _, _ in faces for i in f})
    remap = {i: j for j, i in enumerate(ids)}
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(
        [vs[i] for i in ids], [], [[remap[i] for i in f] for f, _, _ in faces]
    )
    mesh.update()
    uv = mesh.uv_layers.new(name="UVMap")
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.parent = rig
    obj["hide_at_eye"] = hidden
    meshes.append(obj)
    for m in (
        [silver, suit, gold]
        if name.startswith("TigaBody")
        else [light, silver]
        if name.startswith("TigaEyes")
        else [timer, silver, gold]
    ):
        mesh.materials.append(m)
    for p, (_, mi, coords) in zip(mesh.polygons, faces):
        p.material_index = min(mi, len(mesh.materials) - 1)
        p.use_smooth = True
        for i, c in zip(p.loop_indices, coords):
            uv.data[i].uv = c
    groups = {key: obj.vertex_groups.new(name=key) for key in defs}
    for j, i in enumerate(ids):
        weights = sorted(ws[i].items(), key=lambda kv: -kv[1])[:4]
        total = sum(v for _, v in weights)
        for key, val in weights:
            if val > 0:
                groups[key].add([j], val / total, "REPLACE")
    if name == "TigaBody":
        soleMesh = obj
        soleIndices = [j for j, i in enumerate(ids) if vs[i].z < 0.42]
    mod = obj.modifiers.new("Full Body Skin", "ARMATURE")
    mod.object = rig
# Eye anchor matrix is authored in rest space, before any action is applied.
eyeCamera = bpy.data.cameras.new("Eye Camera")
eyeCamera.lens = 24
eyeCamera.clip_start = 0.015
eyeNode = bpy.data.objects.new("EyeAnchor", eyeCamera)
scene.collection.objects.link(eyeNode)
eyeNode.parent = rig
eyeNode.parent_type = "BONE"
eyeNode.parent_bone = "Head"
bpy.context.view_layer.update()
eyeNode.matrix_world = Matrix(
    (
        (-1, 0, 0, eyeOrigin.x),
        (0, 0, 1, eyeOrigin.y),
        (0, 1, 0, eyeOrigin.z),
        (0, 0, 0, 1),
    )
)
bpy.context.view_layer.update()
# Load only data via Blender's glTF importer. The original source rig is untouched.
bpy.ops.import_scene.gltf(filepath=str(args.library))
source = next(o for o in scene.objects if o.type == "ARMATURE" and o != rig)
source.animation_data_create()
for track in source.animation_data.nla_tracks:
    track.mute = True
missing = sorted(set(defs) - set(source.data.bones.keys()))
if missing:
    raise ValueError(f"Input is missing mapped Quaternius bones: {missing}")
if bpy.data.actions.get(args.clip) is None:
    raise ValueError(f"Animation {args.clip!r} missing from input")

sr = {
    n: (source.matrix_world @ source.data.bones[n].matrix_local)
    .to_quaternion()
    .normalized()
    for n in defs
}
tr = {n: rig.data.bones[n].matrix_local.to_quaternion().normalized() for n in defs}
# Both authored rigs face Blender -Y with +Z up. Put target long axes into the
# source's bind stance (A vs. T pose), preserving each target bone's own roll.
Y = V((0, 1, 0))
aligned = {
    n: ((tr[n] @ Y).rotation_difference(sr[n] @ Y) @ tr[n]).normalized() for n in defs
}


# Align palms as well as finger directions. A long axis alone leaves the
# thumb's opposition and the roll of the knuckles ambiguous.
def palm_basis(wrist, index, middle, pinky):
    long = (middle - wrist).normalized()
    across = (index - pinky).normalized()
    normal = across.cross(long).normalized()
    return Matrix((long.cross(normal), long, normal)).transposed().to_quaternion()


for side in ("l", "r"):
    names = [f"{stem}_{side}" for stem in ("hand", "index_01", "middle_01", "pinky_01")]
    source_palm = palm_basis(
        *[source.matrix_world @ source.data.bones[n].head_local for n in names]
    )
    target_palm = palm_basis(*[defs[n][0] for n in names])
    matching = source_palm @ target_palm.inverted()
    aligned[names[0]] = matching @ tr[names[0]]
    for finger in ("thumb", "index", "middle", "ring", "pinky"):
        for number in (1, 2, 3):
            n = f"{finger}_0{number}_{side}"
            base_rotation = matching @ tr[n]
            aligned[n] = (base_rotation @ Y).rotation_difference(
                sr[n] @ Y
            ) @ base_rotation
last = {}
outFrame = 0
clipRanges = []
legScale = (head("hip").z - head("Foot_L").z) / (
    source.matrix_world @ source.data.bones["pelvis"].head_local
).z
for clipName in [args.clip]:
    a = bpy.data.actions[clipName]
    source.animation_data.action = a
    source.animation_data.action_slot = a.slots[0]
    lo, hi = a.frame_range
    steps = round(hi - lo)
    start = outFrame
    for i in range(steps + 1):
        if i == 0 and outFrame:
            continue
        f = lo + (hi - lo) * i / steps
        scene.frame_set(math.floor(f), subframe=f - math.floor(f))
        es = source.evaluated_get(bpy.context.evaluated_depsgraph_get())
        world = {}
        move = (
            es.matrix_world @ es.pose.bones["pelvis"].head
            - source.matrix_world @ source.data.bones["pelvis"].head_local
        ) * legScale
        points = {}
        for name in defs:
            pose = (
                (es.matrix_world @ es.pose.bones[name].matrix)
                .to_quaternion()
                .normalized()
            )
            world[name] = (pose @ sr[name].inverted() @ aligned[name]).normalized()
            parent = defs[name][2]
            points[name] = (
                defs[name][0] + move
                if parent is None
                else points[parent]
                + (world[parent] @ tr[parent].inverted())
                @ (defs[name][0] - defs[parent][0])
            )
        # The two characters have different head sizes, shoulder widths and arm
        # lengths. Preserve the source wrist trajectory relative to the animated eyes.
        targetEye = points["Head"] + (world["Head"] @ tr["Head"].inverted()) @ (
            eyeOrigin - defs["Head"][0]
        )
        for side in ("l", "r"):
            u, l, h = ("upperarm_" + side, "lowerarm_" + side, "hand_" + side)
            su, sl, sh = (
                source.matrix_world @ source.data.bones[n].head_local for n in (u, l, h)
            )
            upperLength = (defs[u][1] - defs[u][0]).length
            lowerLength = (defs[l][1] - defs[l][0]).length
            scale = (upperLength + lowerLength) / ((sl - su).length + (sh - sl).length)
            srcHead = es.matrix_world @ es.pose.bones["Head"].head
            headTurn = (
                es.matrix_world @ es.pose.bones["Head"].matrix
            ).to_quaternion() @ sr["Head"].inverted()
            sourceEye = srcHead + headTurn @ (eyeOrigin - defs["Head"][0]) / scale
            desired = (
                targetEye
                + ((es.matrix_world @ es.pose.bones[h].head) - sourceEye) * scale
            )
            # A guard can sit against the target's larger helmet even when the source
            # wrist clears the mannequin face. Ease only nearby wrists out of eye space.
            relative = desired - targetEye
            blend = max(0, min(1, (0.78 - relative.length) / 0.34))
            blend = blend * blend * (3 - 2 * blend)
            lateral = 1 if side == "l" else -1
            clear = V(
                (
                    lateral * max(lateral * relative.x, 0.33),
                    min(relative.y, -0.37),
                    min(relative.z, -0.15),
                )
            )
            desired = targetEye + relative.lerp(clear, blend)
            S, E, W = points[u], points[l], points[h]
            axis = (desired - S).normalized()
            # Preserve the source elbow bend while redirecting the wrist. A
            # face-clearance target must not turn the guarding arm into a
            # second punch. The original arm span already encodes that bend.
            reach = min((W - S).length, upperLength + lowerLength - 0.00005)
            reach = max(reach, abs(upperLength - lowerLength) + 0.00005)
            pole = E - S
            pole -= axis * pole.dot(axis)
            pole.normalize()
            along = (upperLength**2 + reach**2 - lowerLength**2) / (2 * reach)
            offset = max(0, upperLength**2 - along**2) ** 0.5
            elbow = S + axis * along + pole * offset
            wrist = S + axis * reach
            world[u] = (E - S).normalized().rotation_difference(
                (elbow - S).normalized()
            ) @ world[u]
            world[l] = (W - E).normalized().rotation_difference(
                (wrist - elbow).normalized()
            ) @ world[l]
        for name in defs:
            par = defs[name][2]
            parentBind = tr[par] if par else Quaternion()
            parentPose = world[par] if par else Quaternion()
            restLocal = parentBind.inverted() @ tr[name]
            rotation = (
                restLocal.inverted() @ parentPose.inverted() @ world[name]
            ).normalized()
            pb = rig.pose.bones[name]
            pb.rotation_mode = "QUATERNION"
            if name in last:
                rotation.make_compatible(last[name])
            last[name] = rotation.copy()
            pb.rotation_quaternion = rotation
            pb.keyframe_insert(
                data_path="rotation_quaternion", frame=outFrame, group=name
            )
            if name == "pelvis":
                pb.location = tr[name].inverted() @ move
                pb.keyframe_insert(data_path="location", frame=outFrame, group=name)
        # Correct the ground height for the target's different foot and leg lengths.
        sourceFloor = min(
            (es.matrix_world @ es.pose.bones[n].head).z
            - (source.matrix_world @ source.data.bones[n].head_local).z
            for n in ["foot_l", "foot_r"]
        )
        scene.frame_set(outFrame)
        deformed = soleMesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        ground = min(
            (deformed.matrix_world @ deformed.data.vertices[i].co).z
            for i in soleIndices
        )
        pelvis = rig.pose.bones["pelvis"]
        pelvis.location += tr["pelvis"].inverted() @ V(
            (0, 0, max(0, sourceFloor) * legScale - ground)
        )
        pelvis.keyframe_insert(data_path="location", frame=outFrame, group="pelvis")
        outFrame += 1
    clipRanges.append((clipName, start, outFrame - 1))
scene.frame_start = 0
scene.frame_end = outFrame - 1
scene.frame_set(0)
for o in list(scene.objects):
    if o != rig and o != eyeNode and o not in meshes:
        bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions):
    if a != rig.animation_data.action:
        bpy.data.actions.remove(a)
rig.animation_data.action.name = args.clip
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
eyeNode.select_set(True)
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = rig
path = args.output
path.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(path),
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_skins=True,
    export_def_bones=True,
    export_extras=True,
    export_cameras=True,
    export_force_sampling=True,
    export_frame_range=True,
)
print(
    "RETARGETED",
    len(defs),
    clipRanges,
    "fps",
    scene.render.fps,
    "eye",
    list(eyeOrigin),
    "file",
    path.stat().st_size,
)
