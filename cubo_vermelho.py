"""Cria um cubo vermelho no Blender.

Uso:
  - No Blender: aba Scripting > abrir este arquivo > Run Script.
  - Pelo terminal: blender --background --python cubo_vermelho.py
    (salva cubo_vermelho.blend e cubo_vermelho.png ao lado deste script)
"""

import os

import bpy

# Limpa a cena padrao
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()

# Cubo
bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 1))
cubo = bpy.context.active_object
cubo.name = "CuboVermelho"

# Material vermelho
material = bpy.data.materials.new(name="Vermelho")
material.use_nodes = True
bsdf = material.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.6, 0.0, 0.0, 1.0)
bsdf.inputs["Roughness"].default_value = 0.4
material.diffuse_color = (0.6, 0.0, 0.0, 1.0)  # cor no modo Solid do viewport
cubo.data.materials.append(material)

# Chao
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))

# Luz
bpy.ops.object.light_add(type="SUN", location=(4, -4, 8))
bpy.context.active_object.data.energy = 2.5
bpy.context.active_object.rotation_euler = (0.6, 0.2, 0.8)

# Camera
bpy.ops.object.camera_add(location=(7, -7, 5.5), rotation=(1.1, 0, 0.785))
bpy.context.scene.camera = bpy.context.active_object

if bpy.app.background:
    pasta = os.path.dirname(os.path.abspath(__file__))
    cena = bpy.context.scene
    cena.render.engine = "CYCLES"
    cena.cycles.device = "CPU"
    cena.cycles.samples = 64
    cena.render.resolution_x = 800
    cena.render.resolution_y = 600
    cena.render.filepath = os.path.join(pasta, "cubo_vermelho.png")
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(pasta, "cubo_vermelho.blend"))
    bpy.ops.render.render(write_still=True)
