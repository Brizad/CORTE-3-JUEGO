"""Empaqueta el contenido de dist/ en entrega/GrupoN_RoboCell.zip (index.html en la raíz, rutas con /)."""
import os, sys, zipfile
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dist = os.path.join(raiz, 'dist')
salida = os.path.join(raiz, 'entrega', 'GrupoN_RoboCell.zip')
os.makedirs(os.path.dirname(salida), exist_ok=True)
if os.path.exists(salida):
    os.remove(salida)
with zipfile.ZipFile(salida, 'w', zipfile.ZIP_DEFLATED) as z:
    for carpeta, _, archivos in os.walk(dist):
        for a in sorted(archivos):
            ruta = os.path.join(carpeta, a)
            z.write(ruta, os.path.relpath(ruta, dist).replace(os.sep, '/'))
with zipfile.ZipFile(salida) as z:
    nombres = z.namelist()
    assert 'index.html' in nombres, 'index.html debe estar en la raíz del ZIP'
    print('contenido:', nombres)
print('tamaño: %.3f MB' % (os.path.getsize(salida) / 1048576))
