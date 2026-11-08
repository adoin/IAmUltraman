"""Convert a downloaded MMD model (PMD/PMX) into a skinned web GLB.

The kaiju keep their skeleton so the game can animate them the way it animates
Red King: MonsterMotion aims the arm, spine and leg bones for casts, charges,
punches, hits and death, and reads the real hand bone for projectile origins.

  blender --background --factory-startup --disable-autoexec --python art/import_mmd.py -- \
      MODEL.pmd public/models/kaiju/baltan-new.glb

Needs the mmd_tools addon on BLENDER_USER_SCRIPTS plus opencc in Blender's
Python (see art/README.md).
"""

import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mmd_tail import pose_tail  # noqa: E402

source, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module="mmd_tools")
bpy.ops.mmd_tools.import_model(filepath=str(source), scale=1.0)

scene = bpy.context.scene
meshes = [obj for obj in scene.objects if obj.type == "MESH"]
if not meshes:
    raise ValueError("no mesh imported")
rigs = [obj for obj in scene.objects if obj.type == "ARMATURE"]
if not rigs:
    raise ValueError("no armature imported")
rig = rigs[0]
# Drop rigid bodies, joints, empties and cameras; keep the skinned figure only.
allowed = set(meshes) | {rig}
for obj in list(scene.objects):
    if obj not in allowed and obj.type in {"EMPTY", "CAMERA", "LIGHT", "MESH"}:
        bpy.data.objects.remove(obj, do_unlink=True)
for obj in list(scene.objects):
    if obj.type not in {"MESH", "ARMATURE"}:
        bpy.data.objects.remove(obj, do_unlink=True)


def collect_images(nodes, found):
    for node in nodes:
        if node.type == "TEX_IMAGE" and node.image:
            found.append(node.image)
        elif node.type == "GROUP" and node.node_tree:
            collect_images(node.node_tree.nodes, found)
    return found


for material in list(bpy.data.materials):
    tree = getattr(material, "node_tree", None)
    images = collect_images(tree.nodes, []) if tree else []
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    output_node = tree.nodes.new("ShaderNodeOutputMaterial")
    shader = tree.nodes.new("ShaderNodeBsdfPrincipled")
    tree.links.new(shader.outputs["BSDF"], output_node.inputs["Surface"])
    shader.inputs["Metallic"].default_value = 0.0
    shader.inputs["Roughness"].default_value = 0.62
    # MMD diffuse alpha is a toon mask, not transparency; keep panels opaque.
    shader.inputs["Alpha"].default_value = 1.0
    material.blend_method = "OPAQUE"
    material.use_backface_culling = False
    if images:
        image = max(images, key=lambda image: image.size[0])
        node = tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        tree.links.new(node.outputs["Color"], shader.inputs["Base Color"])

for image in bpy.data.images:
    if max(image.size) > 1024:
        image.scale(1024, 1024)

# Bend a tail that hangs past the feet behind the model before measuring it,
# otherwise the tail tip becomes the lowest point and the feet float.
tail = pose_tail(rig, meshes)
print("TAIL_POSE", json.dumps(tail, ensure_ascii=False) if tail else "none")


def measured_bounds():
    """Deformed world-space bounds: object bound_box ignores armature posing."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    low = Vector((1e18, 1e18, 1e18))
    high = Vector((-1e18, -1e18, -1e18))
    for mesh in meshes:
        evaluated = mesh.evaluated_get(depsgraph)
        data = evaluated.to_mesh()
        for vertex in data.vertices:
            point = evaluated.matrix_world @ vertex.co
            for axis in range(3):
                low[axis] = min(low[axis], point[axis])
                high[axis] = max(high[axis], point[axis])
        evaluated.to_mesh_clear()
    return low, high


# Normalise through the armature transform so the skinned meshes follow it.
bpy.context.view_layer.update()
low, high = measured_bounds()
height = high.z - low.z
scale = 16 / height if height else 1
rig.scale = (rig.scale.x * scale, rig.scale.y * scale, rig.scale.z * scale)
bpy.context.view_layer.update()
low, high = measured_bounds()
rig.location = (
    rig.location.x - (low.x + high.x) / 2,
    rig.location.y - (low.y + high.y) / 2,
    rig.location.z - low.z,
)
bpy.context.view_layer.update()

# Face Blender -Y using the ankle-to-toe bones of the rest skeleton. Rigs name
# these both ways: 足首.L / つま先.L and L_ASHI / L_TUMA.
def find_bone(needles, letter):
    bones = list(rig.data.bones)
    for needle in needles:
        for bone in bones:
            name = bone.name.upper()
            if "IK" in name:
                continue
            if letter in name and (needle in bone.name or needle in name):
                return bone
    return None


forward = Vector()
for letter in ("L", "R"):
    ankle = find_bone(("足首", "ASHI", "FOOT"), letter)
    toe = find_bone(("つま先", "TUMA", "TOE"), letter)
    if ankle and toe:
        forward += toe.head_local - ankle.head_local
        print("FACING_BONES", ankle.name, toe.name)
    else:
        print("FACING_SKIP", letter, ankle.name if ankle else None, toe.name if toe else None)
if forward.length > 1e-6:
    forward.z = 0
    forward.normalize()
    turn = forward.rotation_difference(Vector((0, -1, 0))).to_matrix().to_4x4()
    rig.matrix_world = turn @ rig.matrix_world
bpy.context.view_layer.update()

rig["model_author"] = "MMD model by 这是我的刀盾 (see THIRD_PARTY_NOTICES.md)"
rig["rig"] = "mmd"
bpy.ops.object.select_all(action="DESELECT")
for obj in meshes:
    obj.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format="GLB",
    use_selection=True,
    export_skins=True,
    export_animations=False,
    export_morph=False,
    export_cameras=False,
    export_lights=False,
    export_image_format="JPEG",
    export_jpeg_quality=88,
    export_extras=True,
)
bones = [bone.name for bone in rig.data.bones]
print("MMD_GLB", source.name, "meshes", len(meshes), "bones", len(bones),
      "tris", sum(len(m.data.loop_triangles) for m in meshes), "file", output.stat().st_size)
print("MMD_BONES", [name for name in bones if any(key in name for key in ("ZYOUWAN", "UDE", "TE", "MUNE", "KOSHI", "KUBI", "KAO", "MOMO", "SUNE", "ASHI"))])
