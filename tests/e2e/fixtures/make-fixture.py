"""生成测试用 GLB：2000 x 1000 x 500 的长方体（单位按毫米、Z 轴向上建模），用于验证导入的单位与坐标轴换算。
运行：python3 tests/e2e/fixtures/make-fixture.py"""
import json, struct, pathlib
X, Y, Z = 2000.0, 1000.0, 500.0  # Z-up：高度在 Z
v = [(x, y, z) for x in (0, X) for y in (0, Y) for z in (0, Z)]
faces = [(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
idx = [i for a,b,c,d in faces for i in (a,b,c,a,c,d)]
pos = b''.join(struct.pack('<3f', *p) for p in v)
ind = b''.join(struct.pack('<H', i) for i in idx)
ind += b'\0' * (-len(ind) % 4)
bin_ = pos + ind
gltf = {"asset": {"version": "2.0", "generator": "factoryforge-fixture"}, "scene": 0, "scenes": [{"nodes": [0]}],
  "nodes": [{"mesh": 0, "name": "TestBlock"}], "materials": [{"pbrMetallicRoughness": {"baseColorFactor": [0.2, 0.6, 0.9, 1], "metallicFactor": 0.1, "roughnessFactor": 0.6}}],
  "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "material": 0}]}],
  "buffers": [{"byteLength": len(bin_)}],
  "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(pos), "target": 34962}, {"buffer": 0, "byteOffset": len(pos), "byteLength": len(idx) * 2, "target": 34963}],
  "accessors": [{"bufferView": 0, "componentType": 5126, "count": 8, "type": "VEC3", "min": [0, 0, 0], "max": [X, Y, Z]},
                {"bufferView": 1, "componentType": 5123, "count": len(idx), "type": "SCALAR"}]}
js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bin_), 0x004E4942) + bin_
p = pathlib.Path(__file__).with_name('test-block.glb')
p.write_bytes(out)
print(p, len(out), 'bytes')
