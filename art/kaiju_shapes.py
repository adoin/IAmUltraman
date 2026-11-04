"""Connected, tapered character geometry for the editable Blender kaiju masters."""
import math
import bpy
from mathutils import Vector

def mesh(name, vertices, faces, material, parent=None, smooth=False):
    data=bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces)
    data.update()
    obj=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.parent=parent
    for face in data.polygons:
        face.use_smooth=smooth
    return obj

def loft(name, rings, material, parent, sides=16):
    """Horizontal elliptical sections: (height, half-width, half-depth, depth offset)."""
    vertices=[]
    for z,rx,ry,cy in rings:
        for i in range(sides):
            a=2*math.pi*i/sides
            vertices.append((rx*math.cos(a),cy+ry*math.sin(a),z))
    faces=[tuple(reversed(range(sides)))]
    for ring in range(len(rings)-1):
        for i in range(sides):
            a=ring*sides+i;b=ring*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple((len(rings)-1)*sides+i for i in range(sides)))
    return mesh(name,vertices,faces,material,parent,True)

def tapered_chain(name, points, radii, material, parent, sides=10, smooth=True):
    vertices=[]
    for i,point in enumerate(points):
        p=Vector(point)
        tangent=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
        ref=Vector((0,0,1)) if abs(tangent.z)<.9 else Vector((0,1,0))
        u=tangent.cross(ref).normalized();v=tangent.cross(u).normalized()
        radius=radii[i]
        rx,ry=radius if isinstance(radius,tuple) else (radius,radius)
        for j in range(sides):
            a=j*2*math.pi/sides
            vertices.append(tuple(p+u*math.cos(a)*rx+v*math.sin(a)*ry))
    faces=[tuple(reversed(range(sides)))]
    for i in range(len(points)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple((len(points)-1)*sides+j for j in range(sides)))
    return mesh(name,vertices,faces,material,parent,smooth)

def plate(name, outline, depth, ridge, thickness, material, parent):
    """A closed ridged armor shell with a real silhouette, rather than an ellipsoid."""
    n=len(outline)
    vertices=[(x,depth,z) for x,z in outline]
    vertices += [(x,depth+thickness,z) for x,z in outline]
    center=(sum(p[0] for p in outline)/n,depth-ridge,sum(p[1] for p in outline)/n)
    vertices.append(center)
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces.append((i,j,2*n))
        faces.append((i,n+i,n+j,j))
    faces.append(tuple(reversed(range(n,2*n))))
    return mesh(name,vertices,faces,material,parent)

def fin(name, root, tip, length, thickness, material, parent):
    x,y,z=root;tx,ty,tz=tip
    vertices=[(x-thickness,y,z-length*.5),(x+thickness,y,z-length*.5),
              (x-thickness,y,z+length*.5),(x+thickness,y,z+length*.5),
              (tx,ty,tz)]
    return mesh(name,vertices,[(0,1,3,2),(0,4,1),(2,3,4),(0,2,4),(1,4,3)],material,parent)
