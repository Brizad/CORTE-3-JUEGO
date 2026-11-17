"""Entrega final (guía 5.12). Uso: npm run empaquetar (hace el build antes).

1. entrega/Grupo2_RoboCell.zip: el contenido de dist/ (index.html en la raíz, rutas con /, máximo 25 MB).
2. entrega/Grupo2_RoboCell_completo.zip: modelos/, .agents/skills/, docs/, src/, test/, scripts/, README.md, PROMPTS.md,
   package.json e index.html, más los archivos que hacen falta para volver a construir el juego (package-lock.json,
   vite.config.js y netlify.toml). Sin node_modules ni dist.
"""
import os
import zipfile

raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
carpeta_entrega = os.path.join(raiz, 'entrega')
os.makedirs(carpeta_entrega, exist_ok=True)
MAX_MB = 25
EXCLUIR = {'node_modules', 'dist', '__pycache__', '.git', 'tmp-capturas', 'entrega'}


def comprimir(salida, archivos):
    """archivos: lista de (ruta en disco, ruta dentro del ZIP)."""
    if os.path.exists(salida):
        os.remove(salida)
    with zipfile.ZipFile(salida, 'w', zipfile.ZIP_DEFLATED) as z:
        for ruta, nombre in archivos:
            z.write(ruta, nombre)
    mb = os.path.getsize(salida) / 1048576
    assert mb <= MAX_MB, f'{os.path.basename(salida)} pesa {mb:.2f} MB (máximo {MAX_MB} MB)'
    print(f'{os.path.relpath(salida, raiz)}: {len(archivos)} archivos, {mb:.3f} MB')
    return salida


def recorrer(carpeta):
    """Todos los archivos de una carpeta del proyecto (sin las carpetas excluidas), con su ruta relativa a la raíz."""
    base = os.path.join(raiz, carpeta)
    lista = []
    for actual, carpetas, archivos in os.walk(base):
        carpetas[:] = sorted(c for c in carpetas if c not in EXCLUIR)
        for a in sorted(archivos):
            ruta = os.path.join(actual, a)
            lista.append((ruta, os.path.relpath(ruta, raiz).replace(os.sep, '/')))
    return lista


# 1. Juego para el aula virtual: el contenido de dist/.
dist = os.path.join(raiz, 'dist')
assert os.path.isfile(os.path.join(dist, 'index.html')), 'Falta dist/index.html: ejecuta npm run build'
juego = []
for actual, _, archivos in os.walk(dist):
    for a in sorted(archivos):
        ruta = os.path.join(actual, a)
        juego.append((ruta, os.path.relpath(ruta, dist).replace(os.sep, '/')))
salida = comprimir(os.path.join(carpeta_entrega, 'Grupo2_RoboCell.zip'), juego)
with zipfile.ZipFile(salida) as z:
    assert 'index.html' in z.namelist(), 'index.html debe estar en la raíz del ZIP'

# 2. Proyecto completo.
completo = []
for carpeta in ['modelos', os.path.join('.agents', 'skills'), 'docs', 'src', 'test', 'scripts']:
    assert os.path.isdir(os.path.join(raiz, carpeta)), f'falta la carpeta {carpeta}'
    completo += recorrer(carpeta)
for archivo in ['README.md', 'PROMPTS.md', 'package.json', 'index.html', 'package-lock.json', 'vite.config.js', 'netlify.toml']:
    ruta = os.path.join(raiz, archivo)
    assert os.path.isfile(ruta), f'falta {archivo}'
    completo.append((ruta, archivo))
salida = comprimir(os.path.join(carpeta_entrega, 'Grupo2_RoboCell_completo.zip'), completo)
with zipfile.ZipFile(salida) as z:
    nombres = z.namelist()
    assert not any(n.startswith(('node_modules/', 'dist/')) for n in nombres), 'el ZIP completo no debe llevar node_modules ni dist'
    for necesario in ['docs/GDD.md', 'docs/arte.md', 'docs/modelo/automatas.md', 'docs/modelo/petri.md', 'docs/informe.md',
                      'docs/pruebas.md', '.agents/skills/ingeniero-sed/SKILL.md', 'modelos/petri/robocell.pnml', 'src/sed/celda.js']:
        assert necesario in nombres, f'falta {necesario} en el ZIP completo'
