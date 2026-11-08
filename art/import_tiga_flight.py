"""Bake a take-off pose for the downloaded Tiga mesh.

The pack ships 60 Max-Biped vertex groups but no armature, and its FBX has no
weights at all, so there is nothing to bind to. Rebuilding a skeleton and
rotating bones tears the shoulder seam: the reconstructed pivots are only
approximations and the original weights blend across bones that end up moving
differently.

Instead the arms are posed directly in vertex space, the way a rigger would
push a limb: rotate every vertex of the arm about the measured shoulder joint,
with a smooth falloff across the shoulder so the deltoid, sleeve and chest meet
without a visible seam.

  blender --background --factory-startup --disable-autoexec --python art/import_tiga_flight.py -- SRC.blend OUT.glb
"""

import sys
from pathlib import Path

import bpy
from mathutils import Vector

source, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])

bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
mesh = bpy.data.objects["迪迦"]
for obj in list(bpy.data.objects):
    if obj is not mesh:
        bpy.data.objects.remove(obj, do_unlink=True)

bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mesh.parent = None
for modifier in list(mesh.modifiers):
    mesh.modifiers.remove(modifier)

# --------------------------------------------------------------- group geometry
names = {group.index: group.name for group in mesh.vertex_groups}
weighted = {index: [Vector(), 0.0] for index in names}
per_vertex = []
for vertex in mesh.data.vertices:
    weights = {}
    for element in vertex.groups:
        if element.weight <= 0:
            continue
        weights[names[element.group]] = element.weight
        bucket = weighted[element.group]
        bucket[0] += vertex.co * element.weight
        bucket[1] += element.weight
    per_vertex.append(weights)
centre = {
    names[index]: (total / weight if weight else Vector())
    for index, (total, weight) in weighted.items()
}


def point(name):
    return centre[name]


up = (point("Bip001 Neck") - point("Bip001 Pelvis")).normalized()
forward = Vector((0, -1, 0))
if abs(forward.dot(up)) > 0.9:
    forward = Vector((0, 0, 1))
forward = (forward - up * forward.dot(up)).normalized()

fingers = ("Finger0", "Finger01", "Finger02", "Finger1", "Finger11", "Finger12",
           "Finger2", "Finger21", "Finger22", "Finger3", "Finger31", "Finger32",
           "Finger4", "Finger41", "Finger42")


def arm_groups(side):
    owned = [f"Bip001 {side}UpArmTwist", f"Bip001 {side}UpArmTwist1",
             f"Bip001 {side} ForeTwist", f"Bip001 {side} ForeTwist1",
             f"Bip001 {side} Hand"]
    owned += [f"Bip001 {side} {finger}" for finger in fingers]
    return [name for name in owned if name in centre]


def smoothstep(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


# ------------------------------------------------------------------- keep the pose
# The authored A-pose is kept untouched. Swinging one arm up needs a ~150 degree
# rotation about the shoulder, and this mesh blends the deltoid between the
# clavicle and two twist bones; any single-bone swing tears the shoulder seam.
# The take-off is therefore sold by the body tilt and the climb in the game.
report = []
for side in ("L", "R"):
    wrist = point(f"Bip001 {side} Hand")
    elbow = wrist + (point(f"Bip001 {side} ForeTwist") - wrist) * 2.0
    shoulder = elbow + (point(f"Bip001 {side}UpArmTwist") - elbow) * 2.0
    report.append((side, [round(v, 4) for v in shoulder], [round(v, 4) for v in elbow],
                   [round(v, 4) for v in wrist]))
mesh.data.update()
if getattr(mesh.data, "has_custom_normals", False):
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.mesh.customdata_custom_splitnormals_clear()

# Turn the figure so the toes point along Blender -Y, matching project assets.
toe_direction = Vector()
for side in ("L", "R"):
    toe_direction += point(f"Bip001 {side} Toe0") - point(f"Bip001 {side} Foot")
toe_direction -= up * toe_direction.dot(up)
if toe_direction.length > 1e-6:
    toe_direction.normalize()
    turn = toe_direction.rotation_difference(Vector((0, -1, 0))).to_matrix().to_4x4()
    mesh.matrix_basis = turn @ mesh.matrix_basis
    bpy.context.view_layer.update()
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.transform_apply(rotation=True)
    print("FACING", [round(value, 3) for value in toe_direction])

# --------------------------------------------------------------------- materials
for material in list(bpy.data.materials):
    if material.name != "迪迦":
        bpy.data.materials.remove(material)
material = bpy.data.materials["迪迦"]
material.use_nodes = True
tree = material.node_tree
tree.nodes.clear()
nodes = tree.nodes
links = tree.links
output_node = nodes.new("ShaderNodeOutputMaterial")
shader = nodes.new("ShaderNodeBsdfPrincipled")
links.new(shader.outputs["BSDF"], output_node.inputs["Surface"])
shader.inputs["Metallic"].default_value = 0.0
shader.inputs["Roughness"].default_value = 0.52
shader.inputs["Emission Strength"].default_value = 2.2


def texture(image_name, colorspace, limit):
    image = bpy.data.images[image_name]
    if max(image.size) > limit:
        image.scale(limit, limit)
    image.colorspace_settings.name = colorspace
    node = nodes.new("ShaderNodeTexImage")
    node.image = image
    return node


base = texture("迪迦.png", "sRGB", 1024)
links.new(base.outputs["Color"], shader.inputs["Base Color"])
emissive = texture("迪迦发光.png", "sRGB", 512)
links.new(emissive.outputs["Color"], shader.inputs["Emission Color"])
normal_image = texture("迪迦法线.png", "Non-Color", 1024)
normal_map = nodes.new("ShaderNodeNormalMap")
normal_map.inputs["Strength"].default_value = 1.0
links.new(normal_image.outputs["Color"], normal_map.inputs["Color"])
links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])

for image in list(bpy.data.images):
    if image.name in {"迪迦.png", "迪迦发光.png", "迪迦法线.png", "迪迦RGB.png"}:
        continue
    if image.users == 0:
        bpy.data.images.remove(image)

# ------------------------------------------------------------------------ export
mesh.data.calc_loop_triangles()
mesh["model_author"] = "downloaded community Tiga model (see art/sources/迪迦/SOURCE.md)"
mesh["pose"] = "authored A-pose kept; the game tilts and flies the figure"
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_animations=False,
    export_skins=False,
    export_cameras=False,
    export_lights=False,
    export_image_format="JPEG",
    export_jpeg_quality=88,
    export_extras=True,
)
bounds = [mesh.matrix_world @ Vector(corner) for corner in mesh.bound_box]
height = max(p.z for p in bounds) - min(p.z for p in bounds)
print("FLIGHT_POSE", "arms", report, "tris", len(mesh.data.loop_triangles), "height", round(height, 3), "file", output.stat().st_size)

