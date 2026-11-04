"""Rebuild the original game models using Blender's background Python runner.

blender --background --python art/create_models.py
The .blend masters live in art/models; the web-ready GLBs in public/models/kaiju.
Mesh parts are parented to named pivots, which the game animates at runtime.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'models' / 'kaiju'
MASTERS = ROOT / 'art' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
MASTERS.mkdir(parents=True, exist_ok=True)

def material(name, color, metallic=0.0, roughness=0.65, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    if emission:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = emission
    return m

def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)

def parent_local(obj, parent):
    obj.parent = parent
    return obj

def pivot(name, loc=(0,0,0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    if parent:
        parent_local(obj, parent)
    return obj

def sphere(name, loc, scale, mat, parent=None, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    if parent:
        parent_local(o, parent)
    return o

def rock(name, loc, scale, mat, parent=None, subdivision=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivision, radius=1, location=loc)
    o=bpy.context.object
    o.name=name
    o.scale=scale
    o.data.materials.append(mat)
    if parent:
        parent_local(o,parent)
    return o

def box(name, loc, scale, mat, parent=None, bevel=.1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object
    o.name=name
    o.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Soft armor edges','BEVEL')
        mod.width=bevel
        mod.segments=2
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if parent:
        parent_local(o,parent)
    return o

def cone(name, start, end, radius, mat, parent=None, radius2=0.025, vertices=9):
    start,end=Vector(start),Vector(end)
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius2, depth=(end-start).length, location=(start+end)/2)
    o=bpy.context.object
    o.name=name
    o.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler()
    o.data.materials.append(mat)
    if parent:
        parent_local(o,parent)
    return o

def finish(name):
    # Give the editable master a useful material-preview camera, excluded from glTF.
    bpy.ops.object.camera_add(location=(15,-23,12))
    camera=bpy.context.object
    camera.rotation_euler=(Vector((0,0,5))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.lens=52
    bpy.context.scene.camera=camera
    bpy.ops.object.light_add(type='AREA',location=(5,-10,15))
    bpy.context.object.data.energy=2000
    bpy.context.object.data.shape='DISK'
    bpy.context.object.data.size=10
    bpy.context.scene.world.color=(.14,.17,.22)
    bpy.context.scene.render.resolution_x=1000
    bpy.context.scene.render.resolution_y=1000
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTERS/f'{name}.blend'))
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{name}.glb'),export_format='GLB',export_cameras=False,export_lights=False,export_animations=False,export_extras=True)
    print(f'EXPORTED {name}')

def monster(kind):
    reset()
    palettes={
      'basalt': ((.18,.25,.27),(.28,.37,.39),(.065,.12,.14),(.23,.95,.74)),
      'leviathan': ((.035,.24,.34),(.08,.4,.49),(.035,.12,.22),(.35,.86,1)),
      'nova': ((.23,.08,.16),(.4,.13,.22),(.1,.045,.1),(1,.38,.12)),
    }
    skin_c,armor_c,dark_c,glow_c=palettes[kind]
    skin=material('Skin',skin_c,.12,.61)
    armor=material('Armor',armor_c,.3,.5)
    dark=material('Dark joints',dark_c,.1,.75)
    ivory=material('Horn ivory',(.82,.74,.55),.1,.5)
    glow=material('Energy core',glow_c,.15,.3,3)
    eye=material('Eyes',(1,.82,.35),.1,.3,2)
    root=pivot('KaijuRoot')
    body=pivot('Body',(0,0,4.9),root)
    bulk=1.18 if kind=='basalt' else 1
    sphere('Torso',(0,.2,0),(2.3*bulk,1.55,2.7),skin,body,24,16)
    sphere('Belly',(0,-1.12,-.35),(1.65, .53,2.12),dark,body,20,12)
    for i in range(5):
        plate=rock('Belly plate',(0,-1.58,-1.9+i*.72),(1.45*(1-abs(i-2)*.1),.25,.44),armor,body,2)
    sphere('ChestCore',(0,-1.78,1.05),(.47,.2,.53),glow,body)
    for side in [-1,1]:
        for i in range(3):
            cone('Chest seam',(side*.5,-1.58,.8-i*.55),(side*1.8,-1.03,.2-i*.6),.065,glow,body,radius2=.04,vertices=6)
    for side,tag in [(-1,'L'),(1,'R')]:
        leg=pivot('Leg'+tag,(side*1.25,.15,2.9),root)
        sphere('Thigh'+tag,(0,0,-.25),(1.1,1.1,1.55),skin,leg)
        sphere('Calf'+tag,(0,-.3,-1.8),(.8,.85,1.25),armor,leg)
        sphere('Foot'+tag,(0,-.85,-2.45),(1.05,1.45,.55),skin,leg)
        for j in range(3):
            cone('Toe claw',(j*.6-.6,-1.8,-2.5),(j*.63-.63,-2.5,-2.65),.22,ivory,leg)
        arm=pivot('Arm'+tag,(side*2.05,-.0,1.55),body)
        sphere('Shoulder'+tag,(side*.2,0,0),(1.1,1.05,1.1),armor,arm)
        rock('Shoulder guard'+tag,(side*.35,-.05,.35),(1.15,1.15,.8),armor,arm,2)
        cone('Shoulder horn',(side*.35,0,.7),(side*1.05,.3,1.8),.38,ivory,arm)
        sphere('Upper arm'+tag,(side*.6,-.1,-1.0),(.72,.8,1.35),skin,arm)
        fore=pivot('Forearm'+tag,(side*.95,-.5,-1.8),arm)
        sphere('Forearm mesh'+tag,(0,-.1,-.45),(.68,.72,1.0),armor,fore)
        sphere('Hand'+tag,(0,-.32,-1.15),(.75,.7,.57),skin,fore)
        for j in range(3):
            cone('Hand claw',(j*.45-.45,-.6,-1.3),(j*.48-.48,-1.15,-1.75),.17,ivory,fore)
        for i in range(2):
            cone('Elbow spike',(side*.45,.25,-.35+i*.65),(side*1.0,.7,-.5+i*.65),.24,armor,fore)
    neck=pivot('Head',(0,-.15,2.35),body)
    sphere('Neck',(0,.15,0),(1.25,1.15,1.2),skin,neck)
    sphere('Skull',(0,-.22,1.0),(1.65,1.35,1.36),skin,neck,24,16)
    sphere('Snout',(0,-1.23,.65),(1.3,1.0,.7),skin,neck)
    box('Mouth opening',(0,-1.77,.17),(2,.48,.3),dark,neck,.13)
    jaw=pivot('Jaw',(0,-.3,-.05),neck)
    sphere('Lower jaw',(0,-1.1,0),(1.25,1.0,.36),armor,jaw)
    for side in [-1,1]:
        e=box('Eye',(side*1.2,-1.17,1.25),(.65,.2,.31),eye,neck,.08)
        e.rotation_euler[1]=side*math.radians(14)
        brow=rock('Brow ridge',(side*1.19,-1.07,1.62),(.8,.43,.32),armor,neck,2)
        cone('Horn',(side*1.13,.1,1.9),(side*1.9,.8,3.45 if kind=='nova' else 3.05),.46,ivory,neck,vertices=12)
        sphere('Nostril',(side*.45,-2.08,.95),(.12,.1,.1),dark,neck)
    for i in range(7):
        x=-.85+i*.28
        cone('Upper tooth',(x,-1.97,.35),(x,-2.02,.08),.10,ivory,neck,vertices=6)
        if i%2==0:
            cone('Lower tooth',(x,-1.97,.01),(x,-2.02,.21),.09,ivory,jaw,vertices=6)
    for i in range(7):
        z=-2.1+i*.75
        cone('Dorsal plate',(0,1.25,z),(0,2.35,z+.75),.65,glow if i%3==0 else armor,body,vertices=4)
    tail=pivot('Tail',(0,1.0,2.4),root)
    for i in range(7):
        size=1.0-i*.12
        sphere('Tail segment',(math.sin(i*.35)*.7, .8+i*.8,-.2-i*.21),(size,size*1.05,size*.75),skin,tail)
        cone('Tail spike',(0,1+i*.8,.2-i*.17),(0,1.2+i*.8,.9-i*.12),.32-i*.03,armor,tail,vertices=5)
    if kind=='leviathan':
        for side in [-1,1]:
            for i in range(3):
                cone('Gill fin',(side*1.3,.2,1.4-i*.4),(side*2.4,.9,1.8-i*.65),.42,glow if i==1 else armor,neck,vertices=4)
        cone('Crest',(0,.15,2),(0,0,3.65),.65,glow,neck,vertices=4)
    if kind=='nova':
        for side in [-1,1]:
            wing=pivot('Wing'+('L' if side<0 else 'R'),(side*1.5,1.1,1.2),body)
            # Deliberately broad silhouette for the final boss.
            verts=[(0,0,0),(side*4.1,.8,2.5),(side*4.6,1.1,-1.5),(side*2.8,.7,-.6),(side*1.3,.4,-2)]
            mesh=bpy.data.meshes.new('Wing membrane')
            mesh.from_pydata(verts,[],[(0,1,3),(1,2,3),(0,3,4)])
            obj=bpy.data.objects.new('Wing membrane',mesh)
            bpy.context.collection.objects.link(obj)
            obj.data.materials.append(armor)
            parent_local(obj,wing)
            for j in [1,2,4]:
                cone('Wing spar',verts[0],verts[j],.18,glow,wing,radius2=.055)
        for i in range(3):
            cone('Crown',((i-1)*.6,-.2,2.1),((i-1)*.7,-.25,3.3-abs(i-1)*.35),.25,glow,neck,vertices=5)
    root['asset_author']='Original model for Ultra Little Heroes'
    root['animation_pivots']='Body, Head, Jaw, ArmL, ArmR, ForearmL, ForearmR, Tail, WingL, WingR'
    finish(kind)

def hands():
    reset()
    silver=material('Silver gauntlet',(.6,.7,.79),.72,.28)
    red=material('Crimson suit',(.56,.025,.08),.3,.42)
    dark=material('Joint',(.07,.12,.18),.2,.6)
    cyan=material('Wrist light',(.1,.88,1),.3,.2,3)
    root=pivot('HeroHands')
    for side,tag in [(-1,'L'),(1,'R')]:
        hand=pivot('HeroArm'+tag,(side*.6,0,0),root)
        sphere('Sleeve',(0,.2,-.7),(.22,.27,.65),red,hand,16,10)
        sphere('Gauntlet',(0,0,-.05),(.24,.23,.48),silver,hand)
        box('Wrist armor',(0,-.20,-.0),(.33,.12,.37),silver,hand,.06)
        box('Wrist accent',(0,-.28,-.03),(.17,.035,.1),cyan,hand,.015)
        sphere('Palm',(0,-.02,.48),(.26,.14,.33),silver,hand)
        for i in range(4):
            finger=pivot('Finger'+tag+str(i),((i-1.5)*.135,-.025,.64),hand)
            sphere('Finger knuckle',(0,0,.11),(.065,.085,.15),dark,finger)
            sphere('Finger armor',(0,-.02,.23),(.065,.09,.18),silver,finger)
        thumb=pivot('Thumb'+tag,(side*.25,-.03,.39),hand)
        sphere('Thumb mesh',(side*.07,0,.1),(.12,.1,.23),silver,thumb)
    finish('hero-hands')

for kind in ['basalt','leviathan','nova']:
    monster(kind)
hands()
