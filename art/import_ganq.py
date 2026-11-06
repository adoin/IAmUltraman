"""Adapt the credited static Gan Q GLB to metallic-roughness rendering.
The source uses legacy specular-glossiness materials and a tilted display root.
"""
import json,struct,sys
from pathlib import Path
source,output=map(Path,sys.argv[1:])
raw=source.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);tail=raw[20+length:]
for material in doc.get('materials',[]):
    legacy=material.get('extensions',{}).pop('KHR_materials_pbrSpecularGlossiness',None)
    if legacy:
        material['pbrMetallicRoughness']={'baseColorFactor':legacy.get('diffuseFactor',[1,1,1,1]),'baseColorTexture':legacy['diffuseTexture'],'metallicFactor':0,'roughnessFactor':.85}
    if not material.get('extensions'):material.pop('extensions',None)
for key in ['extensionsUsed','extensionsRequired']:
    if key in doc:doc[key]=[name for name in doc[key] if name!='KHR_materials_pbrSpecularGlossiness']
    if not doc.get(key):doc.pop(key,None)
doc['nodes'][0].pop('matrix',None)
doc['nodes'][0]['rotation']=[0.5,0.5,0.5,0.5]
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
data=struct.pack('<III',0x46546C67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4E4F534A)+encoded+tail
output.write_bytes(data)
print('WEB_SIZE',len(data))
