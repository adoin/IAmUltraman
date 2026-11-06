"""Convert the credited Red King source to a compact, skinned web model.

blender --background --factory-startup --disable-autoexec --python art/import_redking.py -- SOURCE.blend OUTPUT.glb
"""
import bpy, sys
from pathlib import Path
from mathutils import Vector
source, output = map(Path, sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
for obj in list(bpy.data.objects):
    if obj.type not in {'MESH','ARMATURE'} or obj.name=='BSurfaceMesh':
        bpy.data.objects.remove(obj,do_unlink=True)
for obj in bpy.data.objects:
    if obj.animation_data:
        for driver in list(obj.animation_data.drivers): obj.driver_remove(driver.data_path,driver.array_index)
for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    nodes=mat.node_tree.nodes
    for node in list(nodes):
        if node.type=='TEX_IMAGE' and (not node.image or not node.image.size[0]): nodes.remove(node)
    for node in nodes:
        if node.type=='BSDF_PRINCIPLED':
            node.inputs['Metallic'].default_value=0
            node.inputs['Roughness'].default_value=.72
for image in bpy.data.images:
    if image.size[0] and image.name!='Render Result':
        limit=2048 if 'Body' in image.name else 512
        if max(image.size)>limit: image.scale(limit,limit)
# Retain the evaluated rest stance before removing source-only IK controls.
bpy.context.view_layer.update()
matrices={p.name:p.matrix.copy() for p in rig.pose.bones}
for bone in rig.pose.bones:
    for constraint in list(bone.constraints): bone.constraints.remove(constraint)
bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for suffix in ['L','R']:
    hand=rig.data.edit_bones['hand.'+suffix]
    hand.parent=rig.data.edit_bones['forearm.'+suffix];hand.use_connect=False
    foot=rig.data.edit_bones['foot.'+suffix];foot.parent=rig.data.edit_bones['knee.'+suffix];foot.use_connect=False
bpy.ops.object.mode_set(mode='OBJECT')
for bone in rig.pose.bones:
    bone.rotation_mode='XYZ';bone.matrix=matrices[bone.name]
bpy.context.view_layer.update()
# Orient the real upper-arm and forearm bones into a gathered fighting stance.
# Work in armature space so the source rig's bone roll is preserved.
def aim(name,direction):
    bone=rig.pose.bones[name];matrix=bone.matrix.copy();position=matrix.translation.copy()
    current=matrix.to_3x3()@Vector((0,1,0));swing=current.rotation_difference(Vector(direction).normalized()).to_matrix().to_4x4()
    matrix.translation=(0,0,0);matrix=swing@matrix;matrix.translation=position;bone.matrix=matrix
    bpy.context.view_layer.update()
for suffix,sign in [('L',1),('R',-1)]:
    aim('upperarm.'+suffix,(sign*.5,-.3,-.8))
    aim('forearm.'+suffix,(sign*.25,-.8,.35))
    hand=rig.pose.bones['hand.'+suffix];matrix=hand.matrix.copy();matrix.translation=rig.pose.bones['forearm.'+suffix].tail;hand.matrix=matrix
    bpy.context.view_layer.update()
bpy.context.scene.frame_set(0)
root=bpy.data.objects.new('RedKing',None);bpy.context.scene.collection.objects.link(root)
for obj in list(bpy.context.scene.objects):
    if obj!=root and obj.parent is None: obj.parent=root
bpy.context.view_layer.update()
points=[obj.matrix_world@Vector(corner) for obj in bpy.context.scene.objects if obj.type=='MESH' for corner in obj.bound_box]
height=max(p.z for p in points)-min(p.z for p in points)
root.scale=(16/height,)*3;root.location.z=-min(p.z for p in points)*16/height
root['source']='https://sketchfab.com/3d-models/red-king-ultraman-kaiju-all-time-2b1f4461cf454c178814b2948a442fd0'
root['license']='CC BY 4.0';root['credit']='Violi / SlightlyPurplish; Sketchfab chaosFerEBIRTH'
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_image_format='JPEG',export_jpeg_quality=85,export_animations=False,export_skins=True,export_cameras=False,export_lights=False,export_extras=True)
print('WEB_SIZE',output.stat().st_size)
