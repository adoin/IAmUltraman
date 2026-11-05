"""Create first-person skinned arms from Extrazhang's CC-BY-NC Ultraman Tiga.

blender --background --factory-startup --disable-autoexec --python art/import_tiga.py
The original is retained unchanged in art/sources/tiga. Never enable its legacy drivers.
"""
import bpy,bmesh,math,json
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'art/sources/tiga/Ultraman Tiga.blend'
TEXTURES=ROOT/'art/textures/tiga'
TEXTURES.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False,use_scripts=False)
body=bpy.data.objects['TigaBody'];source_rig=bpy.data.objects['Armature.001']
# Read the author's neutral geometry, not an evaluated pose driven by old constraints.
if body.data.shape_keys:
    for key in body.data.shape_keys.key_blocks:key.value=0
source_rig.data.pose_position='REST'
bpy.context.view_layer.update()
positions=[body.matrix_world@v.co for v in body.data.vertices]
groups={g.index:g.name for g in body.vertex_groups}
weights=[{groups[g.group]:g.weight for g in v.groups}for v in body.data.vertices]
polygons=[(list(p.vertices),p.material_index,[tuple(body.data.uv_layers.active.data[i].uv)for i in p.loop_indices])for p in body.data.polygons]
bones={b.name:{'head':source_rig.matrix_world@b.head_local,'tail':source_rig.matrix_world@b.tail_local}for b in source_rig.data.bones}
eyes=bpy.data.objects['TigaEyes']
eye_indices={index for face in eyes.data.polygons if eyes.data.materials[face.material_index].name=='EYESEMI' for index in face.vertices}
eye_points=[eyes.matrix_world@eyes.data.vertices[index].co for index in eye_indices]
eye_centers=[sum(side,Vector())/len(side) for side in ([p for p in eye_points if p.x<0],[p for p in eye_points if p.x>=0])]
eye_center=(eye_centers[0]+eye_centers[1])*.5
image=next(i for i in bpy.data.images if i.name.startswith('Tiga_body_Multi'))
image.scale(2048,2048);image.filepath_raw=str(TEXTURES/'tiga-multi-color.jpg');image.file_format='JPEG';image.save()
# The original flat colors were inputs to an Eevee toon shader. Calibrate those
# color regions for the game's physical lights, keeping the author's UV layout.
# Silver panels receive their own metallic/roughness response instead of sharing
# the colored suit's plastic-looking material. The original source stays untouched.
pixels=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(pixels)
rgba=pixels.reshape((-1,4));rgb=rgba[:,:3].copy();r,g,b=rgb.T
violet=np.clip((b-r-.08)/.35,0,1)*np.clip((b-g-.08)/.35,0,1)
red=np.clip((r-np.maximum(g,b)-.08)/.6,0,1)
value=np.clip(rgb.max(axis=1)/.92,.3,1.1)[:,None]
for mask,color in [(violet,(112/255,94/255,160/255)),(red,(176/255,40/255,61/255))]:
    rgba[:,:3]+=mask[:,None]*(np.array(color)*value-rgb)
def save_texture(name,filename,data,space,format):
    result=bpy.data.images.new(name,width=2048,height=2048,alpha=False)
    result.colorspace_settings.name=space;result.pixels.foreach_set(data.reshape(-1))
    result.filepath_raw=str(TEXTURES/filename);result.file_format=format;result.save();result.pack()
    return result
color_image=save_texture('Tiga Multi-Type PBR Color','tiga-pbr-color.jpg',rgba,'sRGB','JPEG')
colored=np.maximum(violet,red);orm=np.ones_like(rgba)
orm[:,1]=.42+colored*.22;orm[:,2]=.55-colored*.42
surface_image=save_texture('Tiga Suit and Silver Surface','tiga-metal-rough.png',orm,'Non-Color','PNG')

# Replace view-dependent Eevee toon node groups with portable PBR materials.
def material(name,color,metal,rough,texture=False):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Metallic'].default_value=metal;bsdf.inputs['Roughness'].default_value=rough
    if texture:
        node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=color_image
        m.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
        surface=m.node_tree.nodes.new('ShaderNodeTexImage');surface.image=surface_image
        channels=m.node_tree.nodes.new('ShaderNodeSeparateColor')
        m.node_tree.links.new(surface.outputs['Color'],channels.inputs['Color'])
        m.node_tree.links.new(channels.outputs['Green'],bsdf.inputs['Roughness'])
        m.node_tree.links.new(channels.outputs['Blue'],bsdf.inputs['Metallic'])
    return m
silver=material('Tiga silver armor',(.58,.62,.65),.45,.4)
suit=material('Tiga Multi-Type suit',(1,1,1),.15,.55,True)
gold=material('Tiga gold trim',(.72,.51,.10),.55,.4)
lining=material('Tiga sleeve lining',(.025,.012,.025),.0,.85)

for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
metadata={}
for side,offset in [('L',-.6),('R',.6)]:
    wrist=bones['HandBase_'+side]['head']
    direction=(bones['Mid3_'+side]['tail']-wrist).normalized()
    across=(bones['Index1_'+side]['head']-bones['Pinky1_'+side]['head']).normalized()
    across*=1 if side=='L' else -1
    normal=direction.cross(across).normalized();across=normal.cross(direction).normalized()
    basis=Matrix((across,normal,direction))
    size=.72/(bones['Mid3_'+side]['tail']-wrist).length
    def point(world):return basis@(world-wrist)*size
    suffix='_'+side
    def mapped(name):
        if not name.endswith(suffix):return None
        stem=name[:-2]
        if stem in ['Shoulder','ShoulderTwist','ShoulderFixB','UpperArmCellulite']:return 'UpperArm'+suffix
        if stem in ['Forearm','ForearmTwist','elbow']:return 'LowerArm'+suffix
        if stem.startswith('Carpal'):return 'Hand'+suffix
        if stem in [f'{finger}{joint}'for finger in ['Index','Mid','Ring','Pinky','Thumb']for joint in [1,2,3]]:return name
        if stem=='Pinky1T':return 'Pinky1'+suffix
        if stem=='Pinky2T':return 'Pinky2'+suffix
        return None
    arm_weights=[]
    for original in weights:
        result={}
        for name,value in original.items():
            target=mapped(name)
            if target:result[target]=result.get(target,0)+value
        arm_weights.append(result)
    shoulder=bones['armBase_'+side]['head'];outward=(bones['ForearmBase_'+side]['head']-shoulder).normalized()
    selected={i for i,w in enumerate(arm_weights)if sum(w.values())>.5 and (positions[i]-shoulder).dot(outward)>-.03}
    faces=[p for p in polygons if all(i in selected for i in p[0])]
    used=sorted({i for vertices,_,_ in faces for i in vertices});remap={old:new for new,old in enumerate(used)}
    data=bpy.data.meshes.new('Tiga continuous arm '+side)
    data.from_pydata([tuple(point(positions[i]))for i in used],[],[[remap[i]for i in vertices]for vertices,_,_ in faces]);data.update()
    uv=data.uv_layers.new(name='UVMap')
    for face,(_,material_index,texcoords)in zip(data.polygons,faces):
        face.material_index=material_index;face.use_smooth=True
        for loop,coord in zip(face.loop_indices,texcoords):uv.data[loop].uv=coord
    arm_mesh=bpy.data.objects.new('TigaSkinnedArm'+side,data);bpy.context.collection.objects.link(arm_mesh)
    for m in [silver,suit,gold,lining]:data.materials.append(m)
    group_names=['UpperArm'+suffix,'LowerArm'+suffix,'Hand'+suffix]+[f'{finger}{joint}'+suffix for finger in ['Index','Mid','Ring','Pinky','Thumb']for joint in [1,2,3]]
    vertex_groups={n:arm_mesh.vertex_groups.new(name=n)for n in group_names}
    for new,old in enumerate(used):
        w=arm_weights[old];total=sum(w.values())
        for name,value in w.items():vertex_groups[name].add([new],value/total,'REPLACE')
    # Close the hidden shoulder cut and smooth the author's existing connected topology once.
    bm=bmesh.new();bm.from_mesh(data)
    cap=bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)
    for face in cap.get('faces',[]):face.material_index=3;face.smooth=False
    bm.to_mesh(data);bm.free();data.update()
    bpy.context.view_layer.objects.active=arm_mesh;arm_mesh.select_set(True)
    subdiv=arm_mesh.modifiers.new('First-person surface smoothing','SUBSURF');subdiv.levels=1
    bpy.ops.object.modifier_apply(modifier=subdiv.name)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL',limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL',lock_active=False)
    arm_mesh.select_set(False)
    root=bpy.data.objects.new('HeroArm'+side,None);bpy.context.collection.objects.link(root);root.location=(offset,0,0)
    root['source_author']='Extrazhang';root['source_url']='https://blendswap.com/blend/26877';root['license']='CC-BY-NC'
    root['viewmodel']='continuous mesh, 18 deform bones, five articulated fingers'
    offset_from_eyes=(shoulder-eye_center)*size
    # The source looks along Blender -Y. Store player-right, up, toward-player.
    eye_mount=[-offset_from_eyes.x,offset_from_eyes.z,offset_from_eyes.y]
    root['eye_to_shoulder']=eye_mount
    armature=bpy.data.armatures.new('Tiga first-person skeleton '+side)
    rig=bpy.data.objects.new('TigaRig'+side,armature);bpy.context.collection.objects.link(rig);rig.parent=root
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    definitions=[('UpperArm'+suffix,shoulder,bones['ForearmBase_'+side]['head'],None),
                 ('LowerArm'+suffix,bones['ForearmBase_'+side]['head'],wrist,'UpperArm'+suffix),
                 ('Hand'+suffix,wrist,bones['Mid1_'+side]['head'],'LowerArm'+suffix)]
    for finger in ['Index','Mid','Ring','Pinky','Thumb']:
        for joint in [1,2,3]:
            name=f'{finger}{joint}'+suffix
            definitions.append((name,bones[name]['head'],bones[name]['tail'],'Hand'+suffix if joint==1 else f'{finger}{joint-1}'+suffix))
    for name,head,tail,parent in definitions:
        bone=armature.edit_bones.new(name);bone.head=point(head);bone.tail=point(tail)
        bone.align_roll(Vector((0,1,0)));bone.use_deform=True
        if parent:bone.parent=armature.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
    root['bone_tips']={name:[point(tail).x,point(tail).z,-point(tail).y] for name,head,tail,parent in definitions}
    root['bone_tips_space']='GLTF_Y_UP'
    arm_mesh.parent=rig
    modifier=arm_mesh.modifiers.new('Tiga skeletal skinning','ARMATURE');modifier.object=rig;modifier.use_deform_preserve_volume=False
    metadata[side]={'vertices':len(arm_mesh.data.vertices),'polygons':len(arm_mesh.data.polygons),'bones':group_names,'normalization':size,'eye_to_shoulder':eye_mount}

# Store only the adapted meshes, FK rigs and their actual materials in the editable master.
for block in [*bpy.data.images,*bpy.data.materials,*bpy.data.node_groups]:
    if block!=color_image:block.use_fake_user=False
bpy.data.orphans_purge(do_recursive=True)
bpy.context.scene.camera=None
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/models/tiga-first-person.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/kaiju/hero-hands.glb'),export_format='GLB',export_animations=False,export_skins=True,export_def_bones=True,export_cameras=False,export_lights=False,export_extras=True)
(ROOT/'art/tiga-rig.json').write_text(json.dumps(metadata,indent=2),encoding='utf8')
print('TIGA_FIRST_PERSON_EXPORTED',json.dumps(metadata))
