"""Export Extrazhang's complete Tiga mesh with a clean FK rig for third person.

Uses the same source and calibrated PBR textures as the first-person derivative.
Run Blender in background with --disable-autoexec --threads 1.
"""
import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/sources/tiga/Ultraman Tiga.blend'),load_ui=False,use_scripts=False)
source=bpy.data.objects['Armature.001'];source.data.pose_position='REST'
bones={b.name:(source.matrix_world@b.head_local,source.matrix_world@b.tail_local)for b in source.data.bones}
records=[]
for name in ['TigaBody','TigaEyes','TigaEnergy','TigaEnergyContainer']:
    obj=bpy.data.objects[name];groups={g.index:g.name for g in obj.vertex_groups}
    records.append((name,[obj.matrix_world@v.co for v in obj.data.vertices],[[ (groups[g.group],g.weight) for g in v.groups]for v in obj.data.vertices],[(list(p.vertices),p.material_index,[tuple(obj.data.uv_layers.active.data[i].uv)for i in p.loop_indices] if obj.data.uv_layers.active else None)for p in obj.data.polygons]))
for obj in list(bpy.data.objects):bpy.data.objects.remove(obj,do_unlink=True)
def material(name,color,metal=.1,rough=.5,texture=False,emission=0):
    mat=bpy.data.materials.new(name);mat.use_nodes=True;bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1);bsdf.inputs['Metallic'].default_value=metal;bsdf.inputs['Roughness'].default_value=rough
    if emission:bsdf.inputs['Emission Color'].default_value=(*color,1);bsdf.inputs['Emission Strength'].default_value=emission
    if texture:
        for file,space in [('tiga-pbr-color.jpg','sRGB'),('tiga-metal-rough.png','Non-Color')]:
            image=bpy.data.images.load(str(ROOT/'art/textures/tiga'/file),check_existing=False);image.scale(1024,1024);image.colorspace_settings.name=space;image.pack();node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
            if space=='sRGB':mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
            else:
                sep=mat.node_tree.nodes.new('ShaderNodeSeparateColor');mat.node_tree.links.new(node.outputs['Color'],sep.inputs['Color']);mat.node_tree.links.new(sep.outputs['Green'],bsdf.inputs['Roughness']);mat.node_tree.links.new(sep.outputs['Blue'],bsdf.inputs['Metallic'])
    return mat
silver=material('Tiga body silver',(.58,.62,.65),.45,.4);suit=material('Tiga body Multi-Type',(1,1,1),texture=True);gold=material('Tiga body gold',(.72,.51,.10),.55,.4)
eyes=material('Tiga eyes',(.94,.87,.55),emission=1.4);rim=material('Tiga eye rim',(.12,.15,.19),.5,.4);timer=material('Tiga color timer',(.1,.75,1),emission=1.5)
definitions=[]
for name,parent in [('hip',None),('spineLower','hip'),('spineUpper','spineLower'),('spineChest','spineUpper'),('chestUpper','spineChest'),('neckLower','chestUpper'),('neckUpper','neckLower'),('head','neckUpper')]:definitions.append((name,*bones[name],parent))
for side in ['L','R']:
    suffix='_'+side
    definitions.extend([('Collar'+suffix,*bones['Collar'+suffix],'chestUpper'),('UpperArm'+suffix,bones['armBase'+suffix][0],bones['ForearmBase'+suffix][0],'Collar'+suffix),('LowerArm'+suffix,bones['ForearmBase'+suffix][0],bones['HandBase'+suffix][0],'UpperArm'+suffix),('Hand'+suffix,bones['HandBase'+suffix][0],bones['Mid1'+suffix][0],'LowerArm'+suffix)])
    for finger in ['Index','Mid','Ring','Pinky','Thumb']:
        for joint in [1,2,3]:
            name=f'{finger}{joint}{suffix}';definitions.append((name,*bones[name],'Hand'+suffix if joint==1 else f'{finger}{joint-1}{suffix}'))
    for name,parent in [('Thigh','hip'),('Shin','Thigh'+suffix),('Foot','Shin'+suffix)]:definitions.append((name+suffix,*bones[name+suffix],parent))
data=bpy.data.armatures.new('Tiga full-body skeleton');rig=bpy.data.objects.new('TigaBodyRig',data);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,head,tail,parent in definitions:
    bone=data.edit_bones.new(name);bone.head=head;bone.tail=tail;bone.align_roll(Vector((0,1,0)))
    if parent:bone.parent=data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');names={d[0]for d in definitions}
def mapped(name):
    if name.endswith('.001'):name=name[:-4]
    if name in names:return name
    for side in ['L','R']:
        suffix='_'+side
        if not name.endswith(suffix):continue
        stem=name[:-2]
        if stem in ['Shoulder','ShoulderTwist','ShoulderFixB','UpperArmCellulite']:return 'UpperArm'+suffix
        if stem in ['Forearm','ForearmTwist','elbow']:return 'LowerArm'+suffix
        if stem.startswith('Carpal'):return 'Hand'+suffix
        if stem.startswith('Pinky1T'):return 'Pinky1'+suffix
        if stem.startswith('Pinky2T'):return 'Pinky2'+suffix
        if stem.startswith(('Thigh','Buttock')):return 'Thigh'+suffix
        if stem.startswith(('Foot','Toe')):return 'Foot'+suffix
        if stem=='pelvis':return 'hip'
    if name.startswith('Back')or name=='spineChest.001':return 'spineChest'
    if name=='CMIDF':return 'chestUpper'
    return 'hip'
for name,vertices,weights,faces in records:
    mesh=bpy.data.meshes.new(name+' third person');mesh.from_pydata(vertices,[],[face[0]for face in faces]);mesh.update();uv=mesh.uv_layers.new(name='UVMap')
    for polygon,(_,index,coords)in zip(mesh.polygons,faces):
        polygon.material_index=index;polygon.use_smooth=True
        if coords:
            for loop,coord in zip(polygon.loop_indices,coords):uv.data[loop].uv=coord
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.parent=rig
    for mat in [silver,suit,gold] if name=='TigaBody' else [eyes,rim] if name=='TigaEyes' else [timer] if name=='TigaEnergy' else [silver]:mesh.materials.append(mat)
    groups={n:obj.vertex_groups.new(name=n)for n in names}
    for index,original in enumerate(weights):
        merged={}
        for group,weight in original:
            target=mapped(group);merged[target]=merged.get(target,0)+weight
        if not merged:merged={'head' if name=='TigaEyes' else 'chestUpper':1}
        top=sorted(merged.items(),key=lambda item:item[1],reverse=True)[:4];total=sum(w for _,w in top)
        for group,weight in top:groups[group].add([index],weight/total,'REPLACE')
    modifier=obj.modifiers.new('Clean FK skin','ARMATURE');modifier.object=rig
rig['bone_tips']={name:[tail.x,tail.z,-tail.y]for name,_,tail,_ in definitions};rig['source_author']='Extrazhang';rig['source_url']='https://blendswap.com/blend/26877';rig['license']='CC-BY-NC'
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for child in rig.children:child.select_set(True)
output=ROOT/'public/models/kaiju/hero-body.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_def_bones=True,export_extras=True,export_cameras=False,export_lights=False)
print('TIGA_BODY_EXPORTED',output.stat().st_size,'bones',len(definitions))
