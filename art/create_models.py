"""Rebuild the original game models using Blender's background Python runner.

blender --background --python art/create_models.py
The .blend masters live in art/models; the web-ready GLBs in public/models/kaiju.
Mesh parts are parented to named pivots, which the game animates at runtime.
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'models' / 'kaiju'
MASTERS = ROOT / 'art' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
MASTERS.mkdir(parents=True, exist_ok=True)
sys.path.insert(0,str(Path(__file__).resolve().parent))
from kaiju_shapes import mesh as poly_mesh, loft, tapered_chain, plate, fin

def material(name, color, metallic=0.0, roughness=0.65, emission=0):
    if isinstance(color,str):
        rgb=[int(color.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
        color=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)
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
    bpy.context.scene.render.image_settings.file_format='PNG'
    bpy.context.scene.view_settings.view_transform='AgX'
    bpy.context.preferences.filepaths.save_version=0
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
      'basalt':dict(skin='#29353b',armor='#4a5960',edge='#70818a',belly='#394950',bone='#a9a393',core='#39b49a',eye='#e8aa48'),
      'leviathan':dict(skin='#193b52',armor='#285e79',edge='#508ca1',belly='#324e60',bone='#b5bab1',core='#47b7cf',eye='#f0be6a'),
      'nova':dict(skin='#30252c',armor='#71313e',edge='#a2514e',belly='#473239',bone='#b78a6c',core='#e57e38',eye='#ffc66b'),
    }
    colors=palettes[kind]
    skin=material('Skin',colors['skin'],.025,.88)
    armor=material('Armor',colors['armor'],.12,.75)
    edge=material('Armor edges',colors['edge'],.14,.67)
    belly=material('Ventral scales',colors['belly'],.03,.88)
    bone=material('Horn and claws',colors['bone'],.015,.83)
    dark=material('Mouth and joints','#10171e',.0,.96)
    core=material('Energy core',colors['core'],.05,.55,.85)
    eye=material('Amber eye slits',colors['eye'],.0,.65,1.1)
    root=pivot('KaijuRoot')
    body=pivot('Body',(0,0,4.9),root)
    wide=1.07 if kind=='basalt' else .93 if kind=='leviathan' else 1
    loft('Tapered torso',[(z,x*wide,y,cy) for z,x,y,cy in [
      (-1.05,1.0,.72,.12),(-.35,1.03,.78,.08),(.55,1.24,.87,.05),
      (1.55,1.75,1.06,.12),(2.5,1.97,1.0,.18),(3.0,1.78,.83,.23),(3.35,1.15,.64,.15)]],skin,body,20)
    # Interlocking sternum / abdomen: narrow waist, broad armored shoulder line.
    for i,(z,width) in enumerate([(-.68,.73),(-.02,.85),(.65,1.02),(1.34,1.18),(2.06,1.33)]):
        outline=[(-width*.82,z+.38),(-width,z+.05),(-width*.67,z-.28),
                 (0,z-.4),(width*.67,z-.28),(width,z+.05),(width*.82,z+.38),(0,z+.23)]
        depth=-.75 if i<2 else -1.02 if i<4 else -1.12
        plate('Ventral armor %02d'%i,outline,depth,.16,.12,belly,body)
    for side in [-1,1]:
        plate('Pectoral shield',[(side*.20,2.15),(side*.78,2.83),(side*1.65,2.71),
              (side*1.89,2.09),(side*1.16,1.68),(side*.44,1.83)],-1.0,.26,.18,armor,body)
        for i in range(3):
            z=.1+i*.7
            plate('Flank scale',[(side*.96,z+.45),(side*1.42,z+.36),(side*1.62,z),
                  (side*1.01,z-.16)],-.58,.18,.15,armor,body)
    plate('Core socket',[(-.39,2.52),(0,2.77),(.39,2.52),(.25,2.04),(0,1.92),(-.25,2.04)],-1.16,.11,.12,dark,body)
    plate('ChestCore',[(-.22,2.47),(0,2.64),(.22,2.47),(.14,2.18),(0,2.08),(-.14,2.18)],-1.30,.04,.03,core,body)
    # Long, digitigrade-looking limbs keep the silhouette athletic instead of toy-like.
    for side,tag in [(-1,'L'),(1,'R')]:
        leg=pivot('Leg'+tag,(side*.85,.18,3.6),root)
        tapered_chain('Thigh'+tag,[(0,0,.2),(side*.14,-.18,-.65),(side*.23,-.12,-1.43)],
                      [(.63,.72),(.64,.66),(.44,.46)],skin,leg,12)
        rock('Knee guard'+tag,(side*.21,-.47,-1.39),(.53,.43,.49),armor,leg,2)
        tapered_chain('Shin'+tag,[(side*.23,-.08,-1.45),(side*.16,.15,-2.3),(side*.05,-.1,-3.11)],
                      [(.41,.46),(.39,.41),(.27,.30)],skin,leg,12)
        plate('Shin ridge'+tag,[(side*.21-.31,-1.62),(side*.21+.31,-1.62),
              (side*.12+.22,-2.76),(side*.12,-3.02),(side*.12-.22,-2.76)],-.48,.2,.12,armor,leg)
        poly_mesh('Angular foot'+tag,[(-.49,-.1,-3.02),(.49,-.1,-3.02),(-.58,-1.0,-3.32),(.58,-1,-3.32),
                  (-.56,-1.18,-3.58),(.56,-1.18,-3.58),(-.4,.3,-3.58),(.4,.3,-3.58)],
                  [(0,1,3,2),(2,3,5,4),(0,2,4,6),(1,7,5,3),(0,6,7,1),(4,5,7,6)],skin,leg)
        for j in range(3):
            x=(j-1)*.4
            tapered_chain('Toe claw',[(x,-.85,-3.4),(x,-1.25,-3.45),(x,-1.68,-3.54)],
                          [.16,.12,.018],bone,leg,7,False)
        arm=pivot('Arm'+tag,(side*1.82,.10,2.63),body)
        sphere('Shoulder joint'+tag,(side*.05,0,-.12),(.61,.59,.67),skin,arm)
        plate('Shoulder carapace'+tag,[(side*-.30,.52),(side*.23,.78),(side*.86,.31),
              (side*.91,-.36),(side*.39,-.68),(side*-.25,-.38)],-.46,.32,.34,armor,arm)
        tapered_chain('Upper arm'+tag,[(side*.12,0,-.28),(side*.46,-.12,-1.02),(side*.57,-.09,-1.70)],
                      [(.54,.57),(.49,.5),(.35,.39)],skin,arm,12)
        fore=pivot('Forearm'+tag,(side*.58,-.14,-1.74),arm)
        thick=1.14 if kind=='basalt' else .92
        tapered_chain('Forearm mesh'+tag,[(0,0,.05),(side*.16,-.18,-.65),(side*.12,-.43,-1.35)],
                      [(.38,.41),(.48*thick,.49),(.31,.34)],skin,fore,12)
        plate('Forearm blade'+tag,[(-.36,.03),(.38,.05),(.57,-.71),(.32,-1.26),(-.31,-1.23),(-.5,-.55)],
              -.51,.20,.2,armor,fore)
        sphere('Palm'+tag,(side*.10,-.43,-1.57),(.41,.35,.46),skin,fore,12,8)
        for j in range(3):
            x=(j-1)*.29+side*.1
            tapered_chain('Finger claw',[(x,-.46,-1.72),(x,-.68,-2.03),(x,-.96,-2.12)],
                          [.14,.10,.015],bone,fore,7,False)
        tapered_chain('Shoulder horn',[(side*.32,.18,.5),(side*.75,.33,1.05),(side*1.10,.70,1.4)],
                      [.29,.18,.012],bone,arm,8,False)
        fin('Elbow spur',(side*.32,.13,-.12),(side*.83,.52,.46),.65,.16,armor,fore)
    neck=pivot('Head',(0,-.03,3.46),body)
    tapered_chain('Neck',[(0,.08,-.26),(0,.08,.53)],[.74,.70],skin,neck,12)
    # Angular reptilian skull, projecting muzzle, inset eyes and a separate hinged jaw.
    skull=[(-.84,-.62,.10),(.84,-.62,.10),(-1.00,-.54,.87),(1.00,-.54,.87),
           (-.65,.63,.20),(.65,.63,.20),(-.73,.49,1.21),(.73,.49,1.21),
           (-.42,-1.67,.26),(.42,-1.67,.26),(-.67,-1.49,.65),(.67,-1.49,.65)]
    poly_mesh('Reptilian skull',skull,[(0,8,10,2),(1,3,11,9),(2,10,11,3),
              (8,9,11,10),(2,3,7,6),(0,2,6,4),(1,5,7,3),(4,6,7,5),(0,4,5,1),(0,1,9,8)],skin,neck)
    for side in [-1,1]:
        plate('Brow plate',[(side*.20,.86),(side*.62,1.22),(side*1.10,1.08),
              (side*1.11,.73),(side*.58,.67)],-.67,.22,.22,armor,neck)
        eye_slit=box('Eye slit',(side*.75,-.91,.71),(.48,.10,.12),eye,neck,.025)
        eye_slit.rotation_euler[1]=side*math.radians(14)
        plate('Cheek plate',[(side*.76,.50),(side*1.04,.68),(side*1.02,.14),
              (side*.65,-.08)],-.56,.14,.15,armor,neck)
        cone('Nostril',(side*.29,-1.67,.48),(side*.29,-1.75,.48),.074,dark,neck,radius2=.065,vertices=8)
        tapered_chain('Swept crown horn',[(side*.72,.34,1.02),(side*1.01,.65,1.73),
                      (side*1.23,1.22,2.17 if kind!='nova' else 2.55)], [.27,.17,.012],bone,neck,9,False)
    jaw=pivot('Jaw',(0,-.12,.08),neck)
    box('Mouth gap',(0,-1.08,.08),(1.34,.90,.13),dark,neck,.05)
    poly_mesh('Lower jaw',[(-.72,-.16,-.09),(.72,-.16,-.09),(-.51,-1.56,-.03),(.51,-1.56,-.03),
              (-.6,-.12,-.39),(.6,-.12,-.39),(-.33,-1.49,-.29),(.33,-1.49,-.29)],
              [(0,1,3,2),(0,2,6,4),(1,5,7,3),(2,3,7,6),(4,6,7,5),(0,4,5,1)],belly,jaw)
    for i in range(7):
        x=-.48+i*.16
        cone('Upper fang',(x,-1.45,.20),(x,-1.48,.015),.065,bone,neck,vertices=6)
        if i%2==0:
            cone('Lower fang',(x,-1.38,-.08),(x,-1.41,.08),.057,bone,jaw,vertices=6)
    for i in range(7):
        z=-.6+i*.56
        fin('Spinal armor',(0,.76 if i<3 else 1.0,z),(0,1.65+(i%3)*.19,z+.27),.65,.14,edge if i%2 else armor,body)
    tail=pivot('Tail',(0,.61,3.6),root)
    points=[(0,0,0),(0,1.0,-.14),(.23,2.15,-.48),(.58,3.35,-.79),(.93,4.6,-.93),(1.19,5.85,-.70),(1.18,7.0,-.28)]
    tapered_chain('Continuous tapered tail',points,[.62,.56,.45,.34,.23,.12,.012],skin,tail,12)
    for i in range(1,6):
        x,y,z=points[i]
        fin('Tail plate',(x,y,z+.25),(x,y+.12,z+.90-i*.08),.64,.12,armor,tail)
    if kind=='basalt':
        for side in [-1,1]:
            for i in range(3):
                fin('Basalt shoulder shards',(side*(1.34+i*.22),.25,2.8-i*.27),
                    (side*(1.9+i*.32),.53,3.55-i*.4),.65,.23,armor,body)
    elif kind=='leviathan':
        for side in [-1,1]:
            for i in range(3):
                fin('Swept gill fin',(side*.8,.28,.55-i*.24),
                    (side*(1.54-i*.1),1.35,.90-i*.43),.51,.08,edge,neck)
        fin('Sagittal crest',(0,.1,1.12),(0,.45,2.23),1.55,.12,armor,neck)
        for side in [-1,1]:
            fin('Hip fin',(side*.96,.18,-.3),(side*1.65,1.0,.5),1.25,.10,edge,body)
    else:
        membrane=material('Wing membrane','#4b2934',.02,.93)
        for side,tag in [(-1,'L'),(1,'R')]:
            wing=pivot('Wing'+tag,(side*1.48,.88,2.12),body)
            verts=[(0,0,0),(side*1.5,.35,1.95),(side*3.6,.63,3.55),(side*5.25,1.02,1.95),
                   (side*4.0,.88,1.19),(side*4.78,.98,-.20),(side*3.01,.66,.34),
                   (side*2.92,.71,-1.55),(side*1.39,.37,-.72),(side*.6,.13,-1.58)]
            poly_mesh('Scalloped wing membrane',verts,[(0,1,2),(0,2,4),(2,3,4),(0,4,6),(4,5,6),
                      (0,6,8),(6,7,8),(0,8,9)],membrane,wing)
            for j in [2,3,5,7,9]:
                tapered_chain('Wing finger',[verts[0],verts[j]],[.12,.035],armor,wing,7)
            cone('Wing tip',verts[2],(side*3.95,.67,4.1),.13,bone,wing,vertices=7)
        for i in range(3):
            x=(i-1)*.38
            fin('Crown crest',(x,.0,1.12),(x,.1,2.0-abs(i-1)*.24),.75,.10,edge,neck)
    root['asset_author']='Original model for Ultra Little Heroes'
    root['palette_srgb']=colors
    root['design']='Tapered torso, articulated limbs, layered armor and reptilian skull'
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
