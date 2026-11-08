"""Bend an MMD tail chain behind the feet as a soft arc.

Downloaded kaiju often ship a long tail chain (``hair``/``尻尾``) that hangs
straight down past the feet. Rendered in the game that tail stands in front of
the legs, drags through the ground plane, and - because the lowest point of the
mesh is the tail tip - lifts the feet off the ground.

Two things are wrong with the raw model:

* the chain is rigid: every segment is skinned with weight 1.0, so bending it
  folds the tail like a hinge instead of curving it;
* nothing bends it at all.

``pose_tail`` fixes both: it re-weights the tail smoothly along the chain and
dresses the chain along a quarter ellipse that leaves the leg root pointing
straight down and arrives tangentially on the ground behind the feet. The pose is
baked into the rest skeleton so the exported GLB keeps it.

Both the weights and the arc are computed from the rest skeleton, so a model
without a hanging tail is left untouched (returns ``None``).
"""

import math

import bpy
from mathutils import Vector

TAIL_NAMES = ("hair", "尻尾", "しっぽ", "tail")
HELPER_PREFIXES = ("_shadow", "_dummy", "hairCTRL", "mmd_")
HIP_BONES = ("足.L", "足.R", "下半身", "L_LEG", "R_LEG", "KOSHI")
ANKLE_BONES = ("足首.L", "足首.R", "L_ASHI", "R_ASHI")
TOE_BONES = ("つま先.L", "つま先.R", "toe.L", "toe.R", "L_TUMA", "R_TUMA")
FOOT_BONES = ANKLE_BONES + TOE_BONES


def _match(name):
    lowered = name.lower()
    for needle in TAIL_NAMES:
        if lowered.startswith(needle.lower()):
            return True
    return False


def _dominant_groups(meshes):
    """Bone names that actually skin geometry (helper bones have no weights)."""
    used = set()
    for mesh in meshes:
        names = {group.index: group.name for group in mesh.vertex_groups}
        for vertex in mesh.data.vertices:
            best = max(
                (g for g in vertex.groups if not names[g.group].startswith("mmd_")),
                key=lambda g: g.weight,
                default=None,
            )
            if best is not None:
                used.add(names[best.group])
    return used


def _chain(rig, meshes):
    used = _dominant_groups(meshes)
    bones = [
        bone
        for bone in rig.data.bones
        if _match(bone.name)
        and bone.name in used
        and not bone.name.startswith(HELPER_PREFIXES)
    ]
    bones.sort(key=lambda bone: -bone.head_local.z)
    if len(bones) < 3:
        return []
    # A tail chain descends monotonically; drop bones that break the run.
    chain = [bones[0]]
    for bone in bones[1:]:
        if bone.head_local.z < chain[-1].head_local.z:
            chain.append(bone)
    return chain


def _joints(chain):
    points = [chain[0].head_local.copy()]
    for bone in chain:
        points.append(points[-1] + (bone.tail_local - bone.head_local).normalized() * bone.length)
    return points


def _cumulative(chain):
    values = [0.0]
    for bone in chain:
        values.append(values[-1] + bone.length)
    return values


def _soft_weights(meshes, chain, reach):
    """Blend each tail vertex between the two bones around its arc position."""
    index = {bone.name: i for i, bone in enumerate(chain)}
    cumulative = _cumulative(chain)
    joints = _joints(chain)
    blended = 0
    for mesh in meshes:
        groups = {group.name: group.index for group in mesh.vertex_groups}
        tail_ids = {groups[name] for name in index if name in groups}
        if not tail_ids:
            continue
        for vertex in mesh.data.vertices:
            if sum(g.weight for g in vertex.groups if g.group in tail_ids) < 0.2:
                continue
            best = (1e18, 0, 0.0)
            for i in range(len(joints) - 1):
                segment = joints[i + 1] - joints[i]
                t = max(0.0, min(1.0, (vertex.co - joints[i]).dot(segment) / (segment.length_squared or 1e-9)))
                distance = (vertex.co - (joints[i] + segment * t)).length
                if distance < best[0]:
                    best = (distance, i, t)
            if best[0] > reach:
                continue
            position = cumulative[best[1]] + chain[best[1]].length * best[2]
            k = 0
            while k < len(chain) - 1 and position > cumulative[k + 1]:
                k += 1
            local = max(0.0, min(1.0, (position - cumulative[k]) / (chain[k].length or 1e-6)))
            for group in list(vertex.groups):
                if group.group in tail_ids:
                    mesh.vertex_groups[group.group].remove([vertex.index])
            if 1 - local > 0.001:
                mesh.vertex_groups[groups[chain[k].name]].add([vertex.index], 1 - local, "REPLACE")
            if local > 0.001 and k + 1 < len(chain):
                mesh.vertex_groups[groups[chain[k + 1].name]].add([vertex.index], local, "REPLACE")
            blended += 1
    return blended


def _quarter_length(a, b, steps=720):
    total = 0.0
    for i in range(steps):
        t = math.pi / 2 * (i + 0.5) / steps
        total += math.hypot(a * math.sin(t), b * math.cos(t))
    return total * (math.pi / 2) / steps


def _solve_horizontal(drop, length):
    """Horizontal semi-axis whose quarter ellipse has the tail's arc length."""
    low, high = 1e-3, drop * 60 + length * 4
    for _ in range(120):
        mid = (low + high) / 2
        if _quarter_length(mid, drop) < length:
            low = mid
        else:
            high = mid
    return (low + high) / 2


def _arc_to_t(target, a, b, steps=1200):
    dt = (math.pi / 2) / steps
    travelled = 0.0
    for i in range(steps):
        t = dt * (i + 0.5)
        segment = math.hypot(a * math.sin(t), b * math.cos(t)) * dt
        if travelled + segment >= target:
            return dt * i + dt * (target - travelled) / segment
        travelled += segment
    return math.pi / 2


def pose_tail(rig, meshes):
    """Bend a hanging tail behind the feet; returns a report dict or None."""
    chain = _chain(rig, meshes)
    if not chain:
        return None
    top = max(max(vertex.co.z for vertex in mesh.data.vertices) for mesh in meshes)
    feet = [rig.data.bones[name].head_local.z for name in FOOT_BONES if name in rig.data.bones]
    hips = [rig.data.bones[name].head_local.z for name in HIP_BONES if name in rig.data.bones]
    hip = min(hips) if hips else top * 0.55
    ground = min(feet) if feet else 0.0
    if chain[-1].head_local.z > ground - top * 0.05:
        return None  # not a tail hanging past the feet

    reach = top * 0.06
    blended = _soft_weights(meshes, chain, reach)

    start = next(i for i, bone in enumerate(chain) if bone.head_local.z <= hip)
    bend = chain[start:]
    drop = max(chain[start].head_local.z - ground - top * 0.035, top * 0.08)
    length = sum(bone.length for bone in bend)
    horizontal = _solve_horizontal(drop, length)

    # Bend plane: "back" is away from the toes, so the tail trails behind.
    back = Vector((0.0, 1.0, 0.0))
    toes = [rig.data.bones[name] for name in TOE_BONES if name in rig.data.bones]
    ankles = [rig.data.bones[name] for name in ANKLE_BONES if name in rig.data.bones]
    if toes and ankles:
        forward = Vector((0.0, 0.0, 0.0))
        for toe in toes:
            closest = min(ankles, key=lambda bone: (bone.head_local - toe.head_local).length)
            forward += toe.head_local - closest.head_local
        forward.z = 0.0
        if forward.length > 1e-6:
            back = -forward.normalized()

    angles = [0.0] * start
    walked = 0.0
    for bone in bend:
        t = _arc_to_t(walked + bone.length * 0.5, horizontal, drop)
        dx = horizontal * math.sin(t)
        dz = -drop * math.cos(t)
        norm = math.hypot(dx, dz) or 1e-9
        angles.append(math.degrees(math.atan2(dx / norm, -dz / norm)))
        walked += bone.length

    directions = [
        back * math.sin(math.radians(angle)) + Vector((0.0, 0.0, -1.0)) * math.cos(math.radians(angle))
        for angle in angles
    ]
    # Cache names: baking the pose rewrites bone data and invalidates references.
    names = [bone.name for bone in chain]
    lengths = [bone.length for bone in chain]
    heads = []
    position = chain[0].head_local.copy()
    for length, direction in zip(lengths, directions):
        heads.append(position.copy())
        position = position + direction * length

    for bone, direction, head in zip(chain, directions, heads):
        pose_bone = rig.pose.bones[bone.name]
        rest_rotation = bone.matrix_local.to_quaternion().to_matrix()
        rest_direction = (rest_rotation @ Vector((0.0, 1.0, 0.0))).normalized()
        matrix = (rest_direction.rotation_difference(direction).to_matrix() @ rest_rotation).to_4x4()
        matrix.translation = head
        pose_bone.matrix = matrix
        bpy.context.view_layer.update()

    # Baking the pose would snap the skinned mesh back to its authored shape, so
    # capture the deformed positions first and write them back afterwards: bones
    # end up along the arc and the vertices keep the bend.
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    deformed = []
    for mesh in meshes:
        evaluated = mesh.evaluated_get(depsgraph)
        data = evaluated.to_mesh()
        deformed.append([vertex.co.copy() for vertex in data.vertices])
        evaluated.to_mesh_clear()

    # Bake the arc into the rest skeleton so the GLB keeps it.
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.armature_apply()
    bpy.ops.object.mode_set(mode="OBJECT")

    for mesh, positions in zip(meshes, deformed):
        if len(mesh.data.vertices) != len(positions):
            continue
        for vertex, position in zip(mesh.data.vertices, positions):
            vertex.co = position
        mesh.data.update()
    bpy.context.view_layer.update()

    return {
        "chain": names,
        "bend_from": names[start],
        "vertical": start,
        "drop": round(drop, 1),
        "horizontal": round(horizontal, 1),
        "blended": blended,
        "tip": [round(value, 1) for value in position],
    }
