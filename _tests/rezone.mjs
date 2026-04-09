import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, '..', 'index.html');
let c = readFileSync(htmlPath, 'utf8');

const marker1 = '        // ============================================================\n        // ZONE 1: Pyramid Complex (Desert)';
const marker2 = '\n\n        // ============================================================\n        // SPARSE GLOBAL FILL';

const start = c.indexOf(marker1);
const end = c.indexOf(marker2);
if (start < 0 || end < 0) { console.log('Markers not found', start, end); process.exit(1); }

const newZones = `        // ============================================================
        // ZONE LAYOUTS — properly spaced for WORLD_SCALE 2.5
        // 1 deg lat = 0.87 world units. Structures need 8-30 deg apart.
        // ============================================================

        // ZONE 1: Pyramid Complex (Desert)
        _currentZone = 1;
        placeLM("pyramid", ()=>mkPyramid(5), 15, -30, "Great Pyramid");
        placeLM("pyramid", ()=>mkPyramid(3), 15, -4, "Small Pyramid");
        place("pyramid", "structure", ()=>mkPyramid(1.8), 15, 14);
        placeLM("campfire", ()=>mkCampfire(), 8, -30, "Desert Camp");
        place("market", "furniture", mkMarket, 8, -22);
        scatter("cactus", "vegetation", ()=>lpCactus(1.5+Math.random()*1.5), 12, -18, 22, 12);
        scatter("rock", "vegetation", ()=>lpRock(.3+Math.random()*.5,0xa09880), 12, -18, 24, 15);
        scatter("deadtree", "vegetation", ()=>lpDeadTree(2+Math.random()), 10, -35, 12, 4);

        // ZONE 2: Mediterranean Village
        _currentZone = 2;
        placeLM("temple", ()=>mkTemple(4), 35, 60, "Ancient Temple");
        placeLM("house", ()=>mkHouse(2.5,0xf0f0f0), 35, 80, "Greek House");
        place("house", "structure", ()=>mkHouse(2,0xeee8dd), 35, 92);
        place("house", "structure", ()=>mkHouse(2.2,0xdde0f0), 25, 62);
        place("house", "structure", ()=>mkHouse(2,0xf0e8dd), 25, 74);
        place("house", "structure", ()=>mkHouse(1.8,0xe8e0d0), 25, 86);
        place("well", "furniture", mkWell, 30, 70);
        place("market", "furniture", mkMarket, 30, 78);
        place("bench", "furniture", mkBench, 31, 66); place("bench", "furniture", mkBench, 31, 74);
        place("lamppost", "furniture", mkLamppost, 32, 68); place("lamppost", "furniture", mkLamppost, 32, 76);
        scatter("tree", "vegetation", ()=>lpTree(2+Math.random()*1.5,0x6a9a4a), 30, 72, 18, 15);
        scatter("bush", "vegetation", ()=>lpBush(.4+Math.random()*.3), 30, 72, 18, 12);
        scatter("flower", "vegetation", lpFlower, 30, 72, 18, 20);
        placeNPC(0x6699dd,0, 30,66); placeNPC(0xdd6644,2, 31,75); placeNPC(0x66aa66,0, 28,70);
        placeAnimal("butterfly", mkButterfly, 30,72,'flutter'); placeAnimal("butterfly", mkButterfly, 32,78,'flutter');

        // ZONE 3: Castle Highlands
        _currentZone = 3;
        placeLM("castle", ()=>mkCastle(4), 50, -120, "Highland Castle");
        place("house", "structure", ()=>mkHouse(2.5,0xe08860), 50, -136);
        place("house", "structure", ()=>mkHouse(2.8,0x6090cc), 50, -106);
        place("house", "structure", ()=>mkHouse(2,0xe8d870), 40, -120);
        place("well", "furniture", mkWell, 43, -113);
        placeLM("campfire", ()=>mkCampfire(), 43, -128, "Castle Camp");
        place("lamppost", "furniture", mkLamppost, 45, -117);
        scatter("pine", "vegetation", ()=>lpPine(3+Math.random()*2), 46, -120, 20, 18);
        scatter("birch", "vegetation", ()=>lpBirch(2.5+Math.random()*1.5), 43, -116, 14, 6);
        scatter("bush", "vegetation", ()=>lpBush(.4+Math.random()*.3), 45, -120, 18, 12);
        scatter("flower", "vegetation", lpFlower, 45, -120, 18, 12);
        scatter("rock", "vegetation", ()=>lpRock(.3+Math.random()*.4), 47, -120, 16, 8);
        placeNPC(0x888888,3, 46,-117); placeNPC(0x888888,3, 46,-123);
        placeAnimal("sheep", ()=>mkSheep(), 41,-115,'wander'); placeAnimal("sheep", ()=>mkSheep(), 42,-125,'wander');
        placeAnimal("bird", ()=>mkBird(), 50,-120,'fly');

        // ZONE 4: Dutch Countryside
        _currentZone = 4;
        placeLM("windmill", ()=>mkWindmill(6), 48, 5, "Dutch Windmill");
        place("house", "structure", ()=>mkHouse(2.2,0xe0a070), 48, -8);
        place("house", "structure", ()=>mkHouse(2,0xdda880), 48, 18);
        place("house", "structure", ()=>mkHouse(2.5,0xc8e090), 38, 5);
        place("market", "furniture", mkMarket, 40, 14);
        scatter("flower", "vegetation", lpFlower, 44, 5, 20, 30);
        scatter("tree", "vegetation", ()=>lpTree(2+Math.random()*1.5), 43, 5, 18, 8);
        scatter("bush", "vegetation", ()=>lpBush(.3+Math.random()*.3), 43, 5, 16, 10);
        placeNPC(0xddaa44,2, 42,8); placeNPC(0x88aa66,2, 43,-2);
        placeAnimal("sheep", ()=>mkSheep(), 41,0,'wander'); placeAnimal("sheep", ()=>mkSheep(), 41,10,'wander');
        placeAnimal("butterfly", mkButterfly, 44,5,'flutter');

        // ZONE 5: Lighthouse Coast
        _currentZone = 5;
        placeLM("lighthouse", ()=>mkLighthouse(8), 25, 150, "Coastal Lighthouse");
        place("dock", "structure", ()=>mkDock(5), 16, 154);
        place("house", "structure", ()=>mkHouse(2,0xeee8dd), 25, 138);
        placeLM("campfire", ()=>mkCampfire(), 19, 144, "Beach Camp");
        scatter("palm", "vegetation", ()=>lpPalm(3+Math.random()*2), 22, 148, 12, 6);
        scatter("rock", "vegetation", ()=>lpRock(.4+Math.random()*.5), 20, 148, 12, 6);
        placeNPC(0xeee8dd,0, 22,141);
        placeAnimal("crab", ()=>mkCrab(), 17,153,'wander'); placeAnimal("bird", ()=>mkBird(0xeeeeee), 25,150,'fly');

        // ZONE 6: Golden Bridge
        _currentZone = 6;
        placeLM("bridge", ()=>mkBridge(10), 20, 120, "Golden Bridge");
        place("house", "structure", ()=>mkHouse(2.2,0xdda080), 20, 98);
        place("house", "structure", ()=>mkHouse(2,0xaaccdd), 20, 142);
        scatter("palm", "vegetation", ()=>lpPalm(4+Math.random()*2), 16, 120, 20, 6);
        scatter("bush", "vegetation", ()=>lpBush(.4+Math.random()*.3), 16, 120, 18, 5);

        // ZONE 7: Statue of Freedom
        _currentZone = 7;
        placeLM("statue", ()=>mkStatue(6), 30, -70, "Statue of Freedom");
        place("dock", "structure", ()=>mkDock(4), 20, -66);
        place("bench", "furniture", mkBench, 30, -80); place("bench", "furniture", mkBench, 30, -60);
        place("lamppost", "furniture", mkLamppost, 27, -76); place("lamppost", "furniture", mkLamppost, 27, -64);
        scatter("bush", "vegetation", ()=>lpBush(.35+Math.random()*.2), 27, -70, 14, 8);
        scatter("flower", "vegetation", lpFlower, 27, -70, 14, 12);
        scatter("tree", "vegetation", ()=>lpTree(2+Math.random()), 24, -70, 12, 4);

        // ZONE 8: Tropical Jungle
        _currentZone = 8;
        place("ruins", "structure", ()=>mkRuins(3), 10, 80);
        placeLM("campfire", ()=>mkCampfire(), 4, 92, "Jungle Camp");
        scatter("palm", "vegetation", ()=>lpPalm(4+Math.random()*3), 7, 86, 22, 28);
        scatter("tree", "vegetation", ()=>lpTree(3+Math.random()*2,0x2a7a35), 7, 86, 22, 18);
        scatter("bush", "vegetation", ()=>lpBush(.5+Math.random()*.4,0x3a8a3a), 7, 86, 24, 20);
        scatter("flower", "vegetation", lpFlower, 7, 86, 20, 12);
        scatter("mushroom", "vegetation", ()=>lpMushroom(.12+Math.random()*.08), 7, 86, 18, 10);
        scatter("rock", "vegetation", ()=>lpRock(.3+Math.random()*.4), 7, 86, 20, 6);
        placeNPC(0xaa7744,3, 4,93);
        placeAnimal("butterfly", mkButterfly,8,84,'flutter'); placeAnimal("butterfly", mkButterfly,10,90,'flutter');
        placeAnimal("bird", ()=>mkBird(0x33aa33),8,86,'fly');

        // ZONE 9: Snowy Peak
        _currentZone = 9;
        placeLM("campfire", ()=>mkCampfire(), 65, 30, "Mountain Camp");
        place("ruins", "structure", ()=>mkRuins(2), 65, 44);
        scatter("pine", "vegetation", ()=>lpPine(2.5+Math.random()*2,true), 62, 36, 20, 16);
        scatter("rock", "vegetation", ()=>lpRock(.4+Math.random()*.6,0x8a8a98), 62, 36, 18, 10);
        scatter("icespike", "vegetation", ()=>lpIceSpike(1+Math.random()), 66, 40, 14, 6);
        scatter("deadtree", "vegetation", ()=>lpDeadTree(2+Math.random()), 58, 32, 14, 5);
        placeNPC(0xdd6644,3, 64,32);
        placeAnimal("bird", ()=>mkBird(0xaabbcc),65,36,'fly');

        // ZONE 10: Grand Tower Plaza
        _currentZone = 10;
        placeLM("tower", ()=>mkTower(10), 42, 20, "Grand Tower");
        place("ruins", "structure", ()=>mkRuins(2), 42, 36);
        place("market", "furniture", mkMarket, 34, 20);
        place("bench", "furniture", mkBench, 36, 14); place("bench", "furniture", mkBench, 36, 26);
        place("lamppost", "furniture", mkLamppost, 37, 16); place("lamppost", "furniture", mkLamppost, 37, 24);
        scatter("tree", "vegetation", ()=>lpTree(2+Math.random()*1.5), 38, 22, 16, 8);
        scatter("bush", "vegetation", ()=>lpBush(.3+Math.random()*.3), 38, 22, 14, 6);
        scatter("flower", "vegetation", lpFlower, 38, 22, 14, 10);
        placeNPC(0x6699dd,0, 37,20); placeNPC(0xddaa44,1, 36,26);

        // ZONE 11: Beach Resort
        _currentZone = 11;
        place("house", "structure", ()=>mkHouse(2,0xff9966), 5, -100);
        place("house", "structure", ()=>mkHouse(1.8,0x66ccaa), 5, -112);
        place("dock", "structure", ()=>mkDock(4), -4, -96);
        placeLM("campfire", ()=>mkCampfire(), -1, -106, "Beach Resort");
        place("shipwreck", "structure", mkShipwreck, -6, -88);
        scatter("palm", "vegetation", ()=>lpPalm(3+Math.random()*2), 1, -102, 16, 6);
        scatter("driftwood", "vegetation", ()=>lpDriftwood(), -2, -100, 12, 4);
        scatter("rock", "vegetation", ()=>lpRock(.2+Math.random()*.3), 1, -98, 14, 5);
        placeAnimal("crab", ()=>mkCrab(),-2,-98,'wander'); placeAnimal("crab", ()=>mkCrab(),-3,-102,'wander');

        // ZONE 12: Deep Forest
        _currentZone = 12;
        scatter("pine", "vegetation", ()=>lpPine(3+Math.random()*3), 55, 60, 20, 20);
        scatter("birch", "vegetation", ()=>lpBirch(2.5+Math.random()*1.5), 55, 60, 18, 10);
        scatter("bush", "vegetation", ()=>lpBush(.4+Math.random()*.4), 55, 60, 20, 15);
        scatter("mushroom", "vegetation", ()=>lpMushroom(.1+Math.random()*.1), 55, 60, 16, 10);
        scatter("flower", "vegetation", lpFlower, 55, 60, 16, 8);
        scatter("rock", "vegetation", ()=>lpRock(.3+Math.random()*.3), 55, 60, 18, 6);
        place("well", "furniture", mkWell, 55, 72);
        place("ruins", "structure", ()=>mkRuins(2), 50, 52);
        placeAnimal("bird", ()=>mkBird(0x448866),55,60,'fly');
        placeAnimal("butterfly", mkButterfly,56,64,'flutter');

        // ZONE 13: Desert Oasis
        _currentZone = 13;
        scatter("palm", "vegetation", ()=>lpPalm(3+Math.random()*2), 12, -60, 12, 5);
        scatter("bush", "vegetation", ()=>lpBush(.4+Math.random()*.3,0x5cb85c), 12, -60, 12, 8);
        scatter("flower", "vegetation", lpFlower, 12, -60, 10, 10);
        placeLM("campfire", ()=>mkCampfire(), 12, -60, "Oasis Camp");
        place("market", "furniture", mkMarket, 12, -52);
        placeNPC(0xddaa44,3, 12,-55);

        // ZONE 14: Southern Tundra
        _currentZone = 14;
        scatter("pine", "vegetation", ()=>lpPine(2+Math.random()*2,true), -55, 0, 22, 12);
        scatter("icespike", "vegetation", ()=>lpIceSpike(1+Math.random()*1.5), -55, 0, 20, 8);
        scatter("rock", "vegetation", ()=>lpRock(.4+Math.random()*.6,0x8a8a98), -55, 0, 22, 10);
        scatter("deadtree", "vegetation", ()=>lpDeadTree(2+Math.random()), -55, 0, 18, 5);`;

c = c.substring(0, start) + newZones + c.substring(end);
writeFileSync(htmlPath, c);
console.log('Zones replaced. New file:', c.split('\n').length, 'lines');
