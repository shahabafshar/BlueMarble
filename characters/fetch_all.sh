#!/usr/bin/env bash
# Fetch every character GLB I've verified as directly downloadable.
# No AI tokens needed — just run this script once.
#
# Usage:  cd characters && bash fetch_all.sh
#
# After it finishes, open characters/preview.html and drag any .glb
# from the humans/ creatures/ fantasy/ folders onto it.
set -e
cd "$(dirname "$0")"

mkdir -p robots humans creatures fantasy

echo "=== humanoids ==="
curl -sL -o robots/RobotExpressive.glb  https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb
curl -sL -o humans/CesiumMan.glb        https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMan/glTF-Binary/CesiumMan.glb
curl -sL -o humans/HVGirl.glb           https://models.babylonjs.com/HVGirl.glb
curl -sL -o humans/BigVegas.glb         "https://raw.githubusercontent.com/BabylonJS/Assets/master/mixamo/Characters/Big%20Vegas_optimized.glb"
curl -sL -o humans/KenneyChar.glb       https://raw.githubusercontent.com/KenneyNL/Starter-Kit-3D-Platformer/main/models/character.glb
curl -sL -o humans/KenneySoldier.glb    "https://raw.githubusercontent.com/KenneyNL/Starter-Kit-Basic-Scene/main/sample/Mini%20Arena/Models/GLB%20format/character-soldier.glb"

echo "=== fantasy ==="
curl -sL -o fantasy/Goblin.glb          "https://raw.githubusercontent.com/BabylonJS/Assets/master/mixamo/Characters/goblin_d_shareyko_optimized.glb"
curl -sL -o fantasy/MawGooey.glb        "https://raw.githubusercontent.com/Quaternius/TestGltfAssets/master/Maw%20Gooey/MawGooey.glb"

echo "=== creatures ==="
curl -sL -o creatures/Fox.glb           https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb
curl -sL -o creatures/Flamingo.glb      https://threejs.org/examples/models/gltf/Flamingo.glb
curl -sL -o creatures/Parrot.glb        https://threejs.org/examples/models/gltf/Parrot.glb
curl -sL -o creatures/Stork.glb         https://threejs.org/examples/models/gltf/Stork.glb
curl -sL -o creatures/Horse.glb         https://threejs.org/examples/models/gltf/Horse.glb
curl -sL -o creatures/Deer.glb          https://raw.githubusercontent.com/Quaternius/TestGltfAssets/master/Deer/Deer.glb
curl -sL -o creatures/Slime.glb         https://raw.githubusercontent.com/Quaternius/TestGltfAssets/master/Slime/Slime.glb

echo ""
echo "=== done ==="
du -sh robots humans creatures fantasy
echo ""
echo "Drop any of these onto characters/preview.html (which works over file://)"
