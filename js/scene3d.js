/**
 * MISHLAND 3D ENGINE (Three.js Studio PBR + Procedural Assets + Spring/Bounce Physics + Zero-Occlusion Camera)
 * Рендерит интерактивный 3D-остров Мишлэнд, 9 уникальных локаций (включая Научный городок,
 * Стадион Зенит с физичным футбольным мячом, Бар с пенными кружками, Баню с паром и Маник&Педик),
 * Великий Торт с 9 свечами, 3D-фигурку Медвежонка Миши и 10 разных 3D-персонажей друзей.
 */
(function () {
  let scene, camera, renderer, clock;
  let raycaster, mouse;
  let containerEl, tooltipEl;

  // Camera Rig State
  const camRig = {
    mode: 'overview', // 'overview' | 'location' | 'follow' | 'orbit'
    target: new THREE.Vector3(0, 1.5, 0),
    currentTarget: new THREE.Vector3(0, 1.5, 0),
    spherical: {
      radius: 40,
      theta: 0.35,
      phi: 0.92
    },
    desiredSpherical: {
      radius: 40,
      theta: 0.35,
      phi: 0.92
    },
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    pointerDownPos: { x: 0, y: 0 }
  };

  const locationObjects = {};
  const characterMeshes = {};
  const interactiveMeshes = [];
  const animatedProps = [];
  const confettiParticles = [];
  const foamBubbles = [];
  const steamPuffs = [];
  const walkDustParticles = [];

  // Tactile 3D Soccer Ball Physics at Zenit Stadium & Water Surface
  let soccerBall = null;
  let waterMesh = null;

  let partyCurrentPos = new THREE.Vector3(0, 0.9, 5.2);
  let partyTargetPos = new THREE.Vector3(0, 0.9, 5.2);
  let partyWaypoints = [];
  let partyTrailHistory = [];
  let routeMarkersGroup = null;
  let lastTargetLocId = '__init__';
  let partyLookAngle = 0;
  let hoveredLocId = null;
  let onLocationClickCallback = null;

  function createStudioEnvironment(rendererInstance) {
    const pmremGenerator = new THREE.PMREMGenerator(rendererInstance);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x06152d);

    const skyGeo = new THREE.SphereGeometry(50, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x072a4a,
      side: THREE.BackSide
    });
    envScene.add(new THREE.Mesh(skyGeo, skyMat));

    const box1 = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
    );
    box1.position.set(25, 26, 20);
    box1.lookAt(0, 0, 0);
    envScene.add(box1);

    const box2 = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26),
      new THREE.MeshBasicMaterial({ color: 0x0284c7, side: THREE.DoubleSide })
    );
    box2.position.set(-25, 18, -20);
    box2.lookAt(0, 0, 0);
    envScene.add(box2);

    const box3 = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshBasicMaterial({ color: 0x064e3b, side: THREE.DoubleSide })
    );
    box3.position.set(0, -22, 10);
    box3.lookAt(0, 0, 0);
    envScene.add(box3);

    const envTexture = pmremGenerator.fromScene(envScene, 0.04).texture;
    pmremGenerator.dispose();
    return envTexture;
  }

  function createCheckerTexture(c1, c2) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const size = 32;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? c1 : c2;
        ctx.fillRect(x * size, y * size, size, size);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }

  function createOrganicTerrainTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, 0, 512, 512);

    // Rich organic grass & moss micro-texture
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 1.2 + Math.random() * 2.8;
      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(20, 83, 45, 0.42)'
          : i % 3 === 1
          ? 'rgba(21, 128, 61, 0.38)'
          : 'rgba(101, 163, 13, 0.35)';
      ctx.fillRect(x, y, r, r * 2.4);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);
    return tex;
  }

  function createBirchBarkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, 128, 256);
    ctx.fillStyle = '#0f172a';
    for (let i = 0; i < 42; i++) {
      const y = Math.random() * 256;
      const x = Math.random() * 110;
      const w = 16 + Math.random() * 28;
      const h = 3 + Math.random() * 6;
      ctx.fillRect(x, y, w, h);
    }
    return new THREE.CanvasTexture(canvas);
  }

  function createSkyDomeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#021b33');
    grad.addColorStop(0.35, '#035388');
    grad.addColorStop(0.65, '#0284c7');
    grad.addColorStop(0.82, '#f59e0b');
    grad.addColorStop(0.92, '#ea580c');
    grad.addColorStop(1.0, '#06152d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 512);
    return new THREE.CanvasTexture(canvas);
  }

  function init(containerId, tooltipId, onLocationClick) {
    containerEl = document.getElementById(containerId);
    tooltipEl = document.getElementById(tooltipId);
    onLocationClickCallback = onLocationClick;

    clock = new THREE.Clock();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x042f4b);
    scene.fog = new THREE.FogExp2(0x042f4b, 0.0012);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 320);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.72;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerEl.appendChild(renderer.domElement);

    scene.environment = createStudioEnvironment(renderer);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2(-999, -999);

    setupStudioLighting();
    buildMishlandIsland();
    buildAllLocations();
    buildAllCharacters();
    buildAtmosphereAndBalloons();
    setupControls();

    window.addEventListener('resize', onWindowResize);
    animate();
  }

  function setupStudioLighting() {
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x052e16, 0.48);
    hemiLight.position.set(0, 42, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff3d6, 2.15);
    keyLight.position.set(30, 42, 26);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 5;
    keyLight.shadow.camera.far = 120;
    const d = 34;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x0284c7, 0.65);
    rimLight.position.set(-28, 22, -26);
    scene.add(rimLight);

    const plazaLight = new THREE.PointLight(0xf59e0b, 2.2, 24, 1.5);
    plazaLight.position.set(0, 6.5, 2);
    scene.add(plazaLight);
  }

  function buildMishlandIsland() {
    const islandGroup = new THREE.Group();
    const locations = window.MishlandData.locations;

    // 1. Atmospheric Sky Dome (Реалистичный небесный купол с солнечным горизонтом)
    const skyDomeGeo = new THREE.SphereGeometry(185, 32, 24);
    const skyDomeMat = new THREE.MeshBasicMaterial({
      map: createSkyDomeTexture(),
      side: THREE.BackSide,
      fog: false
    });
    const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
    scene.add(skyDome);

    // Glowing Sun Disc in the Sky
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(6.5, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, fog: false })
    );
    sunDisc.position.set(68, 56, -85);
    scene.add(sunDisc);

    // 2. Sculpted Multi-Biome 3D Terrain Mesh (Реалистичный рельеф с холмами, пляжами и гранитными скалами)
    function smoothstep(edge0, edge1, x) {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    }

    function distToSegment2D(px, pz, ax, az, bx, bz) {
      const l2 = (bx - ax) * (bx - ax) + (bz - az) * (bz - az);
      if (l2 === 0) return Math.hypot(px - ax, pz - az);
      let t = ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / l2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (ax + t * (bx - ax)), pz - (az + t * (bz - az)));
    }

    function computeTerrainHeight(x, z) {
      const r = Math.hypot(x, z);
      const angle = Math.atan2(z, x);

      // Organic coastline radius with bays & peninsulas
      const coastRadius =
        26.8 +
        Math.sin(angle * 3 + 0.4) * 2.1 +
        Math.cos(angle * 5 - 0.8) * 1.35 +
        Math.sin(angle * 7) * 0.75;

      // Multi-frequency natural hills (Холмы Парнаса и Келколово)
      const hillNoise =
        Math.sin(x * 0.17) * Math.cos(z * 0.17) * 1.45 +
        Math.sin(x * 0.34 + 1.1) * Math.sin(z * 0.29 - 0.5) * 0.75 +
        Math.cos((x + z) * 0.22) * 0.55;

      // Base island profile from center out to sea
      let baseH = 0.88;
      if (r < coastRadius - 3.5) {
        baseH = 0.88 + Math.max(0, hillNoise + 0.65) * 1.15;
      } else if (r < coastRadius + 2.5) {
        // Sloping down to sandy beach and water
        const shoreT = smoothstep(coastRadius - 3.5, coastRadius + 2.5, r);
        baseH = (0.88 + Math.max(0, hillNoise) * 0.5) * (1 - shoreT) + -0.85 * shoreT;
      } else {
        // Seafloor & outer rocky skerries (Карельские шхеры и островки в заливе)
        const skerryWave =
          Math.sin(x * 0.16 + 0.5) * Math.cos(z * 0.16 - 0.3) +
          Math.sin(x * 0.28 - z * 0.24) * 0.6;
        if (r > 32 && r < 49 && skerryWave > 0.75) {
          baseH = -0.5 + (skerryWave - 0.75) * 4.8;
        } else {
          baseH = -1.1;
        }
      }

      // Flatten walkable plateaus for Central Plaza, all 11 Locations, and Radial Roads!
      let flatWeight = 0;

      // Central Castle & Plaza plateau
      const dCenter = Math.hypot(x, z - 0.5);
      if (dCenter < 9.5) {
        flatWeight = Math.max(flatWeight, 1 - smoothstep(6.8, 9.5, dCenter));
      }

      // Each location plateau + radial avenue from center
      for (let i = 0; i < locations.length; i++) {
        const lx = locations[i].position.x;
        const lz = locations[i].position.z;
        const dLoc = Math.hypot(x - lx, z - lz);
        if (dLoc < 6.4) {
          flatWeight = Math.max(flatWeight, 1 - smoothstep(4.1, 6.4, dLoc));
        }
        const dRoad = distToSegment2D(x, z, 0, 0.8, lx, lz);
        if (dRoad < 2.3) {
          flatWeight = Math.max(flatWeight, 1 - smoothstep(1.15, 2.3, dRoad));
        }
      }

      return baseH * (1 - flatWeight) + 0.88 * flatWeight;
    }

    const terrainSize = 108;
    const terrainSegs = 128;
    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegs, terrainSegs);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    const cTemp = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = computeTerrainHeight(vx, vz);
      posAttr.setY(i, vy);

      // Biome vertex coloring by elevation & distance (Rich, saturated realistic outdoor colors)
      const microVar = (Math.sin(vx * 0.8) * Math.cos(vz * 0.8)) * 0.03;
      if (vy < 0.02) {
        // Underwater golden-ochre seabed sand
        cTemp.setRGB(0.68 + microVar, 0.48 + microVar, 0.16);
      } else if (vy < 0.58) {
        // Warm golden sandy beach (Пляжи Суздальских озёр и Финского залива)
        cTemp.setRGB(0.85 + microVar, 0.64 + microVar, 0.22);
      } else if (vy < 1.18) {
        // Deep saturated emerald meadow grass
        cTemp.setRGB(0.06 + microVar, 0.52 + microVar, 0.16 + microVar);
      } else if (vy < 2.15) {
        // Deep lush coniferous forest hill green
        cTemp.setRGB(0.04 + microVar, 0.36 + microVar, 0.11 + microVar);
      } else {
        // Warm Karelian rose-grey granite rocky ridge
        cTemp.setRGB(0.42 + microVar, 0.35 + microVar, 0.33 + microVar);
      }
      colors[i * 3] = cTemp.r;
      colors[i * 3 + 1] = cTemp.g;
      colors[i * 3 + 2] = cTemp.b;
    }

    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: createOrganicTerrainTexture(),
      roughness: 0.72,
      metalness: 0.05
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    islandGroup.add(terrainMesh);

    // 3. Realistic Shimmering Water Expanse (Финский залив, Нева и Ладога вокруг острова)
    const waterGeo = new THREE.CylinderGeometry(96, 96, 0.3, 64);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.32,
      roughness: 0.04,
      metalness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.94
    });
    waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = -0.02;
    waterMesh.receiveShadow = true;
    islandGroup.add(waterMesh);

    // Animated Shoreline Surf & Foam Rings
    for (let w = 0; w < 2; w++) {
      const foamRing = new THREE.Mesh(
        new THREE.TorusGeometry(27.0 + w * 1.1, 0.12, 8, 96),
        new THREE.MeshBasicMaterial({
          color: 0xe0f2fe,
          transparent: true,
          opacity: 0.48
        })
      );
      foamRing.rotation.x = Math.PI / 2;
      foamRing.position.y = 0.16;
      islandGroup.add(foamRing);
      animatedProps.push({ mesh: foamRing, type: 'wave_pulse', baseScale: 1.0, phase: w * 1.6 });
    }

    // 4. Central Royal Plaza & Cobblestone Radial Avenues with Street Lanterns
    const plazaTex = createCheckerTexture('#fbbf24', '#d97706');
    const plazaGeo = new THREE.CylinderGeometry(6.8, 7.1, 0.16, 48);
    const plazaMat = new THREE.MeshStandardMaterial({
      map: plazaTex,
      roughness: 0.42,
      metalness: 0.15
    });
    const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
    plazaMesh.position.set(0, 0.86, 0.6);
    plazaMesh.receiveShadow = true;
    islandGroup.add(plazaMesh);

    const ringGeo = new THREE.TorusGeometry(6.95, 0.15, 12, 64);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.22,
      metalness: 0.88
    });
    const ringMesh = new THREE.Mesh(ringGeo, goldMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.set(0, 0.94, 0.6);
    islandGroup.add(ringMesh);

    const cobbleMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.52,
      metalness: 0.12
    });
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.55,
      metalness: 0.2
    });

    locations.forEach(function (loc, locIdx) {
      if (loc.id === 'castle') return;
      const start = new THREE.Vector3(0, 0.89, 0.6);
      const end = new THREE.Vector3(loc.position.x, 0.89, loc.position.z);
      const dist = start.distanceTo(end);
      const steps = Math.floor(dist / 1.35);
      for (let i = 3; i < steps - 2; i++) {
        const t = i / steps;
        const pos = new THREE.Vector3().lerpVectors(start, end, t);
        const angle = Math.atan2(end.x - start.x, end.z - start.z);

        // Cobblestone road slab
        const slab = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.95), cobbleMat);
        slab.position.set(pos.x, 0.89, pos.z);
        slab.rotation.y = angle;
        slab.receiveShadow = true;
        islandGroup.add(slab);

        // Warm Gold Border Stones
        if (i % 2 === 0) {
          const border = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 8), curbMat);
          border.position.set(
            pos.x + Math.cos(angle) * 0.68,
            0.91,
            pos.z - Math.sin(angle) * 0.68
          );
          islandGroup.add(border);
        }
      }

      // Add a classic St. Petersburg Street Lantern halfway along every major avenue
      if (locIdx % 2 === 0) {
        const midPos = new THREE.Vector3().lerpVectors(start, end, 0.54);
        const perpX = -(end.z - start.z) / dist;
        const perpZ = (end.x - start.x) / dist;
        const lantern = createPetersburgLantern();
        lantern.position.set(midPos.x + perpX * 1.25, 0.88, midPos.z + perpZ * 1.25);
        islandGroup.add(lantern);
      }
    });

    // 5. Realistic Multi-Species Forest (Карельские сосны, русские берёзки, пушистые ели и валуны)
    const birchTex = createBirchBarkTexture();
    const natureSpots = [
      // North (around Ozerki & Shuvalovsky Park)
      { x: -5.5, z: -17.5, type: 'pine', s: 1.15 },
      { x: 5.5, z: -17.2, type: 'pine', s: 1.25 },
      { x: -6.2, z: -11.2, type: 'birch', s: 1.05 },
      { x: 6.4, z: -11.0, type: 'spruce', s: 1.1 },
      // North-West & West (between Morkovsky, Polytech & Cinema)
      { x: -16.2, z: -11.2, type: 'spruce', s: 1.2 },
      { x: -22.5, z: -9.5, type: 'pine', s: 1.3 },
      { x: -13.0, z: -8.5, type: 'birch', s: 1.0 },
      { x: -22.8, z: 0.2, type: 'pine', s: 1.25 },
      { x: -12.5, z: 0.5, type: 'birch', s: 1.1 },
      { x: -22.2, z: 10.8, type: 'spruce', s: 1.15 },
      { x: -15.2, z: 12.2, type: 'birch', s: 1.05 },
      // North-East & East (around Udachnaya 11km, Kelkolovo, Zenit & Music)
      { x: 16.5, z: -11.0, type: 'pine', s: 1.3 },
      { x: 22.5, z: -9.8, type: 'spruce', s: 1.2 },
      { x: 12.8, z: -8.2, type: 'birch', s: 1.1 },
      { x: 22.8, z: 0.0, type: 'pine', s: 1.2 },
      { x: 12.5, z: 0.4, type: 'spruce', s: 1.0 },
      { x: 22.2, z: 11.2, type: 'birch', s: 1.15 },
      { x: 15.2, z: 11.8, type: 'pine', s: 1.2 },
      // South (around Bar, Banya & Manik&Pedik)
      { x: -6.2, z: 14.5, type: 'birch', s: 1.1 },
      { x: 6.2, z: 14.5, type: 'birch', s: 1.2 },
      { x: 16.5, z: 18.2, type: 'pine', s: 1.25 },
      { x: -16.5, z: 18.2, type: 'spruce', s: 1.2 },
      { x: -5.2, z: 22.2, type: 'pine', s: 1.1 },
      { x: 5.4, z: 22.2, type: 'spruce', s: 1.15 }
    ];

    natureSpots.forEach(function (sp) {
      const y = computeTerrainHeight(sp.x, sp.z);
      let tree;
      if (sp.type === 'pine') {
        tree = createRealisticPineTree();
      } else if (sp.type === 'birch') {
        tree = createRealisticBirchTree(birchTex);
      } else {
        tree = createRealisticSpruceTree();
      }
      tree.position.set(sp.x, Math.max(0.65, y - 0.05), sp.z);
      tree.scale.setScalar(sp.s);
      tree.rotation.y = (sp.x * 1.7 + sp.z * 2.3) % (Math.PI * 2);
      islandGroup.add(tree);
    });

    // 6. Karelian Granite Boulders along the Coast & Hills (Гранитные валуны и камни)
    const boulderCoords = [
      [-8, -22], [8, -22.5], [-24, -6], [24, -6],
      [-24, 6], [24, 6], [-18, 19], [18, 19],
      [-8.5, -13], [8.5, -13], [-14, 11], [14, 11]
    ];
    boulderCoords.forEach(function (bc, idx) {
      const by = computeTerrainHeight(bc[0], bc[1]);
      const cluster = createGraniteBoulderCluster(idx);
      cluster.position.set(bc[0], by - 0.1, bc[1]);
      islandGroup.add(cluster);
    });

    // 7. Wooden Boat Pier with Sailboat on the Northern Bay
    const pierGroup = createWoodenPierAndBoat();
    pierGroup.position.set(-6.5, 0.2, -25.2);
    pierGroup.rotation.y = -0.22;
    islandGroup.add(pierGroup);

    scene.add(islandGroup);
  }

  function createPetersburgLantern() {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.88 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 2.2, 8), poleMat);
    pole.position.y = 1.1;
    pole.castShadow = true;
    g.add(pole);

    const lampHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfde047 })
    );
    lampHead.position.y = 2.28;
    g.add(lampHead);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 8), poleMat);
    cap.position.y = 2.48;
    g.add(cap);
    return g;
  }

  function createRealisticPineTree() {
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.78 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 2.7, 8), trunkMat);
    trunk.position.y = 1.35;
    trunk.rotation.z = 0.04;
    trunk.castShadow = true;
    g.add(trunk);

    const needleMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.58 });
    const puffs = [
      { x: 0, y: 2.85, z: 0, r: 1.05, sy: 0.62 },
      { x: -0.45, y: 2.45, z: 0.3, r: 0.78, sy: 0.58 },
      { x: 0.48, y: 2.55, z: -0.25, r: 0.82, sy: 0.58 },
      { x: 0.1, y: 3.3, z: 0.1, r: 0.72, sy: 0.6 }
    ];
    puffs.forEach(function (pf) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(pf.r, 1), needleMat);
      m.scale.y = pf.sy;
      m.position.set(pf.x, pf.y, pf.z);
      m.castShadow = true;
      g.add(m);
    });
    return g;
  }

  function createRealisticBirchTree(birchTex) {
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ map: birchTex, roughness: 0.55 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.21, 2.5, 8), trunkMat);
    trunk.position.y = 1.25;
    trunk.castShadow = true;
    g.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 });
    const crowns = [
      { x: 0, y: 2.55, z: 0, r: 0.92 },
      { x: -0.42, y: 2.15, z: 0.28, r: 0.68 },
      { x: 0.42, y: 2.25, z: -0.28, r: 0.72 },
      { x: 0, y: 3.1, z: 0, r: 0.65 }
    ];
    crowns.forEach(function (cr) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(cr.r, 1), leafMat);
      m.position.set(cr.x, cr.y, cr.z);
      m.castShadow = true;
      g.add(m);
    });
    return g;
  }

  function createRealisticSpruceTree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.28, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
    );
    trunk.position.y = 0.7;
    trunk.castShadow = true;
    g.add(trunk);

    const spruceMat = new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.55 });
    const tiers = [
      { r: 1.35, h: 1.5, y: 1.45 },
      { r: 1.1, h: 1.35, y: 2.2 },
      { r: 0.82, h: 1.2, y: 2.9 },
      { r: 0.52, h: 0.95, y: 3.5 }
    ];
    tiers.forEach(function (t) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 10), spruceMat);
      cone.position.y = t.y;
      cone.castShadow = true;
      g.add(cone);
    });
    return g;
  }

  function createGraniteBoulderCluster(seed) {
    const g = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.78,
      metalness: 0.12,
      flatShading: true
    });
    const mainRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68 + (seed % 3) * 0.18, 0), rockMat);
    mainRock.scale.set(1.2, 0.75, 1.0);
    mainRock.position.y = 0.32;
    mainRock.castShadow = true;
    mainRock.receiveShadow = true;
    g.add(mainRock);

    const subRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), rockMat);
    subRock.position.set(0.55, 0.2, 0.35);
    subRock.rotation.set(0.4, 0.8, 0.2);
    subRock.castShadow = true;
    g.add(subRock);
    return g;
  }

  function createWoodenPierAndBoat() {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.75 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 3.6), woodMat);
    deck.position.y = 0.35;
    deck.castShadow = true;
    g.add(deck);

    // Small sailboat moored by the pier
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.35, 1.8, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 })
    );
    hull.rotation.x = Math.PI / 2;
    hull.scale.set(1.0, 1.0, 0.55);
    hull.position.set(1.45, 0.1, -0.8);
    g.add(hull);

    const sail = new THREE.Mesh(
      new THREE.ConeGeometry(0.65, 1.8, 3),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.35 })
    );
    sail.position.set(1.45, 1.15, -0.8);
    g.add(sail);
    return g;
  }

  // Helper to create & update the 3D Floating Label + Candle Counter Sprite above each location
  function createLocationCandleSprite(loc) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(6.0, 1.88, 1);
    sprite.position.y = loc.id === 'castle' ? 9.1 : 5.45;
    sprite.renderOrder = 10;
    sprite.userData = {
      canvas: canvas,
      texture: tex,
      lastLit: -1,
      lastTotal: -1,
      loc: loc
    };
    drawLocationCandleCanvas(sprite, 0, loc.totalCandles || (loc.specialType ? 1 : 3));
    return sprite;
  }

  function drawLocationCandleCanvas(sprite, lit, total) {
    if (!sprite || !sprite.userData) return;
    const ud = sprite.userData;
    if (ud.lastLit === lit && ud.lastTotal === total) return;
    ud.lastLit = lit;
    ud.lastTotal = total;

    const canvas = ud.canvas;
    const ctx = canvas.getContext('2d');
    const loc = ud.loc;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isAllLit = lit >= total && total > 0;

    // Rounded glass badge background
    ctx.save();
    ctx.fillStyle = isAllLit ? 'rgba(6, 78, 59, 0.92)' : 'rgba(8, 16, 34, 0.92)';
    ctx.strokeStyle = isAllLit ? '#10b981' : '#fbbf24';
    ctx.lineWidth = 6;

    const x = 14, y = 10, w = 484, h = 140, r = 32;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Line 1: Bold Short Location Name
    ctx.font = '900 36px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText((loc.icon || '') + ' ' + (loc.shortName || loc.name), 256, 62);

    // Line 2: Clean, large Candle Counter
    ctx.font = '900 32px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = isAllLit ? '#34d399' : '#fde047';
    const statusText = '🕯️ ' + lit + ' / ' + total + (isAllLit ? ' ✅' : '');
    ctx.fillText(statusText, 256, 118);
    ctx.restore();

    ud.texture.needsUpdate = true;
  }

  // Helper to build physical 3D Candles on the front rim of each location
  function buildLocationCandlesRack(group, loc) {
    const total = loc.totalCandles || (loc.specialType ? 1 : 3);
    const rackGroup = new THREE.Group();

    // Orient rack toward the center of the island (or toward +Z for the central castle)
    const angleToCenter =
      loc.id === 'castle' ? 0 : Math.atan2(-loc.position.x, -loc.position.z);
    const distFromLocCenter = loc.id === 'castle' ? 3.15 : 2.95;
    rackGroup.position.set(
      Math.sin(angleToCenter) * distFromLocCenter,
      0.42,
      Math.cos(angleToCenter) * distFromLocCenter
    );
    rackGroup.rotation.y = angleToCenter;

    const holderMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.22,
      metalness: 0.88
    });
    const waxColors = [0xf43f5e, 0x38bdf8, 0xfbbf24, 0xa855f7];
    const candleEntries = [];

    // Pedestal bar under the location's candles
    const barWidth = total === 1 ? 0.85 : total * 0.62 + 0.35;
    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(barWidth, 0.18, 0.48),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.6 })
    );
    pedestal.position.y = 0.09;
    pedestal.castShadow = true;
    rackGroup.add(pedestal);

    for (let i = 0; i < total; i++) {
      const xOff = total === 1 ? 0 : (i - (total - 1) / 2) * 0.62;
      const cGroup = new THREE.Group();
      cGroup.position.set(xOff, 0.18, 0);

      // Golden cup saucer
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.1, 14), holderMat);
      cup.position.y = 0.05;
      cGroup.add(cup);

      // Wax body
      const wax = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.12, 0.78, 16),
        new THREE.MeshPhysicalMaterial({
          color: waxColors[i % waxColors.length],
          roughness: 0.25,
          clearcoat: 0.8
        })
      );
      wax.position.y = 0.48;
      wax.castShadow = true;
      cGroup.add(wax);

      // White spiral ribbon ring around the candle
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(0.115, 0.022, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      stripe.rotation.x = Math.PI / 2;
      stripe.position.y = 0.5;
      cGroup.add(stripe);

      // Wick
      const wick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.14, 6),
        new THREE.MeshBasicMaterial({ color: 0x1e293b })
      );
      wick.position.y = 0.92;
      cGroup.add(wick);

      // 3D Two-Layer Flame (visible when lit!)
      const flameGroup = new THREE.Group();
      flameGroup.position.y = 1.08;
      flameGroup.visible = false;

      const outerFlame = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.88 })
      );
      outerFlame.scale.set(0.78, 1.65, 0.78);
      flameGroup.add(outerFlame);

      const innerFlame = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      innerFlame.scale.set(0.75, 1.45, 0.75);
      innerFlame.position.y = -0.02;
      flameGroup.add(innerFlame);

      cGroup.add(flameGroup);
      rackGroup.add(cGroup);
      animatedProps.push({ mesh: flameGroup, type: 'flame_flicker' });
      candleEntries.push({ group: cGroup, flameMesh: flameGroup, waxMesh: wax });
    }

    group.add(rackGroup);
    return candleEntries;
  }

  function buildAllLocations() {
    const locations = window.MishlandData.locations;

    locations.forEach(function (loc) {
      const group = new THREE.Group();
      group.position.set(loc.position.x, 0.9, loc.position.z);

      const baseGeo = new THREE.CylinderGeometry(3.3, 3.6, 0.4, 24);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.4,
        metalness: 0.5
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.2;
      baseMesh.receiveShadow = true;
      group.add(baseMesh);

      const ringGeo = new THREE.TorusGeometry(3.55, 0.14, 12, 48);
      const ringMat = new THREE.MeshStandardMaterial({
        color: loc.color,
        emissive: loc.color,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.8
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = 0.25;
      group.add(ringMesh);

      if (loc.id === 'ozyornaya') {
        buildOzyornayaStationModel(group);
      } else if (loc.id === 'morkovsky') {
        buildMorkovskyDistrictModel(group);
      } else if (loc.id === 'udachnaya') {
        buildUdachnayaStationModel(group);
      } else if (loc.id === 'polytech') {
        buildPolytechModel(group);
      } else if (loc.id === 'zenit') {
        buildZenitStadiumModel(group);
      } else if (loc.id === 'cinema') {
        buildCinemaModel(group);
      } else if (loc.id === 'music') {
        buildMusicPauseModel(group);
      } else if (loc.id === 'bar') {
        buildBarModel(group);
      } else if (loc.id === 'banya') {
        buildBanyaModel(group);
      } else if (loc.id === 'beauty') {
        buildBeautySalonModel(group);
      } else if (loc.id === 'castle') {
        buildCastleAndCakeModel(group);
      }

      // Physical 3D Candles on the location's front rim
      const locCandles = buildLocationCandlesRack(group, loc);

      // 3D Floating Label & Candle Counter Sprite ("Свечи: X из Y")
      const candleSprite = createLocationCandleSprite(loc);
      group.add(candleSprite);

      const beaconGeo = new THREE.OctahedronGeometry(0.42, 0);
      const beaconMat = new THREE.MeshStandardMaterial({
        color: loc.accentColor,
        emissive: loc.color,
        emissiveIntensity: 0.9,
        roughness: 0.1,
        metalness: 0.9
      });
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.position.y = loc.id === 'castle' ? 10.6 : 6.75;
      group.add(beaconMesh);
      animatedProps.push({ mesh: beaconMesh, type: 'float_spin', baseY: beaconMesh.position.y });

      const hitGeo = new THREE.CylinderGeometry(3.85, 3.85, 8.2, 16);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.y = 4.1;
      hitMesh.userData = { locationId: loc.id, locationData: loc };
      group.add(hitMesh);
      interactiveMeshes.push(hitMesh);

      scene.add(group);
      locationObjects[loc.id] = {
        group: group,
        hitMesh: hitMesh,
        ringMesh: ringMesh,
        beaconMesh: beaconMesh,
        locCandles: locCandles,
        candleSprite: candleSprite,
        data: loc,
        physY: 0,
        velY: 0,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleAmp: 0
      };
    });
  }

  // 1. 🌊 Станция Озёрная — Три живописных Суздальских озера (Верхнее, Среднее и Нижнее) с пляжами, камышами и мостиком
  function buildOzyornayaStationModel(group) {
    // Grassy green shore terrace over the platform base so the 3 lakes sit in a natural landscape
    const meadowMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 });
    const meadow = new THREE.Mesh(new THREE.CylinderGeometry(3.22, 3.3, 0.16, 32), meadowMat);
    meadow.position.y = 0.42;
    meadow.receiveShadow = true;
    group.add(meadow);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      emissive: 0x0284c7,
      emissiveIntensity: 0.48,
      roughness: 0.05,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    });
    const deepWaterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.55,
      roughness: 0.04,
      clearcoat: 1.0
    });
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.6 });
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.75 });

    // Три Суздальских озера: 1-е (Верхнее), 2-е (Среднее), 3-е (Нижнее — самое крупное)
    const threeLakes = [
      { name: 'Верхнее', x: -1.35, z: -1.05, rx: 1.05, rz: 0.82, rot: 0.35 },
      { name: 'Среднее', x: 1.25, z: -0.75, rx: 1.12, rz: 0.88, rot: -0.4 },
      { name: 'Нижнее', x: 0.0, z: 1.18, rx: 1.55, rz: 1.02, rot: 0.12 }
    ];

    threeLakes.forEach(function (lk, idx) {
      const lakeGroup = new THREE.Group();
      lakeGroup.position.set(lk.x, 0.48, lk.z);
      lakeGroup.rotation.y = lk.rot;

      // Sandy beach rim
      const beach = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.06, 0.12, 28), sandMat);
      beach.scale.set(lk.rx + 0.2, 1, lk.rz + 0.2);
      beach.receiveShadow = true;
      lakeGroup.add(beach);

      // Shallow turquoise water
      const water = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.16, 28), waterMat);
      water.scale.set(lk.rx, 1, lk.rz);
      water.position.y = 0.03;
      lakeGroup.add(water);

      // Deep sapphire center of each lake
      const deepCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.18, 24), deepWaterMat);
      deepCenter.scale.set(lk.rx, 1, lk.rz);
      deepCenter.position.y = 0.04;
      lakeGroup.add(deepCenter);

      // White ripple ring on the water surface
      const ripple = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.025, 8, 28), foamMat);
      ripple.rotation.x = Math.PI / 2;
      ripple.scale.set(lk.rx, lk.rz, 1);
      ripple.position.y = 0.13;
      lakeGroup.add(ripple);

      // Reeds (камыши) on the lake shore
      const reedStemMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.7 });
      const reedHeadMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
      for (let r = 0; r < 4; r++) {
        const rAng = idx * 1.2 + r * 0.45;
        const rx = Math.cos(rAng) * (lk.rx - 0.05);
        const rz = Math.sin(rAng) * (lk.rz - 0.05);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.55, 6), reedStemMat);
        stem.position.set(rx, 0.3, rz);
        lakeGroup.add(stem);
        const cattail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.18, 6), reedHeadMat);
        cattail.position.set(rx, 0.52, rz);
        lakeGroup.add(cattail);
      }

      group.add(lakeGroup);
    });

    // Connecting blue streams (протоки между тремя озёрами) & arched wooden bridge
    const stream1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.28), waterMat);
    stream1.position.set(0, 0.5, -0.9);
    stream1.rotation.y = -0.15;
    group.add(stream1);

    const stream2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 1.3), waterMat);
    stream2.position.set(0.55, 0.5, 0.2);
    stream2.rotation.y = 0.4;
    group.add(stream2);

    // Wooden footbridge between the lakes
    const bridgeWood = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
    const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.42), bridgeWood);
    bridgeDeck.position.set(0.0, 0.64, -0.15);
    bridgeDeck.castShadow = true;
    group.add(bridgeDeck);

    // Tiny white sailboat on the 1st (Upper) Lake
    const miniHull = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.48, 4),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    miniHull.rotation.z = Math.PI / 2;
    miniHull.position.set(-1.35, 0.64, -1.0);
    group.add(miniHull);
    const miniSail = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.55, 3),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 })
    );
    miniSail.position.set(-1.35, 0.92, -1.0);
    group.add(miniSail);

    // Compact pine trees between the 3 lakes
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.65 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });
    [
      [-0.1, -1.85, 0.85],
      [-2.3, 0.25, 0.95],
      [2.25, 0.35, 0.9]
    ].forEach(function (tp) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.9, 7), trunkMat);
      tr.position.set(tp[0], 0.85, tp[1]);
      group.add(tr);
      const cr = new THREE.Mesh(new THREE.ConeGeometry(0.45 * tp[2], 1.15 * tp[2], 8), pineMat);
      cr.position.set(tp[0], 1.55, tp[1]);
      cr.castShadow = true;
      group.add(cr);
    });
  }

  // 2. 🥕 Морковский район — Монументальный «Дом со шпилем» и зелёный Московский Парк Победы с аллеями и фонтаном
  function buildMorkovskyDistrictModel(group) {
    // Green Park base over the platform ("Парк Победы")
    const parkLawn = new THREE.Mesh(
      new THREE.CylinderGeometry(3.22, 3.3, 0.16, 32),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.75 })
    );
    parkLawn.position.y = 0.42;
    parkLawn.receiveShadow = true;
    group.add(parkLawn);

    // Gravel park alleys (дорожки парка)
    const alleyMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.8 });
    const mainAlley = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 3.2), alleyMat);
    mainAlley.position.set(0, 0.51, 0.95);
    group.add(mainAlley);

    const crossAlley = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.04, 0.75), alleyMat);
    crossAlley.position.set(0, 0.51, 1.05);
    group.add(crossAlley);

    // === 1. знаменитый сталинский «ДОМ СО ШПИЛЕМ» (Московский пр., 190) ===
    const stalinWallMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a, // классический тёплый охристо-песочный цвет сталинского ампира
      roughness: 0.42,
      metalness: 0.1
    });
    const whiteTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.3,
      metalness: 0.1
    });
    const rustBaseMat = new THREE.MeshStandardMaterial({
      color: 0x78350f, // гранитный рустованный цоколь
      roughness: 0.65
    });
    const winDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.25,
      roughness: 0.2
    });

    const houseGroup = new THREE.Group();
    houseGroup.position.set(0, 0.48, -1.15);

    // Granite plinth
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.42, 1.45), rustBaseMat);
    plinth.position.y = 0.21;
    plinth.castShadow = true;
    houseGroup.add(plinth);

    // Central main block + two symmetrical wings
    const centerBlock = new THREE.Mesh(new THREE.BoxGeometry(1.65, 2.35, 1.35), stalinWallMat);
    centerBlock.position.set(0, 1.35, 0);
    centerBlock.castShadow = true;
    houseGroup.add(centerBlock);

    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.85, 1.15), stalinWallMat);
    leftWing.position.set(-1.3, 1.1, 0.1);
    leftWing.castShadow = true;
    houseGroup.add(leftWing);

    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.85, 1.15), stalinWallMat);
    rightWing.position.set(1.3, 1.1, 0.1);
    rightWing.castShadow = true;
    houseGroup.add(rightWing);

    // White classical cornice & pilasters on facade
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.12, 1.42), whiteTrimMat);
    cornice.position.set(0, 2.05, 0.05);
    houseGroup.add(cornice);

    for (let px = -1.6; px <= 1.6; px += 0.4) {
      const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), whiteTrimMat);
      pilaster.position.set(px, 1.2, 0.68);
      houseGroup.add(pilaster);
    }

    // Illuminated windows grid
    for (let wy = 0.7; wy <= 1.75; wy += 0.35) {
      for (let wx = -1.4; wx <= 1.4; wx += 0.4) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.05), winDarkMat);
        win.position.set(wx, wy, 0.69);
        houseGroup.add(win);
      }
    }

    // Stepped Central Tower Tier 1 (Квадратный ярус башни с угловыми обелисками)
    const towerTier1 = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.15, 1.18), stalinWallMat);
    towerTier1.position.set(0, 3.05, 0);
    towerTier1.castShadow = true;
    houseGroup.add(towerTier1);

    // White colonnade around the upper belvedere rotunda (Бельведер с колоннами)
    const towerTier2 = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.95, 12), stalinWallMat);
    towerTier2.position.set(0, 4.05, 0);
    towerTier2.castShadow = true;
    houseGroup.add(towerTier2);

    for (let c = 0; c < 8; c++) {
      const cAng = (c / 8) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.9, 8), whiteTrimMat);
      col.position.set(Math.cos(cAng) * 0.52, 4.05, Math.sin(cAng) * 0.52);
      houseGroup.add(col);
    }

    // Tall Golden Spire ("Шпиль") with glowing star & wreath at the top
    const spireMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.92
    });
    const spireCone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 2.35, 16), spireMat);
    spireCone.position.set(0, 5.65, 0);
    spireCone.castShadow = true;
    houseGroup.add(spireCone);

    const spireStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), spireMat);
    spireStar.position.set(0, 6.88, 0);
    houseGroup.add(spireStar);

    group.add(houseGroup);

    // === 2. ПАРК ПОБЕДЫ перед Домом со шпилем (пышные деревья, фонтан, скамейки, пруд) ===
    // Classic Fountain in the center of the park
    const fountainBasin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.74, 0.22, 24),
      whiteTrimMat
    );
    fountainBasin.position.set(0, 0.58, 1.05);
    group.add(fountainBasin);

    const fountainWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.58, 0.25, 24),
      new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.5, roughness: 0.08, clearcoat: 1.0 })
    );
    fountainWater.position.set(0, 0.6, 1.05);
    group.add(fountainWater);

    const fountainJet = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.65, 12),
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.85 })
    );
    fountainJet.position.set(0, 0.95, 1.05);
    group.add(fountainJet);

    // Lush Park Trees (Липы и дубы Московского парка Победы)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.55 });
    const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.5 });

    const parkTrees = [
      { x: -1.85, z: 0.55, s: 1.05 },
      { x: -1.45, z: 1.75, s: 0.92 },
      { x: 1.85, z: 0.55, s: 1.05 },
      { x: 1.45, z: 1.75, s: 0.92 },
      { x: -0.75, z: 2.25, s: 0.82 },
      { x: 0.75, z: 2.25, s: 0.82 }
    ];
    parkTrees.forEach(function (pt, idx) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.75, 8), trunkMat);
      tr.position.set(pt.x, 0.82, pt.z);
      group.add(tr);

      const crown = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.56 * pt.s, 1),
        idx % 2 === 0 ? foliageMat1 : foliageMat2
      );
      crown.position.set(pt.x, 1.42, pt.z);
      crown.castShadow = true;
      group.add(crown);
    });

    // Park Benches along the main alley
    const benchMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 });
    [-0.95, 0.95].forEach(function (bx) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.22), benchMat);
      bench.position.set(bx, 0.56, 1.4);
      group.add(bench);
    });
  }

  // 3. 🚂 Станция Удачная — Уютный деревянный дачный дом с верандой, мансардой, яблоней и штакетником
  function buildUdachnayaStationModel(group) {
    // Green dacha garden lawn
    const gardenLawn = new THREE.Mesh(
      new THREE.CylinderGeometry(3.22, 3.3, 0.16, 32),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 })
    );
    gardenLawn.position.y = 0.42;
    gardenLawn.receiveShadow = true;
    group.add(gardenLawn);

    const dachaGroup = new THREE.Group();
    dachaGroup.position.set(-0.2, 0.48, -0.2);

    // 1. Classic Two-Story Wooden Dacha House (Уютный дачный дом)
    const clapboardMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Тёплая золотисто-медовая вагонка
      roughness: 0.55
    });
    const logCornerMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.7
    });
    const whiteFrameMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // Белые резные наличники и переплёты веранды
      roughness: 0.3
    });
    const roofGreenMat = new THREE.MeshStandardMaterial({
      color: 0x15803d, // Классическая зелёная дачная крыша
      roughness: 0.4,
      metalness: 0.2
    });
    const warmWindowMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.65,
      roughness: 0.15
    });

    // Main ground floor of the dacha
    const mainHouse = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.65, 1.95), clapboardMat);
    mainHouse.position.set(0, 0.85, -0.25);
    mainHouse.castShadow = true;
    mainHouse.receiveShadow = true;
    dachaGroup.add(mainHouse);

    // Glazed Dacha Veranda in front (Остеклённая дачная веранда с частым белым переплётом)
    const veranda = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.25, 0.9), clapboardMat);
    veranda.position.set(0, 0.65, 0.95);
    veranda.castShadow = true;
    dachaGroup.add(veranda);

    const verandaGlass = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.65, 0.94), warmWindowMat);
    verandaGlass.position.set(0, 0.82, 0.95);
    dachaGroup.add(verandaGlass);

    // White wooden window mullions on veranda
    for (let vx = -0.8; vx <= 0.8; vx += 0.4) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.68, 0.96), whiteFrameMat);
      bar.position.set(vx, 0.82, 0.95);
      dachaGroup.add(bar);
    }

    // Veranda lean-to roof
    const verandaRoof = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.12, 1.1), roofGreenMat);
    verandaRoof.position.set(0, 1.35, 0.98);
    verandaRoof.rotation.x = 0.28;
    dachaGroup.add(verandaRoof);

    // Pitched Gable Attic Roof (Двускатная крыша с уютной мансардой)
    const roofPrismGeo = new THREE.ConeGeometry(1.88, 1.45, 4);
    const mainRoof = new THREE.Mesh(roofPrismGeo, roofGreenMat);
    mainRoof.rotation.y = Math.PI / 4;
    mainRoof.scale.set(1.12, 1.0, 0.98);
    mainRoof.position.set(0, 2.38, -0.25);
    mainRoof.castShadow = true;
    dachaGroup.add(mainRoof);

    // Attic Dormer Window (Светящееся слуховое окно мансарды с белыми наличниками)
    const dormerBox = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.78, 0.9), clapboardMat);
    dormerBox.position.set(0, 2.15, 0.35);
    dachaGroup.add(dormerBox);

    const dormerRoof = new THREE.Mesh(new THREE.ConeGeometry(0.76, 0.52, 4), roofGreenMat);
    dormerRoof.rotation.y = Math.PI / 4;
    dormerRoof.position.set(0, 2.75, 0.38);
    dachaGroup.add(dormerRoof);

    const atticWinFrame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.06), whiteFrameMat);
    atticWinFrame.position.set(0, 2.15, 0.81);
    dachaGroup.add(atticWinFrame);

    const atticWinGlass = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.38, 0.08), warmWindowMat);
    atticWinGlass.position.set(0, 2.15, 0.82);
    dachaGroup.add(atticWinGlass);

    // Red-Brick Chimney on the roof (Кирпичная печная труба на крыше дачи)
    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 1.1, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 })
    );
    chimney.position.set(0.65, 2.75, -0.55);
    chimney.castShadow = true;
    dachaGroup.add(chimney);

    // Wooden porch steps (Крыльцо со ступеньками)
    const porch = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.25, 0.55), logCornerMat);
    porch.position.set(0, 0.14, 1.55);
    dachaGroup.add(porch);

    group.add(dachaGroup);

    // 2. Apple Tree with Red Apples in the Dacha Garden (Яблоня с наливными яблоками)
    const appleTree = new THREE.Group();
    appleTree.position.set(1.75, 0.48, 0.65);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.16, 1.1, 8),
      logCornerMat
    );
    trunk.position.y = 0.55;
    appleTree.add(trunk);

    const crown = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.82, 1),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.55 })
    );
    crown.position.y = 1.45;
    crown.castShadow = true;
    appleTree.add(crown);

    const appleMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25 });
    [
      [-0.45, 1.35, 0.52],
      [0.42, 1.55, 0.48],
      [0.1, 1.2, 0.68],
      [-0.3, 1.75, -0.35],
      [0.5, 1.3, -0.3]
    ].forEach(function (ap) {
      const apple = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), appleMat);
      apple.position.set(ap[0], ap[1], ap[2]);
      appleTree.add(apple);
    });
    group.add(appleTree);

    // 3. White Wooden Picket Fence (Дачный заборчик-штакетник по краю участка)
    for (let i = 0; i < 9; i++) {
      const ang = 0.45 + (i / 8) * 1.95;
      const fx = Math.cos(ang) * 2.85;
      const fz = Math.sin(ang) * 2.85;
      const picket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.05), whiteFrameMat);
      picket.position.set(fx, 0.75, fz);
      picket.rotation.y = -ang + Math.PI / 2;
      group.add(picket);
    }

    // 4. Small Kelkolovo Quarry Lake in the corner (Голубой карьер 6 км у дачи)
    const lakeRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.78, 0.85, 0.12, 20),
      new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.65 })
    );
    lakeRim.position.set(-1.95, 0.49, 1.15);
    group.add(lakeRim);

    const lakeBlue = new THREE.Mesh(
      new THREE.CylinderGeometry(0.64, 0.64, 0.15, 20),
      new THREE.MeshPhysicalMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.4, roughness: 0.05, clearcoat: 1.0 })
    );
    lakeBlue.position.set(-1.95, 0.52, 1.15);
    group.add(lakeBlue);
  }

  // 4. ⚙️ Научный городок — Главное здание Политеха (Белый неоклассический дворец СПбПУ с портиком, фронтоном и крыльями)
  function buildPolytechModel(group) {
    // Park lawn & stone square in front of the Main Building of Polytech
    const parkBase = new THREE.Mesh(
      new THREE.CylinderGeometry(3.22, 3.3, 0.16, 32),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 })
    );
    parkBase.position.y = 0.42;
    parkBase.receiveShadow = true;
    group.add(parkBase);

    const bldgGroup = new THREE.Group();
    bldgGroup.position.set(0, 0.48, -0.35);

    // Neoclassical palette of the Main Building (Главное здание Политеха, 1902 г.)
    const whiteWallMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.32,
      metalness: 0.08
    });
    const creamWallMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.38,
      metalness: 0.08
    });
    const granitePlinthMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.65
    });
    const roofMetalMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.4,
      metalness: 0.5
    });
    const windowGlassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.35,
      roughness: 0.15
    });

    // 1. Granite Foundation & Long Symmetrical Palace Facade
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(4.85, 0.32, 2.2), granitePlinthMat);
    foundation.position.y = 0.16;
    foundation.castShadow = true;
    bldgGroup.add(foundation);

    // Main horizontal corps (протяжённый двухэтажный корпус)
    const mainCorps = new THREE.Mesh(new THREE.BoxGeometry(4.65, 1.85, 1.55), creamWallMat);
    mainCorps.position.set(0, 1.22, 0);
    mainCorps.castShadow = true;
    mainCorps.receiveShadow = true;
    bldgGroup.add(mainCorps);

    // Left and Right Projecting Side Risalits / Wings (Боковые ризалиты Главного здания)
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.05, 2.15), whiteWallMat);
    leftWing.position.set(-1.82, 1.32, 0.22);
    leftWing.castShadow = true;
    bldgGroup.add(leftWing);

    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.05, 2.15), whiteWallMat);
    rightWing.position.set(1.82, 1.32, 0.22);
    rightWing.castShadow = true;
    bldgGroup.add(rightWing);

    // Central Grand Avant-Corps (Центральный парадный ризалит)
    const centerRisalit = new THREE.Mesh(new THREE.BoxGeometry(1.85, 2.35, 1.85), whiteWallMat);
    centerRisalit.position.set(0, 1.48, 0.18);
    centerRisalit.castShadow = true;
    bldgGroup.add(centerRisalit);

    // 2. Monumental 6-Column Ionic Portico in Front (Шестиколонный белоснежный портик)
    const porticoStep = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.28, 0.55), granitePlinthMat);
    porticoStep.position.set(0, 0.14, 1.18);
    bldgGroup.add(porticoStep);

    for (let i = 0; i < 6; i++) {
      const cx = -0.78 + i * 0.312;
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.088, 1.68, 12), whiteWallMat);
      column.position.set(cx, 1.28, 1.22);
      column.castShadow = true;
      bldgGroup.add(column);
    }

    // Classical Triangular Pediment (Треугольный античный фронтон над колоннадой)
    const entablature = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.2, 0.45), whiteWallMat);
    entablature.position.set(0, 2.2, 1.12);
    bldgGroup.add(entablature);

    const pedimentPrism = new THREE.Mesh(new THREE.ConeGeometry(1.18, 0.65, 4), whiteWallMat);
    pedimentPrism.rotation.y = Math.PI / 4;
    pedimentPrism.scale.set(1.18, 1.0, 0.35);
    pedimentPrism.position.set(0, 2.6, 1.12);
    bldgGroup.add(pedimentPrism);

    // Stepped Central Attic & Low Neoclassical Dome Crown (Парадный аттик и купол Главного здания)
    const atticBox = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.48, 1.25), whiteWallMat);
    atticBox.position.set(0, 2.82, 0.1);
    bldgGroup.add(atticBox);

    const centralDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      roofMetalMat
    );
    centralDome.scale.set(1.15, 0.65, 0.95);
    centralDome.position.set(0, 3.04, 0.1);
    bldgGroup.add(centralDome);

    // Tall Arched Assembly Hall Windows (Большие арочные окна Белого зала на 2-м этаже и окна крыльев)
    for (let wx = -2.0; wx <= 2.0; wx += 0.4) {
      if (Math.abs(wx) < 0.85) continue; // Portico is in the center
      for (let wy = 0.72; wy <= 1.62; wy += 0.78) {
        const wMesh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.45, 0.05), windowGlassMat);
        const wz = Math.abs(wx) > 1.22 ? 1.31 : 0.79;
        wMesh.position.set(wx, wy, wz);
        bldgGroup.add(wMesh);
      }
    }

    // 3. Iconic Red-Brick Hydro Tower in the back corner of the campus (Знаменитая Гидробашня в парке Политеха)
    const brickMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.55 });
    const hydroTower = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.56, 2.9, 8), brickMat);
    hydroTower.position.set(2.15, 1.45, -1.35);
    hydroTower.castShadow = true;
    bldgGroup.add(hydroTower);

    const hydroRoof = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 0.95, 8),
      new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.3, metalness: 0.5 })
    );
    hydroRoof.position.set(2.15, 3.35, -1.35);
    bldgGroup.add(hydroRoof);

    group.add(bldgGroup);

    // Green trees in front of the Main Building (Политехнический парк)
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.55 });
    [-1.4, 1.4].forEach(function (tx) {
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 1), treeMat);
      bush.position.set(tx, 0.85, 1.65);
      bush.castShadow = true;
      group.add(bush);
    });
  }

  // 5. ⚽ Стадион «Зенит-Арена» — Полноценный стадион «Газпром Арена» с многоярусной чашей, трибунами, 8 пилонами, вантовой крышей, футбольными воротами и физичным мячом!
  function buildZenitStadiumModel(group) {
    // 1. Multi-Tiered Stadium Outer Bowl & Facade ("Космический корабль" на Крестовском острове)
    const lowerConcourse = new THREE.Mesh(
      new THREE.CylinderGeometry(3.25, 3.45, 0.55, 36),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.4, metalness: 0.3 })
    );
    lowerConcourse.position.y = 0.55;
    lowerConcourse.receiveShadow = true;
    group.add(lowerConcourse);

    // Metallic silver-blue spaceship outer shell (верхний скошенный ярус фасада чаши стадиона)
    const outerBowlShell = new THREE.Mesh(
      new THREE.CylinderGeometry(3.55, 3.05, 1.25, 36, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: 0x0284c7,
        emissive: 0x0369a1,
        emissiveIntensity: 0.45,
        roughness: 0.18,
        metalness: 0.75,
        clearcoat: 1.0,
        side: THREE.DoubleSide
      })
    );
    outerBowlShell.position.y = 1.42;
    outerBowlShell.castShadow = true;
    group.add(outerBowlShell);

    // Stepped Blue-White-SkyBlue Inner Grandstands (Трибуны стадиона внутри чаши)
    const standColors = [0x0369a1, 0x0284c7, 0x38bdf8];
    for (let tier = 0; tier < 3; tier++) {
      const rInner = 2.25 + tier * 0.38;
      const tierRing = new THREE.Mesh(
        new THREE.TorusGeometry(rInner, 0.22, 10, 36),
        new THREE.MeshStandardMaterial({
          color: standColors[tier],
          roughness: 0.35,
          metalness: 0.2
        })
      );
      tierRing.rotation.x = Math.PI / 2;
      tierRing.position.y = 0.85 + tier * 0.38;
      group.add(tierRing);
    }

    // 2. Retractable Roof Rim & Translucent Dome Collar (Светопрозрачная крыша с открытым центром над полем)
    const roofRim = new THREE.Mesh(
      new THREE.RingGeometry(1.95, 3.58, 36),
      new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.3,
        roughness: 0.1,
        metalness: 0.4,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide
      })
    );
    roofRim.rotation.x = Math.PI / 2;
    roofRim.position.y = 2.08;
    group.add(roofRim);

    const roofSteelRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.52, 0.12, 12, 36),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.85 })
    );
    roofSteelRing.rotation.x = Math.PI / 2;
    roofSteelRing.position.y = 2.08;
    group.add(roofSteelRing);

    // 3. Iconic 8 Tall White Pylons & Cable-Stayed Suspensions (8 знаменитых белых пилонов и ванты «Газпром Арены»)
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.18, metalness: 0.88 });
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.8 });

    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const pylon = new THREE.Mesh(new THREE.ConeGeometry(0.13, 4.3, 10), pylonMat);
      pylon.position.set(Math.cos(ang) * 3.15, 2.55, Math.sin(ang) * 3.15);
      pylon.rotation.z = -Math.cos(ang) * 0.16;
      pylon.rotation.x = Math.sin(ang) * 0.16;
      pylon.castShadow = true;
      group.add(pylon);

      // Glowing aviation beacon at pylon tip
      const tipLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      tipLight.position.set(Math.cos(ang) * 2.8, 4.65, Math.sin(ang) * 2.8);
      group.add(tipLight);

      // Stay cable from pylon tip toward the roof ring
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 6), cableMat);
      cable.position.set(Math.cos(ang) * 2.45, 3.3, Math.sin(ang) * 2.45);
      cable.rotation.z = Math.cos(ang) * 0.38;
      cable.rotation.x = -Math.sin(ang) * 0.38;
      group.add(cable);
    }

    // 4. Emerald Football Pitch with White Markings & 2 Football Goals (Поле с разметкой и воротами)
    const pitch = new THREE.Mesh(
      new THREE.CylinderGeometry(2.35, 2.35, 0.16, 36),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 })
    );
    pitch.position.y = 0.78;
    pitch.receiveShadow = true;
    group.add(pitch);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const centerCircle = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.03, 8, 24), lineMat);
    centerCircle.rotation.x = Math.PI / 2;
    centerCircle.position.y = 0.87;
    group.add(centerCircle);

    const halfwayLine = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.02, 0.05), lineMat);
    halfwayLine.position.y = 0.87;
    group.add(halfwayLine);

    // Football Goals at North & South ends of the pitch (Футбольные ворота)
    [-1.45, 1.45].forEach(function (gz) {
      const goalGroup = new THREE.Group();
      goalGroup.position.set(0, 0.87, gz);
      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.05), lineMat);
      crossbar.position.y = 0.42;
      goalGroup.add(crossbar);
      [-0.45, 0.45].forEach(function (gx) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 8), lineMat);
        post.position.set(gx, 0.21, 0);
        goalGroup.add(post);
      });
      group.add(goalGroup);
    });

    // 5. Bouncing Physical 3D Soccer Ball inside the stadium bowl
    const ballGroup = new THREE.Group();
    const ballCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.46, 1),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.15,
        clearcoat: 0.9
      })
    );
    ballCore.castShadow = true;
    ballGroup.add(ballCore);

    const patches = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.47, 0),
      new THREE.MeshBasicMaterial({ color: 0x0284c7, wireframe: true })
    );
    ballGroup.add(patches);

    ballGroup.position.set(0, 1.35, 0);
    group.add(ballGroup);

    soccerBall = {
      mesh: ballGroup,
      pos: new THREE.Vector3(0, 1.35, 0),
      vel: new THREE.Vector3(0.8, 5.5, 0.5),
      floorY: 1.32,
      maxRadius: 1.35,
      restitution: 0.78
    };
  }

  // 6. 🍺 Бар «Пенная Кружка» (Деревянный паб + две гигантские чокающиеся 3D-кружки с пивом и физичной пеной!)
  function buildBarModel(group) {
    // Cozy Tavern Base
    const barCounter = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 1.2, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6, metalness: 0.15 })
    );
    barCounter.position.set(0, 0.95, -0.7);
    barCounter.castShadow = true;
    group.add(barCounter);

    // Helper to build a 3D Beer Mug with Amber Liquid & Puffy White Foam
    function createBeerMug(xOffset) {
      const mug = new THREE.Group();
      mug.position.set(xOffset, 1.9, 0.35);

      const glassBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.52, 1.35, 16),
        new THREE.MeshPhysicalMaterial({
          color: 0xf59e0b,
          emissive: 0xd97706,
          emissiveIntensity: 0.35,
          roughness: 0.12,
          metalness: 0.1,
          clearcoat: 1.0
        })
      );
      glassBody.castShadow = true;
      mug.add(glassBody);

      // Mug Handle
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.09, 10, 16, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.2, metalness: 0.5 })
      );
      handle.rotation.z = xOffset < 0 ? Math.PI / 2 : -Math.PI / 2;
      handle.position.x = xOffset < 0 ? -0.55 : 0.55;
      mug.add(handle);

      // Puffy Foam Crown (Пышная шапка пены)
      const foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      const mainFoam = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), foamMat);
      mainFoam.scale.y = 0.55;
      mainFoam.position.y = 0.72;
      mug.add(mainFoam);

      for (let b = 0; b < 4; b++) {
        const ang = (b * Math.PI) / 2;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 10), foamMat);
        puff.position.set(Math.cos(ang) * 0.38, 0.85, Math.sin(ang) * 0.38);
        mug.add(puff);
      }

      return mug;
    }

    const mugLeft = createBeerMug(-0.85);
    const mugRight = createBeerMug(0.85);
    group.add(mugLeft, mugRight);

    animatedProps.push({
      type: 'bar_clink',
      mugL: mugLeft,
      mugR: mugRight,
      parentGroup: group
    });
  }

  // 6. 🎬 Киношная «Экран 1963» (Кинозал 1963 года, светящийся киноэкран, ретро-проектор с крутящимися 3D-бобинами и хлопушка!)
  function buildCinemaModel(group) {
    // 1. Retro Cinema Hall & Red Carpet
    const hallBody = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.8, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.3 })
    );
    hallBody.position.set(0, 1.3, -0.55);
    hallBody.castShadow = true;
    group.add(hallBody);

    // Glowing Cinema Screen ("ЭКРАН 1963")
    const screenFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.25, 0.14),
      new THREE.MeshPhysicalMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.55,
        roughness: 0.15,
        clearcoat: 1.0
      })
    );
    screenFrame.position.set(0, 1.45, 0.25);
    group.add(screenFrame);

    // Red Carpet Entrance
    const carpet = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.14, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.6 })
    );
    carpet.position.set(0, 0.44, 1.05);
    group.add(carpet);

    // 2. Vintage 1963 3D Film Projector on Roof with 2 Spinning Silver Film Reels (Кинобобины!)
    const reelMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.2,
      metalness: 0.9
    });

    const reel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.18, 20), reelMat);
    reel1.rotation.x = Math.PI / 2;
    reel1.position.set(-0.65, 3.05, -0.45);
    reel1.castShadow = true;
    group.add(reel1);
    animatedProps.push({ mesh: reel1, type: 'spin_tilted' });

    const reel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.18, 20), reelMat);
    reel2.rotation.x = Math.PI / 2;
    reel2.position.set(0.65, 3.05, -0.45);
    reel2.castShadow = true;
    group.add(reel2);
    animatedProps.push({ mesh: reel2, type: 'spin_reverse' });

    // Projector Lens Cone
    const lens = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.9, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.85
      })
    );
    lens.rotation.x = -Math.PI / 2;
    lens.position.set(0, 2.55, 0.35);
    group.add(lens);
  }

  // 7. 🎵 Музыкальная пауза (Гигантская вращающаяся 3D-виниловая пластинка 1963, золотой звукосниматель, ретро-микрофон и ноты!)
  function buildMusicPauseModel(group) {
    // 1. Turntable Stage Plinth
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.75, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.35, metalness: 0.3 })
    );
    plinth.position.set(0, 0.75, -0.15);
    plinth.castShadow = true;
    group.add(plinth);

    // 2. Giant Spinning 3D Vinyl Record 1963
    const vinylGroup = new THREE.Group();
    vinylGroup.position.set(-0.2, 1.2, -0.15);

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.35, 0.1, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0x0f172a,
        roughness: 0.15,
        metalness: 0.4,
        clearcoat: 1.0
      })
    );
    disc.castShadow = true;
    vinylGroup.add(disc);

    // Golden Center Record Label ("МЕЛОДИЯ 1963")
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 0.12, 24),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.4,
        roughness: 0.25,
        metalness: 0.8
      })
    );
    vinylGroup.add(label);

    // Shiny Groove Ring
    const groove = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.03, 8, 32),
      new THREE.MeshStandardMaterial({ color: 0xa78bfa, emissive: 0x7c3aed, emissiveIntensity: 0.5 })
    );
    groove.rotation.x = Math.PI / 2;
    groove.position.y = 0.06;
    vinylGroup.add(groove);

    group.add(vinylGroup);
    animatedProps.push({ mesh: vinylGroup, type: 'spin' });

    // 3. Chrome Retro Stage Microphone & Golden Horn
    const micStand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 2.2, 10),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.15, metalness: 0.9 })
    );
    micStand.position.set(1.15, 2.1, 0.55);
    group.add(micStand);

    const micHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        emissive: 0x8b5cf6,
        emissiveIntensity: 0.25,
        roughness: 0.2,
        metalness: 0.95
      })
    );
    micHead.scale.y = 1.3;
    micHead.position.set(1.15, 3.3, 0.55);
    group.add(micHead);

    // 4. Floating Golden 3D Musical Note Ring
    const noteRing = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.52, 0.12, 48, 10, 2, 3),
      new THREE.MeshStandardMaterial({
        color: 0xfde047,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.5,
        roughness: 0.15,
        metalness: 0.9
      })
    );
    noteRing.position.set(-0.2, 3.4, -0.15);
    group.add(noteRing);
    animatedProps.push({ mesh: noteRing, type: 'float_spin', baseY: 3.4 });
  }

  // 7. 🧖‍♂️ Царская Баня «Лёгкий Пар» (Бревенчатый сруб, печка-каменка, берёзовые веники и клубы физичного пара!)
  function buildBanyaModel(group) {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.75 });
    // Log walls stacked physically
    for (let row = 0; row < 4; row++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 2.7, 12), woodMat);
      log.rotation.z = Math.PI / 2;
      log.position.set(0, 0.65 + row * 0.42, -0.6);
      log.castShadow = true;
      group.add(log);
    }

    const banyaBody = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.7, 1.8), woodMat);
    banyaBody.position.set(0, 1.25, -0.6);
    banyaBody.castShadow = true;
    group.add(banyaBody);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.1, 1.35, 4),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 })
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 2.75, -0.6);
    roof.castShadow = true;
    group.add(roof);

    // Glowing Red-Hot Stove Chimney (Раскалённая труба каменки, откуда валит пар!)
    const chimney = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.38, 1.5, 12),
      new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0xea580c,
        emissiveIntensity: 0.5,
        roughness: 0.5
      })
    );
    chimney.position.set(0.75, 3.2, -0.6);
    group.add(chimney);

    // Waving Birch Brooms (Берёзовые веники)
    const broomGroup = new THREE.Group();
    broomGroup.position.set(-0.9, 1.6, 0.85);
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f })
    );
    broomGroup.add(handle);
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 })
    );
    leaves.scale.set(1.0, 1.35, 0.5);
    leaves.position.y = 0.55;
    broomGroup.add(leaves);
    group.add(broomGroup);

    animatedProps.push({
      type: 'banya_broom',
      mesh: broomGroup,
      parentGroup: group
    });
  }

  // 8. 💅 Салон «Маник & Педик» — Роскошные глянцевые РОЗОВЫЕ НОГОТКИ (5 пальчиков с розовым маникюром + 5 розовых ноготков педикюра + флакон лака)
  function buildBeautySalonModel(group) {
    // Velvet Glamorous Spa Podium
    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(2.85, 3.05, 0.52, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0x9d174d,
        roughness: 0.35,
        metalness: 0.15,
        clearcoat: 0.7
      })
    );
    podium.position.y = 0.56;
    podium.receiveShadow = true;
    group.add(podium);

    // Soft white-pink velvet manicure pillow (Бархатная подушечка для ручки и розовых ноготков)
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xfdf2f8, roughness: 0.45 });
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.36, 1.35), pillowMat);
    pillow.position.set(0, 0.92, 0.35);
    pillow.castShadow = true;
    group.add(pillow);

    // Skin material & Super-Glossy Hot Pink Nail Polish material ("розовые ноготки")
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xfde2d2,
      roughness: 0.4,
      metalness: 0.05
    });
    const pinkNailMat = new THREE.MeshPhysicalMaterial({
      color: 0xff2e93, // Ярко-розовый глянцевый лак!
      emissive: 0xec4899,
      emissiveIntensity: 0.42,
      roughness: 0.04,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02
    });
    const pastelPinkNailMat = new THREE.MeshPhysicalMaterial({
      color: 0xf472b6, // Нежно-розовый перламутровый лак
      emissive: 0xdb2777,
      emissiveIntensity: 0.35,
      roughness: 0.05,
      metalness: 0.12,
      clearcoat: 1.0
    });
    const rhinestoneMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // === 1. ПЯТЬ КРУПНЫХ ПАЛЬЧИКОВ С ГЛЯНЦЕВЫМИ РОЗОВЫМИ НОГОТКАМИ (МАНИКЮР) ===
    const fingerSpecs = [
      { x: -1.28, len: 1.05, r: 0.21, rotY: 0.18, yOff: 0.0, mat: pinkNailMat },      // Мизинчик
      { x: -0.64, len: 1.32, r: 0.23, rotY: 0.08, yOff: 0.05, mat: pastelPinkNailMat }, // Безымянный (со стразиком)
      { x: 0.0,   len: 1.48, r: 0.24, rotY: 0.0,  yOff: 0.08, mat: pinkNailMat },      // Средний
      { x: 0.64,  len: 1.34, r: 0.23, rotY: -0.08, yOff: 0.05, mat: pastelPinkNailMat },// Указательный
      { x: 1.28,  len: 1.02, r: 0.25, rotY: -0.22, yOff: -0.02, mat: pinkNailMat }     // Большой пальчик
    ];

    fingerSpecs.forEach(function (f, idx) {
      const fGroup = new THREE.Group();
      fGroup.position.set(f.x, 1.22 + f.yOff, 0.15);
      fGroup.rotation.y = f.rotY;
      fGroup.rotation.x = -0.18; // Изящный изгиб пальчиков вверх, чтобы розовые ноготки были отлично видны!

      // Finger cylinder
      const fingerBody = new THREE.Mesh(
        new THREE.CylinderGeometry(f.r * 0.92, f.r, f.len, 16),
        skinMat
      );
      fingerBody.rotation.x = Math.PI / 2;
      fingerBody.position.z = f.len * 0.35;
      fingerBody.castShadow = true;
      fGroup.add(fingerBody);

      // Rounded fingertip
      const fingerTip = new THREE.Mesh(new THREE.SphereGeometry(f.r * 0.92, 16, 12), skinMat);
      fingerTip.position.z = f.len * 0.85;
      fGroup.add(fingerTip);

      // Sculpted Almond-Shaped Glossy PINK NAIL (Длинный миндалевидный РОЗОВЫЙ НОГОТОК!)
      const nailPlate = new THREE.Mesh(new THREE.SphereGeometry(f.r * 0.98, 20, 16), f.mat);
      nailPlate.scale.set(0.88, 0.28, 1.95); // Вытянутая изящная форма ноготка
      nailPlate.position.set(0, f.r * 0.82, f.len * 0.98);
      nailPlate.rotation.x = -0.08;
      nailPlate.castShadow = true;
      fGroup.add(nailPlate);

      // Sparkling diamond rhinestone at the base of the pink nail
      if (idx === 1 || idx === 2 || idx === 3) {
        const gemStud = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), rhinestoneMat);
        gemStud.position.set(0, f.r * 1.08, f.len * 0.72);
        fGroup.add(gemStud);
      }

      group.add(fGroup);
    });

    // === 2. ПЯТЬ МИЛЫХ РОЗОВЫХ НОГОТКОВ ПЕДИКЮРА на переднем крае подиума ===
    for (let t = 0; t < 5; t++) {
      const tx = -0.76 + t * 0.38;
      const tr = 0.16 - t * 0.015;
      const toe = new THREE.Mesh(new THREE.SphereGeometry(tr, 14, 12), skinMat);
      toe.scale.set(1.0, 0.85, 1.3);
      toe.position.set(tx, 0.92, 1.82);
      group.add(toe);

      const toeNail = new THREE.Mesh(
        new THREE.SphereGeometry(tr * 0.88, 14, 12),
        t % 2 === 0 ? pinkNailMat : pastelPinkNailMat
      );
      toeNail.scale.set(0.95, 0.32, 1.15);
      toeNail.position.set(tx, 0.92 + tr * 0.78, 1.88);
      group.add(toeNail);
    }

    // === 3. ГИГАНТСКИЙ ФЛАКОН РОЗОВОГО ЛАКА НА ЗАДНЕМ ПЛАНЕ И КИСТОЧКА С КАПЛЕЙ РОЗОВОГО ЛАКА ===
    const bottleGroup = new THREE.Group();
    bottleGroup.position.set(0, 1.75, -1.25);

    const bottleGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.82, 1.55, 20),
      pinkNailMat
    );
    bottleGlass.castShadow = true;
    bottleGroup.add(bottleGlass);

    const goldCap = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 1.15, 16),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.18, metalness: 0.9 })
    );
    goldCap.position.y = 1.3;
    bottleGroup.add(goldCap);
    group.add(bottleGroup);

    // Floating Manicure Brush painting the pink nails
    const brushGroup = new THREE.Group();
    brushGroup.position.set(0, 3.1, 0.75);
    const handle = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.85, 12),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.9 })
    );
    handle.position.y = 0.55;
    brushGroup.add(handle);

    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), pinkNailMat);
    drop.scale.set(0.85, 1.35, 0.85);
    drop.position.y = -0.1;
    brushGroup.add(drop);

    group.add(brushGroup);
    animatedProps.push({ mesh: brushGroup, type: 'float_spin', baseY: 3.1 });
  }

  // 9. 🏰 Замок Именинного Торта — Высокий и правдоподобный 4-ярусный Праздничный Торт на фарфоровом постаменте с глазурью, кремом, ягодами и свечами!
  function buildCastleAndCakeModel(group) {
    const turretMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.32, metalness: 0.12 });
    const spireMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.18, metalness: 0.88 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.9 });
    const porcelainMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 1.0
    });

    // 4 Fairy-tale Castle Towers framing the tall Cake
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const tx = Math.cos(ang) * 2.92;
      const tz = Math.sin(ang) * 2.92;

      const tBody = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 4.2, 14), turretMat);
      tBody.position.set(tx, 2.4, tz);
      tBody.castShadow = true;
      group.add(tBody);

      const goldBand = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.045, 8, 16), goldMat);
      goldBand.rotation.x = Math.PI / 2;
      goldBand.position.set(tx, 4.45, tz);
      group.add(goldBand);

      const tSpire = new THREE.Mesh(new THREE.ConeGeometry(0.56, 1.55, 14), spireMat);
      tSpire.position.set(tx, 5.25, tz);
      tSpire.castShadow = true;
      group.add(tSpire);
    }

    // === 1. ФАРФОРОВЫЙ ПОСТАМЕНТ С ЗОЛОТОЙ КАЙМОЙ И АЖУРНОЙ САЛФЕТКОЙ ===
    const standFoot = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.65, 0.45, 28), porcelainMat);
    standFoot.position.y = 0.58;
    standFoot.castShadow = true;
    group.add(standFoot);

    const standPlate = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.52, 0.22, 36), porcelainMat);
    standPlate.position.y = 0.92;
    standPlate.receiveShadow = true;
    standPlate.castShadow = true;
    group.add(standPlate);

    const standGoldRim = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.055, 10, 36), goldMat);
    standGoldRim.rotation.x = Math.PI / 2;
    standGoldRim.position.y = 0.98;
    group.add(standGoldRim);

    // Helper to build a realistic Cake Tier with sponge, glossy drip glaze, piped cream rosettes & berries
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.35 });
    const strawberryMat = new THREE.MeshPhysicalMaterial({ color: 0xe11d48, roughness: 0.22, clearcoat: 0.85 });
    const leafGreenMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 });
    const blueberryMat = new THREE.MeshPhysicalMaterial({ color: 0x1e3a8a, roughness: 0.2, clearcoat: 0.9 });

    function addRealisticCakeTier(opts) {
      const tierGroup = new THREE.Group();
      tierGroup.position.y = opts.yBottom;

      // Sponge / Biscuit cylinder
      const spongeMat = new THREE.MeshStandardMaterial({
        color: opts.spongeColor,
        roughness: 0.52,
        metalness: 0.02
      });
      const sponge = new THREE.Mesh(
        new THREE.CylinderGeometry(opts.radius, opts.radius * 1.02, opts.height, 36),
        spongeMat
      );
      sponge.position.y = opts.height / 2;
      sponge.castShadow = true;
      sponge.receiveShadow = true;
      tierGroup.add(sponge);

      // Middle cream filling layer line (прослойка крема внутри коржа)
      const fillingBand = new THREE.Mesh(
        new THREE.CylinderGeometry(opts.radius * 1.012, opts.radius * 1.012, 0.12, 36),
        creamMat
      );
      fillingBand.position.y = opts.height * 0.5;
      tierGroup.add(fillingBand);

      // Glossy Mirror / Ganache Glaze Cap on top of the tier
      const glazeMat = new THREE.MeshPhysicalMaterial({
        color: opts.glazeColor,
        roughness: 0.08,
        metalness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04
      });
      const glazeCap = new THREE.Mesh(
        new THREE.CylinderGeometry(opts.radius * 1.015, opts.radius * 1.02, 0.18, 36),
        glazeMat
      );
      glazeCap.position.y = opts.height - 0.04;
      tierGroup.add(glazeCap);

      // Realistic 3D Glaze Drips hanging down around the rim (аппетитные потёки глазури)
      const dripCount = opts.dripCount || 16;
      for (let d = 0; d < dripCount; d++) {
        const ang = (d / dripCount) * Math.PI * 2 + (opts.yBottom * 0.4);
        const dripLen = 0.28 + ((d * 7) % 5) * 0.11;
        const drip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, dripLen, 8), glazeMat);
        const rx = Math.cos(ang) * (opts.radius * 1.012);
        const rz = Math.sin(ang) * (opts.radius * 1.012);
        drip.position.set(rx, opts.height - 0.08 - dripLen / 2, rz);
        tierGroup.add(drip);

        const dropTip = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 8), glazeMat);
        dropTip.position.set(rx, opts.height - 0.08 - dripLen, rz);
        tierGroup.add(dropTip);
      }

      // Piped Whipped Cream Rosettes along the bottom seam & top crown (кремовые розочки)
      const rosetteCount = opts.rosetteCount || 14;
      for (let r = 0; r < rosetteCount; r++) {
        const ang = (r / rosetteCount) * Math.PI * 2;
        const bx = Math.cos(ang) * (opts.radius + 0.06);
        const bz = Math.sin(ang) * (opts.radius + 0.06);

        const bottomPip = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), creamMat);
        bottomPip.scale.set(1.0, 0.72, 1.0);
        bottomPip.position.set(bx, 0.08, bz);
        tierGroup.add(bottomPip);

        // Top rim cream swirl + alternating strawberry / blueberry
        const tx = Math.cos(ang) * (opts.radius - 0.16);
        const tz = Math.sin(ang) * (opts.radius - 0.16);
        const topSwirl = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 10), creamMat);
        topSwirl.position.set(tx, opts.height + 0.12, tz);
        tierGroup.add(topSwirl);

        if (r % 2 === 0) {
          // 3D Strawberry with green leaves
          const berry = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 10), strawberryMat);
          berry.position.set(tx, opts.height + 0.24, tz);
          berry.rotation.z = 0.2;
          tierGroup.add(berry);

          const leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.02, 0.04, 6), leafGreenMat);
          leaf.position.set(tx, opts.height + 0.15, tz);
          tierGroup.add(leaf);
        } else {
          // 3D Blueberry or Golden Sugar Pearl
          const pearl = new THREE.Mesh(
            new THREE.SphereGeometry(0.075, 10, 10),
            r % 4 === 1 ? blueberryMat : goldMat
          );
          pearl.position.set(tx, opts.height + 0.22, tz);
          tierGroup.add(pearl);
        }
      }

      group.add(tierGroup);
    }

    // === 2. ЧЕТЫРЕ ВЫСОКИХ РЕАЛИСТИЧНЫХ ЯРУСА ИМЕНИННОГО ТОРТА ===
    // Ярус 1 (Нижний гранд-корж: клубнично-сливочный бисквит + тёмный шоколадный ганаш)
    addRealisticCakeTier({
      yBottom: 1.03,
      radius: 2.28,
      height: 1.42,
      spongeColor: 0xfce7f3,
      glazeColor: 0x3e1f0d,
      dripCount: 20,
      rosetteCount: 16
    });

    // Ярус 2 (Второй корж: медово-ванильный бисквит + малиновая зеркальная глазурь)
    addRealisticCakeTier({
      yBottom: 2.45,
      radius: 1.76,
      height: 1.32,
      spongeColor: 0xfef3c7,
      glazeColor: 0xdb2777,
      dripCount: 16,
      rosetteCount: 14
    });

    // Ярус 3 (Третий корж: фисташковое суфле + белый шоколад)
    addRealisticCakeTier({
      yBottom: 3.77,
      radius: 1.28,
      height: 1.22,
      spongeColor: 0xd9f99d,
      glazeColor: 0xfff1f2,
      dripCount: 14,
      rosetteCount: 12
    });

    // Ярус 4 (Верхний королевский корж: крем-брюле + золотая карамельная глазурь)
    addRealisticCakeTier({
      yBottom: 4.99,
      radius: 0.88,
      height: 1.15,
      spongeColor: 0xffedd5,
      glazeColor: 0xf59e0b,
      dripCount: 12,
      rosetteCount: 10
    });

    // Crispy Wafer Rolls on the top tier (Хрустящие вафельные трубочки на вершине торта)
    const waferMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 });
    for (let w = 0; w < 3; w++) {
      const wAng = w * 2.1;
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.65, 10), waferMat);
      roll.position.set(Math.cos(wAng) * 0.25, 6.38, Math.sin(wAng) * 0.25);
      roll.rotation.z = 0.28 * Math.cos(wAng);
      roll.rotation.x = 0.28 * Math.sin(wAng);
      group.add(roll);
    }

    // === 3. 11 ВЫСОКИХ ПРАЗДНИЧНЫХ СВЕЧЕЙ НА ВЕРШИНЕ ТОРТА (ПО ОДНОЙ ОТ КАЖДОЙ ЛОКАЦИИ) ===
    const allLocs = window.MishlandData.locations;
    allLocs.forEach(function (locItem, idx) {
      const angle = (idx / allLocs.length) * Math.PI * 2;
      const r = 0.62;
      const candleGroup = new THREE.Group();
      candleGroup.position.set(Math.cos(angle) * r, 6.14, Math.sin(angle) * r);

      const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.08, 12), goldMat);
      holder.position.y = 0.04;
      candleGroup.add(holder);

      const wax = new THREE.Mesh(
        new THREE.CylinderGeometry(0.068, 0.075, 0.92, 14),
        new THREE.MeshPhysicalMaterial({ color: locItem.color, roughness: 0.22, clearcoat: 0.85 })
      );
      wax.position.y = 0.52;
      wax.castShadow = true;
      candleGroup.add(wax);

      const wick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6),
        new THREE.MeshBasicMaterial({ color: 0x1e293b })
      );
      wick.position.y = 1.02;
      candleGroup.add(wick);

      const flame = new THREE.Group();
      flame.position.y = 1.18;
      flame.visible = false;

      const outerF = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.9 })
      );
      outerF.scale.set(0.8, 1.7, 0.8);
      flame.add(outerF);

      const innerF = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      innerF.scale.set(0.75, 1.45, 0.75);
      flame.add(innerF);

      candleGroup.add(flame);

      group.add(candleGroup);
      candleGroup.userData = { flameMesh: flame, locId: locItem.id };
      animatedProps.push({ mesh: flame, type: 'flame_flicker' });
    });
  }

  // Helper to create & update floating 3D Player Name Tag above each character
  function createCharacterNameSprite(ch) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 72;
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.2, 0.62, 1);
    sprite.position.y = 2.25;
    sprite.renderOrder = 12;
    sprite.visible = ch.id === 'misha';
    sprite.userData = {
      canvas: canvas,
      texture: tex,
      lastLabel: ''
    };
    updateCharacterNameSprite(sprite, ch.emoji + ' ' + (ch.name || ch.avatarLabel), ch.id === 'misha');
    return sprite;
  }

  function updateCharacterNameSprite(sprite, labelText, isHost) {
    if (!sprite || !sprite.userData) return;
    const ud = sprite.userData;
    if (ud.lastLabel === labelText) return;
    ud.lastLabel = labelText;

    const canvas = ud.canvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.fillStyle = isHost ? 'rgba(120, 53, 15, 0.9)' : 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = isHost ? '#fbbf24' : '#38bdf8';
    ctx.lineWidth = 4;

    const x = 10, y = 8, w = 236, h = 56, r = 20;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText.slice(0, 16), 128, 44);
    ctx.restore();

    ud.texture.needsUpdate = true;
  }

  /**
   * Builds Misha the Bear + 10 detailed articulated 3D friend avatars
   * with swinging legs, boots, swinging arms, paws, expressive faces, costumes, tails & floating nameplates!
   */
  function buildAllCharacters() {
    const chars = window.MishlandData.characters;
    const friendChars = chars.filter(function (c) {
      return c.id !== 'misha';
    });

    // Group for glowing footstep route markers along cobblestone avenues
    routeMarkersGroup = new THREE.Group();
    scene.add(routeMarkersGroup);

    chars.forEach(function (ch, idx) {
      const charGroup = new THREE.Group();
      const bodyGroup = new THREE.Group(); // Bobs and tilts during walking
      charGroup.add(bodyGroup);

      const bodyMat = new THREE.MeshStandardMaterial({
        color: ch.color,
        roughness: 0.36,
        metalness: ch.id === 'robot' ? 0.82 : 0.08
      });
      const secMat = new THREE.MeshStandardMaterial({
        color: ch.secondaryColor || 0xffffff,
        roughness: 0.4,
        metalness: 0.08
      });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35 });
      const pinkInnerMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.45 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.9 });

      // Glowing player aura ring at feet
      const footRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.52, 0.055, 10, 28),
        new THREE.MeshBasicMaterial({ color: ch.hatColor || 0xfbbf24 })
      );
      footRing.rotation.x = Math.PI / 2;
      footRing.position.y = 0.05;
      footRing.visible = ch.id === 'misha';
      charGroup.add(footRing);

      // === 1. ARTICULATED LEGS & BOOTS (legL, legR) ===
      const bootMat = new THREE.MeshStandardMaterial({
        color: ch.id === 'misha' ? 0x78350f : 0x334155,
        roughness: 0.45
      });

      function createLeg(xSign) {
        const legPivot = new THREE.Group();
        legPivot.position.set(xSign * 0.17, 0.36, 0);

        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.32, 12), bodyMat);
        thigh.position.y = -0.14;
        thigh.castShadow = true;
        legPivot.add(thigh);

        const boot = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), bootMat);
        boot.scale.set(0.95, 0.72, 1.38);
        boot.position.set(0, -0.3, 0.05);
        boot.castShadow = true;
        legPivot.add(boot);

        return legPivot;
      }

      const legL = createLeg(-1);
      const legR = createLeg(1);
      bodyGroup.add(legL, legR);

      // === 2. DETAILED TORSO, VEST / JACKET & BOW-TIE ===
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.72, 18), bodyMat);
      torso.position.y = 0.62;
      torso.castShadow = true;
      bodyGroup.add(torso);

      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 14), secMat);
      belly.scale.set(0.92, 1.08, 0.52);
      belly.position.set(0, 0.6, 0.22);
      bodyGroup.add(belly);

      // Festive Birthday Bow-Tie or Scarf at the neck
      const bowColor = ch.id === 'misha' ? 0xe11d48 : ch.hatColor || 0xfbbf24;
      const bowMat = new THREE.MeshStandardMaterial({ color: bowColor, roughness: 0.3 });
      const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), goldMat);
      bowCenter.position.set(0, 0.92, 0.29);
      bodyGroup.add(bowCenter);

      [-1, 1].forEach(function (s) {
        const bowWing = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.14, 8), bowMat);
        bowWing.rotation.z = s * (Math.PI / 2);
        bowWing.position.set(s * 0.075, 0.92, 0.29);
        bodyGroup.add(bowWing);
      });

      // Misha's Royal Birthday Waistcoat Trim & Gold Buttons
      if (ch.id === 'misha') {
        for (let b = 0; b < 3; b++) {
          const btn = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), goldMat);
          btn.position.set(0, 0.76 - b * 0.12, 0.35);
          bodyGroup.add(btn);
        }
      }

      // === 3. ARTICULATED ARMS & PAWS (armL, armR) ===
      function createArm(xSign, isMishaRight) {
        const armPivot = new THREE.Group();
        armPivot.position.set(xSign * 0.34, 0.84, 0);

        const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.078, 0.38, 12), bodyMat);
        upperArm.position.set(xSign * 0.04, -0.16, 0);
        upperArm.rotation.z = -xSign * 0.18;
        upperArm.castShadow = true;
        armPivot.add(upperArm);

        const paw = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), secMat);
        paw.position.set(xSign * 0.08, -0.35, 0.03);
        armPivot.add(paw);

        // Birthday Bear Misha holds a Golden Festive Lantern-Staff in his right paw!
        if (isMishaRight) {
          const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 8), goldMat);
          staff.position.set(0.08, -0.1, 0.18);
          staff.rotation.x = 0.25;
          armPivot.add(staff);

          const starTop = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.13, 0),
            new THREE.MeshBasicMaterial({ color: 0xfef08a })
          );
          starTop.position.set(0.08, 0.38, 0.3);
          armPivot.add(starTop);
        }

        return armPivot;
      }

      const armL = createArm(-1, false);
      const armR = createArm(1, ch.id === 'misha');
      bodyGroup.add(armL, armR);

      // === 4. SPECIES TAIL ON THE BACK ===
      if (ch.id === 'fox' || ch.id === 'raccoon') {
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.52, 10), bodyMat);
        tail.position.set(0, 0.45, -0.38);
        tail.rotation.x = -0.85;
        bodyGroup.add(tail);
        const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 8), secMat);
        tailTip.position.set(0, 0.58, -0.52);
        tailTip.rotation.x = -0.85;
        bodyGroup.add(tailTip);
      } else if (ch.id === 'bunny' || ch.id === 'misha' || ch.id === 'panda') {
        const pomTail = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), secMat);
        pomTail.position.set(0, 0.42, -0.34);
        bodyGroup.add(pomTail);
      } else if (ch.id === 'dragon' || ch.id === 'lion') {
        const lTail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.48, 8), bodyMat);
        lTail.position.set(0, 0.44, -0.36);
        lTail.rotation.x = -0.75;
        bodyGroup.add(lTail);
      }

      // === 5. EXPRESSIVE HEAD, SNOUT, NOSE, EYES WITH CATCHLIGHTS & BIRTHDAY HAT ===
      const headGroup = new THREE.Group();
      headGroup.position.y = 1.22;
      bodyGroup.add(headGroup);

      const headGeo =
        ch.id === 'robot'
          ? new THREE.BoxGeometry(0.58, 0.52, 0.52)
          : new THREE.SphereGeometry(0.36, 22, 20);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.castShadow = true;
      headGroup.add(head);

      // Protruding 3D Snout / Muzzle & Shiny Nose
      if (ch.id !== 'robot' && ch.id !== 'owl' && ch.id !== 'penguin') {
        const snout = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), secMat);
        snout.scale.set(1.05, 0.82, 0.9);
        snout.position.set(0, -0.06, 0.29);
        headGroup.add(snout);

        const nose = new THREE.Mesh(
          new THREE.SphereGeometry(0.058, 10, 10),
          ch.id === 'bunny' || ch.id === 'unicorn' ? pinkInnerMat : darkMat
        );
        nose.scale.set(1.2, 0.85, 0.9);
        nose.position.set(0, -0.01, 0.43);
        headGroup.add(nose);
      }

      // Rosy Cheeks (Праздничный румянец на щёчках)
      const blushMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.45 });
      [-0.21, 0.21].forEach(function (bx) {
        const blush = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), blushMat);
        blush.scale.set(1.2, 0.75, 0.5);
        blush.position.set(bx, -0.05, 0.29);
        headGroup.add(blush);
      });

      // Expressive Eyes with White Sclera, Dark Pupils & Sparkling Catchlights
      const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
      [-0.125, 0.125].forEach(function (ex) {
        // Panda/Raccoon eye patch
        if (ch.id === 'panda' || ch.id === 'raccoon') {
          const patch = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 10), darkMat);
          patch.scale.set(1.1, 0.9, 0.4);
          patch.position.set(ex, 0.06, 0.29);
          headGroup.add(patch);
        }

        const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 12), scleraMat);
        sclera.scale.set(1.0, 1.12, 0.65);
        sclera.position.set(ex, 0.06, 0.31);
        headGroup.add(sclera);

        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 10), pupilMat);
        pupil.position.set(ex, 0.06, 0.35);
        headGroup.add(pupil);

        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), scleraMat);
        glint.position.set(ex + 0.018, 0.082, 0.382);
        headGroup.add(glint);
      });

      // Species Ears / Horns / Beak / Crown
      if (ch.id === 'misha' || ch.id === 'panda' || ch.id === 'raccoon') {
        const earMat = ch.id === 'panda' ? darkMat : bodyMat;
        [-0.27, 0.27].forEach(function (ex) {
          const ear = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), earMat);
          ear.scale.set(1.0, 1.0, 0.65);
          ear.position.set(ex, 0.29, -0.02);
          headGroup.add(ear);

          const innerEar = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), pinkInnerMat);
          innerEar.scale.set(1.0, 1.0, 0.4);
          innerEar.position.set(ex, 0.29, 0.05);
          headGroup.add(innerEar);
        });

        if (ch.id === 'misha') {
          const crown = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.048, 8, 20), goldMat);
          crown.rotation.x = Math.PI / 2;
          crown.position.y = 0.34;
          headGroup.add(crown);
        }
      } else if (ch.id === 'bunny') {
        [-0.15, 0.15].forEach(function (ex) {
          const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.52, 12), bodyMat);
          ear.position.set(ex, 0.46, -0.02);
          ear.rotation.z = -ex * 0.25;
          headGroup.add(ear);
          const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.42, 10), pinkInnerMat);
          inner.position.set(ex, 0.46, 0.03);
          inner.rotation.z = -ex * 0.25;
          headGroup.add(inner);
        });
      } else if (ch.id === 'fox') {
        [-0.22, 0.22].forEach(function (ex) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 10), bodyMat);
          ear.position.set(ex, 0.36, 0);
          headGroup.add(ear);
        });
      } else if (ch.id === 'lion') {
        const mane = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.14, 12, 22), secMat);
        mane.position.set(0, 0.0, -0.04);
        headGroup.add(mane);
      } else if (ch.id === 'unicorn') {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.48, 12), goldMat);
        horn.position.set(0, 0.42, 0.22);
        horn.rotation.x = 0.35;
        headGroup.add(horn);
      } else if (ch.id === 'dragon') {
        [-0.2, 0.2].forEach(function (ex) {
          const h = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 8), secMat);
          h.position.set(ex, 0.35, -0.05);
          headGroup.add(h);
        });
      } else if (ch.id === 'owl' || ch.id === 'penguin') {
        const beak = new THREE.Mesh(
          new THREE.ConeGeometry(0.095, 0.22, 10),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 })
        );
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, -0.02, 0.38);
        headGroup.add(beak);
      } else if (ch.id === 'robot') {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), secMat);
        ant.position.set(0, 0.38, 0);
        headGroup.add(ant);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
        bulb.position.set(0, 0.56, 0);
        headGroup.add(bulb);
      }

      // Festive Birthday Cone Hat with Pom-Pom on top
      const hat = new THREE.Mesh(
        new THREE.ConeGeometry(0.19, 0.44, 14),
        new THREE.MeshStandardMaterial({
          color: ch.hatColor,
          roughness: 0.2,
          metalness: ch.id === 'misha' ? 0.9 : 0.35
        })
      );
      hat.position.y = 0.52;
      headGroup.add(hat);

      const pomPom = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), scleraMat);
      pomPom.position.y = 0.75;
      headGroup.add(pomPom);

      // 3D Floating Player Nameplate Sprite above the character
      const nameSprite = createCharacterNameSprite(ch);
      charGroup.add(nameSprite);

      let offset = new THREE.Vector3(0, 0, 0);
      if (ch.id !== 'misha') {
        const friendIdx = friendChars.findIndex(function (fc) {
          return fc.id === ch.id;
        });
        const angle = (friendIdx / friendChars.length) * Math.PI * 2;
        const radius = 1.65 + (friendIdx % 2) * 0.45;
        offset = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      }

      charGroup.position.copy(partyCurrentPos).add(offset);
      scene.add(charGroup);

      characterMeshes[ch.id] = {
        group: charGroup,
        bodyGroup: bodyGroup,
        headGroup: headGroup,
        legL: legL,
        legR: legR,
        armL: armL,
        armR: armR,
        footRing: footRing,
        nameSprite: nameSprite,
        offset: offset,
        trailOrder: idx,
        walkPhase: idx * 0.85,
        celebrateTimer: 0,
        physY: 0,
        velY: 0
      };
    });
  }

  function buildAtmosphereAndBalloons() {
    const balloonColors = [0xf43f5e, 0xfbbf24, 0x38bdf8, 0xa855f7, 0x10b981, 0xf97316];
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const rad = 14 + (i % 3) * 6;
      const bGroup = new THREE.Group();
      const bMat = new THREE.MeshPhysicalMaterial({
        color: balloonColors[i % balloonColors.length],
        roughness: 0.15,
        metalness: 0.1,
        clearcoat: 1.0
      });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 16), bMat);
      sphere.scale.y = 1.2;
      bGroup.add(sphere);

      const basket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.18, 0.25, 8),
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 })
      );
      basket.position.y = -1.3;
      bGroup.add(basket);

      const baseY = 7.5 + (i % 4) * 2.2;
      bGroup.position.set(Math.cos(ang) * rad, baseY, Math.sin(ang) * rad);
      scene.add(bGroup);
      animatedProps.push({ mesh: bGroup, type: 'balloon_bob', baseY: baseY, phase: i });
    }

    // Fluffy 3D Volumetric Cumulus Clouds drifting around the horizon
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.0,
      transparent: true,
      opacity: 0.88
    });
    for (let c = 0; c < 14; c++) {
      const cAng = (c / 14) * Math.PI * 2;
      const cRad = 32 + (c % 3) * 14;
      const cHeight = 14.5 + (c % 4) * 3.2;
      const cloudGroup = new THREE.Group();

      const puffOffsets = [
        [0, 0, 0, 1.9],
        [-1.6, -0.25, 0.3, 1.35],
        [1.65, -0.2, -0.25, 1.45],
        [-0.7, 0.55, -0.3, 1.3],
        [0.85, 0.45, 0.35, 1.25],
        [0.1, -0.35, 0.95, 1.15]
      ];
      puffOffsets.forEach(function (po) {
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(po[3], 1), cloudMat);
        puff.position.set(po[0], po[1], po[2]);
        puff.scale.set(1.25, 0.78, 1.0);
        cloudGroup.add(puff);
      });

      cloudGroup.position.set(Math.cos(cAng) * cRad, cHeight, Math.sin(cAng) * cRad);
      cloudGroup.rotation.y = -cAng + Math.PI / 2;
      const cScale = 0.85 + (c % 3) * 0.32;
      cloudGroup.scale.setScalar(cScale);
      scene.add(cloudGroup);

      animatedProps.push({
        mesh: cloudGroup,
        type: 'cloud_drift',
        radius: cRad,
        angle: cAng,
        baseY: cHeight,
        speed: 0.018 + (c % 3) * 0.006,
        phase: c * 1.1
      });
    }
  }

  // Spawn Physical Beer Foam Bubbles in Bar
  function spawnBeerFoamBurst(count) {
    if (!locationObjects.bar) return;
    const basePos = locationObjects.bar.group.position;
    const num = count || 18;
    for (let i = 0; i < num; i++) {
      const r = 0.12 + Math.random() * 0.16;
      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(r, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      bubble.position.set(
        basePos.x + (Math.random() - 0.5) * 2.0,
        basePos.y + 2.8,
        basePos.z + 0.35 + (Math.random() - 0.5) * 0.8
      );
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3.2,
        2.5 + Math.random() * 4.5,
        (Math.random() - 0.5) * 3.2
      );
      scene.add(bubble);
      foamBubbles.push({ mesh: bubble, vel: vel, life: 1.8 + Math.random() * 0.8 });
    }
  }

  // Spawn Buoyant 3D Steam Puffs in Banya
  function spawnBanyaSteamBurst(count) {
    if (!locationObjects.banya) return;
    const basePos = locationObjects.banya.group.position;
    const num = count || 14;
    for (let i = 0; i < num; i++) {
      const r = 0.28 + Math.random() * 0.25;
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(r, 12, 12),
        new THREE.MeshStandardMaterial({
          color: 0xf1f5f9,
          transparent: true,
          opacity: 0.78,
          roughness: 0.9
        })
      );
      puff.position.set(
        basePos.x + 0.75 + (Math.random() - 0.5) * 0.9,
        basePos.y + 3.8,
        basePos.z - 0.6 + (Math.random() - 0.5) * 0.9
      );
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 1.4,
        1.8 + Math.random() * 2.4,
        (Math.random() - 0.5) * 1.4
      );
      scene.add(puff);
      steamPuffs.push({ mesh: puff, vel: vel, life: 2.4 + Math.random() * 0.8 });
    }
  }

  // Kick the 3D Soccer Ball at Zenit Stadium with gravity and bounce restitution
  function kickSoccerBall() {
    if (soccerBall) {
      soccerBall.vel.set(
        (Math.random() - 0.5) * 9.5,
        7.5 + Math.random() * 4.5,
        (Math.random() - 0.5) * 9.5
      );
    }
    if (locationObjects.zenit) {
      locationObjects.zenit.velY = 5.5;
      locationObjects.zenit.wobbleAmp = 0.16;
      triggerConfettiExplosion(locationObjects.zenit.group.position);
    }
  }

  // Trigger a Physical Impulse across the 3D island ("Всё должно быть достаточно физично!")
  function triggerPhysicalImpulse(focusLocId) {
    Object.keys(locationObjects).forEach(function (lid) {
      const obj = locationObjects[lid];
      const boost = lid === focusLocId ? 7.5 : 3.8 + Math.random() * 2.5;
      obj.velY = boost;
      obj.wobbleAmp = lid === focusLocId ? 0.22 : 0.12;
    });

    Object.keys(characterMeshes).forEach(function (cid, idx) {
      const cm = characterMeshes[cid];
      cm.velY = 6.5 + (idx % 3) * 1.4;
      cm.celebrateTimer = 1.6;
    });

    if (soccerBall) {
      soccerBall.vel.set(
        (Math.random() - 0.5) * 8,
        8.2,
        (Math.random() - 0.5) * 8
      );
    }
    spawnBeerFoamBurst(16);
    spawnBanyaSteamBurst(12);
  }

  function triggerConfettiExplosion(originVec) {
    const colors = [0xfbbf24, 0xf472b6, 0x38bdf8, 0x34d399, 0xa78bfa, 0xfef08a];
    const center = originVec || partyCurrentPos;

    for (let i = 0; i < 55; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), mat);
      mesh.position.set(center.x, center.y + 2.5, center.z);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 9,
        4 + Math.random() * 7,
        (Math.random() - 0.5) * 9
      );
      scene.add(mesh);
      confettiParticles.push({ mesh: mesh, vel: vel, life: 2.6 });
    }

    Object.values(characterMeshes).forEach(function (cm) {
      cm.celebrateTimer = 2.0;
      cm.velY = 6.0 + Math.random() * 2.5;
    });
  }

  function buildRouteMarkers(fromVec, waypoints) {
    if (!routeMarkersGroup) {
      routeMarkersGroup = new THREE.Group();
      scene.add(routeMarkersGroup);
    }
    while (routeMarkersGroup.children.length > 0) {
      routeMarkersGroup.remove(routeMarkersGroup.children[0]);
    }
    if (!waypoints || waypoints.length === 0) return;

    const pts = [fromVec.clone()].concat(waypoints.map(function (w) { return w.clone(); }));
    const dotMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.4,
      roughness: 0.2
    });

    for (let s = 0; s < pts.length - 1; s++) {
      const a = pts[s];
      const b = pts[s + 1];
      const segDist = a.distanceTo(b);
      const steps = Math.max(2, Math.floor(segDist / 1.15));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const p = new THREE.Vector3().lerpVectors(a, b, t);
        const paw = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.08, 12), dotMat);
        paw.position.set(p.x, 0.94, p.z);
        paw.userData = { phase: (s * 10 + i) * 0.4 };
        routeMarkersGroup.add(paw);
      }
    }
  }

  function spawnWalkDust(pos) {
    if (walkDustParticles.length > 45) return;
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.14 + Math.random() * 0.08, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        roughness: 0.9,
        transparent: true,
        opacity: 0.65
      })
    );
    puff.position.set(
      pos.x + (Math.random() - 0.5) * 0.4,
      0.98,
      pos.z + (Math.random() - 0.5) * 0.4
    );
    scene.add(puff);
    walkDustParticles.push({
      mesh: puff,
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.8 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6),
      life: 0.65
    });
  }

  function syncWithGameState(state) {
    if (!state) return;

    const targetLocId = state.currentLocationId && locationObjects[state.currentLocationId]
      ? state.currentLocationId
      : 'castle';

    let desiredEndPos = new THREE.Vector3(0, 0.9, 4.4);
    if (targetLocId && locationObjects[targetLocId]) {
      const locPos = locationObjects[targetLocId].data.position;
      if (targetLocId === 'castle') {
        desiredEndPos.set(0, 0.9, 4.4);
      } else {
        desiredEndPos.set(locPos.x * 0.76, 0.9, locPos.z * 0.76 + 1.8);
      }
    }

    if (targetLocId !== lastTargetLocId) {
      lastTargetLocId = targetLocId;
      partyWaypoints = [];
      const curDistFromHub = Math.hypot(partyCurrentPos.x, partyCurrentPos.z);
      const endDistFromHub = Math.hypot(desiredEndPos.x, desiredEndPos.z);
      // Route along cobblestone radial avenues via the central plaza hub if moving between two outer locations
      if (curDistFromHub > 5.5 && endDistFromHub > 5.5 && partyCurrentPos.distanceTo(desiredEndPos) > 9.0) {
        const midHub = new THREE.Vector3(
          (partyCurrentPos.x + desiredEndPos.x) * 0.18,
          0.9,
          (partyCurrentPos.z + desiredEndPos.z) * 0.18 + 2.2
        );
        partyWaypoints.push(midHub);
      }
      partyWaypoints.push(desiredEndPos.clone());
      partyTargetPos.copy(partyWaypoints[0]);
      buildRouteMarkers(partyCurrentPos, partyWaypoints);
    }

    const completed = state.completedLocations || [];
    Object.keys(locationObjects).forEach(function (locId) {
      const obj = locationObjects[locId];
      const isCompleted = completed.indexOf(locId) !== -1;
      const isCurrent = state.currentLocationId === locId;

      if (isCompleted) {
        obj.ringMesh.material.color.setHex(0x34d399);
        obj.ringMesh.material.emissive.setHex(0x10b981);
        obj.ringMesh.material.emissiveIntensity = 1.0;
      } else if (isCurrent) {
        obj.ringMesh.material.color.setHex(0xfbbf24);
        obj.ringMesh.material.emissive.setHex(0xf59e0b);
        obj.ringMesh.material.emissiveIntensity = 1.2;
      } else {
        obj.ringMesh.material.color.setHex(obj.data.color);
        obj.ringMesh.material.emissive.setHex(obj.data.color);
        obj.ringMesh.material.emissiveIntensity = 0.45;
      }

      // Update per-location physical 3D candles & floating counter sprite
      if (window.MishlandSync && window.MishlandSync.getLocationCandleStats) {
        const cStats = window.MishlandSync.getLocationCandleStats(locId, state);
        if (obj.locCandles && obj.locCandles.length > 0) {
          obj.locCandles.forEach(function (candleEntry, idx) {
            const isLit = idx < cStats.lit;
            if (candleEntry.flameMesh) candleEntry.flameMesh.visible = isLit;
          });
        }
        if (obj.candleSprite) {
          drawLocationCandleCanvas(obj.candleSprite, cStats.lit, cStats.total);
        }
      }
    });

    if (locationObjects.castle) {
      locationObjects.castle.group.children.forEach(function (ch) {
        if (ch.userData && ch.userData.flameMesh) {
          const isLit = completed.indexOf(ch.userData.locId) !== -1;
          ch.userData.flameMesh.visible = isLit;
          if (ch.userData.haloMesh) {
            ch.userData.haloMesh.visible = isLit;
          }
        }
      });
    }

    const activeCharIds = { misha: 'Миша' };
    if (state.players) {
      Object.values(state.players).forEach(function (p) {
        if (p.charId) {
          activeCharIds[p.charId] = p.name || '';
        }
      });
    }
    Object.keys(characterMeshes).forEach(function (cid) {
      const cm = characterMeshes[cid];
      const isJoined = activeCharIds[cid] !== undefined;
      cm.group.scale.setScalar(cid === 'misha' ? 1.24 : isJoined ? 1.14 : 0.78);
      if (cm.footRing) {
        cm.footRing.visible = isJoined;
      }
      if (cm.nameSprite) {
        cm.nameSprite.visible = isJoined || cid === 'misha';
        if (isJoined && activeCharIds[cid]) {
          const charData = window.MishlandData.characters.find(function (c) {
            return c.id === cid;
          });
          const emoji = charData ? charData.emoji : '🎉';
          updateCharacterNameSprite(cm.nameSprite, emoji + ' ' + activeCharIds[cid], cid === 'misha');
        }
      }
    });
  }

  function setCameraMode(mode, focusLocId) {
    camRig.mode = mode;
    if (mode === 'overview') {
      camRig.target.set(0, 1.5, 1);
      camRig.desiredSpherical.radius = 40;
      camRig.desiredSpherical.phi = 0.92;
    } else if (mode === 'location') {
      const lid = focusLocId || (window.MishlandSync.getState() && window.MishlandSync.getState().currentLocationId);
      if (lid && locationObjects[lid]) {
        const p = locationObjects[lid].data.position;
        camRig.target.set(p.x, 2.2, p.z);
        camRig.desiredSpherical.radius = 15;
        camRig.desiredSpherical.phi = 1.05;
        // Give physical spring bounce to the focused location!
        locationObjects[lid].velY = 4.5;
        locationObjects[lid].wobbleAmp = 0.14;
      } else {
        camRig.target.set(0, 2.0, 2);
        camRig.desiredSpherical.radius = 18;
      }
    } else if (mode === 'follow') {
      camRig.desiredSpherical.radius = 16;
      camRig.desiredSpherical.phi = 1.02;
    } else if (mode === 'orbit') {
      camRig.target.set(0, 2.0, 0);
      camRig.desiredSpherical.radius = 36;
      camRig.desiredSpherical.phi = 0.98;
    }
  }

  function setupControls() {
    const dom = renderer.domElement;
    let pinchStartDist = 0;
    let pinchStartRadius = 40;

    dom.addEventListener('pointerdown', function (e) {
      camRig.isDragging = true;
      camRig.dragStart.x = e.clientX;
      camRig.dragStart.y = e.clientY;
      camRig.pointerDownPos.x = e.clientX;
      camRig.pointerDownPos.y = e.clientY;
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      updateHoverRaycast(e.clientX, e.clientY);
    });

    window.addEventListener('pointermove', function (e) {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      if (camRig.isDragging) {
        const dx = e.clientX - camRig.dragStart.x;
        const dy = e.clientY - camRig.dragStart.y;
        camRig.dragStart.x = e.clientX;
        camRig.dragStart.y = e.clientY;

        camRig.desiredSpherical.theta -= dx * 0.007;
        camRig.desiredSpherical.phi = Math.max(
          0.35,
          Math.min(1.42, camRig.desiredSpherical.phi - dy * 0.006)
        );
      } else {
        updateHoverRaycast(e.clientX, e.clientY);
      }
    });

    window.addEventListener('pointerup', function (e) {
      if (!camRig.isDragging) return;
      camRig.isDragging = false;
      const moveDist = Math.hypot(
        e.clientX - camRig.pointerDownPos.x,
        e.clientY - camRig.pointerDownPos.y
      );
      if (moveDist < 12) {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        updateHoverRaycast(e.clientX, e.clientY);
        handleCanvasClick();
      }
    });

    // Two-finger pinch-to-zoom for phones and tablets
    dom.addEventListener(
      'touchstart',
      function (e) {
        if (e.touches && e.touches.length === 2) {
          camRig.isDragging = false;
          pinchStartDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          pinchStartRadius = camRig.desiredSpherical.radius;
        }
      },
      { passive: true }
    );

    dom.addEventListener(
      'touchmove',
      function (e) {
        if (e.touches && e.touches.length === 2 && pinchStartDist > 10) {
          e.preventDefault();
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const scale = pinchStartDist / Math.max(20, dist);
          camRig.desiredSpherical.radius = Math.max(
            9,
            Math.min(62, pinchStartRadius * scale)
          );
        }
      },
      { passive: false }
    );

    dom.addEventListener(
      'wheel',
      function (e) {
        e.preventDefault();
        camRig.desiredSpherical.radius = Math.max(
          9,
          Math.min(62, camRig.desiredSpherical.radius + e.deltaY * 0.025)
        );
      },
      { passive: false }
    );
  }

  function updateHoverRaycast(clientX, clientY) {
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(interactiveMeshes, false);

    if (hits.length > 0) {
      const locData = hits[0].object.userData.locationData;
      if (hoveredLocId !== locData.id && locationObjects[locData.id]) {
        // Subtle physical spring pop on hover!
        locationObjects[locData.id].velY = Math.max(locationObjects[locData.id].velY, 1.8);
      }
      hoveredLocId = locData.id;
      containerEl.style.cursor = 'pointer';

      if (tooltipEl) {
        const st = window.MishlandSync.getState();
        const isDone = st && st.completedLocations && st.completedLocations.indexOf(locData.id) !== -1;
        const cStats = window.MishlandSync && window.MishlandSync.getLocationCandleStats
          ? window.MishlandSync.getLocationCandleStats(locData.id, st)
          : { lit: isDone ? 1 : 0, total: locData.totalCandles || 3 };
        const puzzleDesc = locData.specialType
          ? locData.puzzleType === 'WOMEN_ONLY'
            ? '💅 Бонус только дамам!'
            : '🍺🧖 Бонус всем без вопросов!'
          : locData.puzzleType === 'WORD'
          ? '🔤 СЛОВО'
          : '🔢 ЧИСЛО';
        tooltipEl.innerHTML =
          '<div class="tooltip-title">' +
          locData.icon +
          ' ' +
          locData.name +
          (isDone ? ' ✅' : '') +
          '</div>' +
          '<div class="tooltip-sub">🕯️ Свечи: <b>' +
          cStats.lit +
          ' из ' +
          cStats.total +
          '</b> • ' +
          puzzleDesc +
          '</div>';
        tooltipEl.style.left = clientX + 'px';
        tooltipEl.style.top = clientY + 'px';
        tooltipEl.classList.add('visible');
      }
    } else {
      hoveredLocId = null;
      containerEl.style.cursor = camRig.isDragging ? 'grabbing' : 'grab';
      if (tooltipEl) {
        tooltipEl.classList.remove('visible');
      }
    }
  }

  function handleCanvasClick() {
    if (hoveredLocId && onLocationClickCallback) {
      onLocationClickCallback(hoveredLocId);
    }
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.08);
    const elapsed = clock.getElapsedTime();

    // 1. Update Building Spring-Damper Physics
    Object.keys(locationObjects).forEach(function (lid) {
      const obj = locationObjects[lid];
      if (Math.abs(obj.physY) > 0.001 || Math.abs(obj.velY) > 0.001) {
        // Hooke's law + gravity + restitution on island base
        obj.velY -= 24.0 * dt;
        obj.physY += obj.velY * dt;
        if (obj.physY < 0) {
          obj.physY = 0;
          if (Math.abs(obj.velY) > 1.2) {
            obj.velY = -obj.velY * 0.52;
          } else {
            obj.velY = 0;
          }
        }
        obj.group.position.y = 0.9 + obj.physY;
      }
      if (obj.wobbleAmp > 0.001) {
        obj.wobbleAmp *= Math.pow(0.18, dt);
        obj.group.rotation.z = Math.sin(elapsed * 14 + obj.wobblePhase) * obj.wobbleAmp;
        obj.group.rotation.x = Math.cos(elapsed * 12 + obj.wobblePhase) * obj.wobbleAmp * 0.6;
      } else {
        obj.group.rotation.z = 0;
        obj.group.rotation.x = 0;
      }
    });

    // 2. Update 3D Soccer Ball Physics at Zenit Stadium
    if (soccerBall) {
      soccerBall.vel.y -= 20.0 * dt; // Gravity
      soccerBall.pos.addScaledVector(soccerBall.vel, dt);

      // Ground bounce with restitution
      if (soccerBall.pos.y <= soccerBall.floorY) {
        soccerBall.pos.y = soccerBall.floorY;
        if (Math.abs(soccerBall.vel.y) > 1.6) {
          soccerBall.vel.y = -soccerBall.vel.y * soccerBall.restitution;
        } else {
          // Keep it playfully dribbling on the pitch!
          soccerBall.vel.y = 4.2 + Math.random() * 2.0;
          soccerBall.vel.x += (Math.random() - 0.5) * 1.8;
          soccerBall.vel.z += (Math.random() - 0.5) * 1.8;
        }
      }

      // Pitch boundary bounce
      const rDist = Math.hypot(soccerBall.pos.x, soccerBall.pos.z);
      if (rDist > soccerBall.maxRadius) {
        const nx = soccerBall.pos.x / rDist;
        const nz = soccerBall.pos.z / rDist;
        soccerBall.pos.x = nx * soccerBall.maxRadius;
        soccerBall.pos.z = nz * soccerBall.maxRadius;
        soccerBall.vel.x = -soccerBall.vel.x * 0.75;
        soccerBall.vel.z = -soccerBall.vel.z * 0.75;
      }

      soccerBall.mesh.position.copy(soccerBall.pos);
      soccerBall.mesh.rotation.x += soccerBall.vel.z * dt * 2.2;
      soccerBall.mesh.rotation.z -= soccerBall.vel.x * dt * 2.2;
    }

    // 3. Multi-Waypoint Party Movement Along Cobblestone Avenues & Articulated Character Walk
    let distToTarget = partyCurrentPos.distanceTo(partyTargetPos);
    if (distToTarget <= 0.35 && partyWaypoints.length > 0) {
      partyWaypoints.shift();
      if (partyWaypoints.length > 0) {
        partyTargetPos.copy(partyWaypoints[0]);
        distToTarget = partyCurrentPos.distanceTo(partyTargetPos);
      } else if (routeMarkersGroup) {
        while (routeMarkersGroup.children.length > 0) {
          routeMarkersGroup.remove(routeMarkersGroup.children[0]);
        }
      }
    }

    const isWalking = distToTarget > 0.18;
    if (isWalking) {
      const moveDir = new THREE.Vector3().subVectors(partyTargetPos, partyCurrentPos);
      const stepLen = Math.min(distToTarget, dt * 6.8);
      partyLookAngle = Math.atan2(moveDir.x, moveDir.z);
      moveDir.normalize().multiplyScalar(stepLen);
      partyCurrentPos.add(moveDir);

      // Record trail history for marching column behind Misha
      partyTrailHistory.unshift({
        pos: partyCurrentPos.clone(),
        angle: partyLookAngle
      });
      if (partyTrailHistory.length > 90) {
        partyTrailHistory.pop();
      }
      if (Math.random() < 0.35) {
        spawnWalkDust(partyCurrentPos);
      }
    }

    // Animate glowing route markers
    if (routeMarkersGroup && routeMarkersGroup.children.length > 0) {
      for (let i = 0; i < routeMarkersGroup.children.length; i++) {
        const m = routeMarkersGroup.children[i];
        const pulse = 0.8 + Math.sin(elapsed * 6 - m.userData.phase) * 0.3;
        m.scale.set(pulse, 1, pulse);
      }
    }

    Object.keys(characterMeshes).forEach(function (cid) {
      const cm = characterMeshes[cid];
      let targetPos;
      let desiredYaw = cm.group.rotation.y;

      if (isWalking && partyTrailHistory.length > 4 && cid !== 'misha') {
        const orderIndex = cm.trailOrder || 1;
        const trailIdx = Math.max(0, Math.min(partyTrailHistory.length - 1, orderIndex * 5));
        const hist = partyTrailHistory[trailIdx];
        const sideOffset = (orderIndex % 2 === 0 ? 1 : -1) * 0.55;
        if (hist && hist.pos) {
          targetPos = new THREE.Vector3(
            hist.pos.x + Math.cos(hist.angle) * sideOffset,
            0.9,
            hist.pos.z - Math.sin(hist.angle) * sideOffset
          );
          desiredYaw = hist.angle;
        } else {
          targetPos = new THREE.Vector3().copy(partyCurrentPos).add(cm.offset);
          desiredYaw = partyLookAngle;
        }
      } else {
        targetPos = new THREE.Vector3().copy(partyCurrentPos).add(cm.offset);
        if (isWalking) {
          desiredYaw = partyLookAngle;
        } else {
          // Face slightly toward the camera/front when idle at a location
          desiredYaw = Math.sin(elapsed * 0.8 + cm.walkPhase) * 0.22;
        }
      }

      cm.group.position.x += (targetPos.x - cm.group.position.x) * Math.min(1, dt * 10);
      cm.group.position.z += (targetPos.z - cm.group.position.z) * Math.min(1, dt * 10);

      if (cm.physY > 0 || Math.abs(cm.velY) > 0.01) {
        cm.velY -= 24.0 * dt;
        cm.physY += cm.velY * dt;
        if (cm.physY <= 0) {
          cm.physY = 0;
          if (Math.abs(cm.velY) > 1.5) {
            cm.velY = -cm.velY * 0.55;
          } else {
            cm.velY = 0;
          }
        }
      }

      if (cm.celebrateTimer > 0) {
        cm.celebrateTimer -= dt;
        cm.group.position.y = 0.9 + cm.physY + Math.abs(Math.sin(elapsed * 12 + cm.walkPhase)) * 0.45;
        cm.group.rotation.y += dt * 6;
        if (cm.armL && cm.armR) {
          cm.armL.rotation.x = -2.3 + Math.sin(elapsed * 16 + cm.walkPhase) * 0.4;
          cm.armR.rotation.x = -2.3 - Math.sin(elapsed * 16 + cm.walkPhase) * 0.4;
        }
        if (cm.legL && cm.legR) {
          cm.legL.rotation.x = Math.sin(elapsed * 14) * 0.5;
          cm.legR.rotation.x = -Math.sin(elapsed * 14) * 0.5;
        }
      } else if (isWalking) {
        const stride = elapsed * 13 + cm.walkPhase;
        cm.group.position.y = 0.9 + cm.physY + Math.abs(Math.sin(stride)) * 0.28;
        cm.group.rotation.y = desiredYaw;
        cm.group.rotation.z = Math.sin(stride) * 0.08;
        if (cm.legL && cm.legR) {
          cm.legL.rotation.x = Math.sin(stride) * 0.65;
          cm.legR.rotation.x = -Math.sin(stride) * 0.65;
        }
        if (cm.armL && cm.armR) {
          cm.armL.rotation.x = -Math.sin(stride) * 0.55;
          cm.armR.rotation.x = Math.sin(stride) * 0.55;
        }
      } else {
        cm.group.position.y = 0.9 + cm.physY + Math.sin(elapsed * 2.5 + cm.walkPhase) * 0.05;
        cm.group.rotation.y += (desiredYaw - cm.group.rotation.y) * Math.min(1, dt * 5);
        cm.group.rotation.z = 0;
        if (cm.legL && cm.legR) {
          cm.legL.rotation.x *= 0.85;
          cm.legR.rotation.x *= 0.85;
        }
        if (cm.armL && cm.armR) {
          cm.armL.rotation.x = Math.sin(elapsed * 2.2 + cm.walkPhase) * 0.08;
          cm.armR.rotation.x = -Math.sin(elapsed * 2.2 + cm.walkPhase) * 0.08;
        }
      }
    });

    // Update walking footstep dust puffs
    for (let i = walkDustParticles.length - 1; i >= 0; i--) {
      const d = walkDustParticles[i];
      d.life -= dt;
      if (d.life <= 0) {
        scene.remove(d.mesh);
        walkDustParticles.splice(i, 1);
      } else {
        d.mesh.position.addScaledVector(d.vel, dt);
        d.mesh.scale.setScalar(1 + (0.65 - d.life) * 1.6);
        d.mesh.material.opacity = Math.max(0, d.life * 0.85);
      }
    }

    // 4. Update Animated Props (Gears, Clinking Beer Mugs, Waving Banya Brooms)
    for (let i = 0; i < animatedProps.length; i++) {
      const item = animatedProps[i];
      if (item.type === 'spin') {
        item.mesh.rotation.y += dt * 1.4;
      } else if (item.type === 'spin_reverse') {
        item.mesh.rotation.z -= dt * 1.8;
      } else if (item.type === 'spin_slow') {
        item.mesh.rotation.y += dt * 0.55;
      } else if (item.type === 'spin_tilted') {
        item.mesh.rotation.z += dt * 1.2;
      } else if (item.type === 'float_spin') {
        item.mesh.rotation.y += dt * 1.6;
        item.mesh.position.y = item.baseY + Math.sin(elapsed * 2.4) * 0.25;
      } else if (item.type === 'balloon_bob') {
        item.mesh.position.y = item.baseY + Math.sin(elapsed * 1.2 + item.phase) * 0.65;
        item.mesh.rotation.y = Math.sin(elapsed * 0.5 + item.phase) * 0.3;
      } else if (item.type === 'flame_flicker' && item.mesh.visible) {
        const s = 0.85 + Math.sin(elapsed * 18) * 0.15;
        item.mesh.scale.set(0.8 * s, 1.6 * s, 0.8 * s);
      } else if (item.type === 'bar_clink') {
        // Physical Beer Mugs Clinking Animation!
        const clinkWave = Math.sin(elapsed * 3.8);
        const offset = Math.max(-0.2, clinkWave * 0.25);
        item.mugL.position.x = -0.78 + offset;
        item.mugR.position.x = 0.78 - offset;
        item.mugL.rotation.z = -offset * 0.85;
        item.mugR.rotation.z = offset * 0.85;
        if (clinkWave > 0.96 && Math.random() < 0.28) {
          spawnBeerFoamBurst(2);
        }
      } else if (item.type === 'banya_broom') {
        // Waving Birch Brooms & Ambient Steam Puffs
        item.mesh.rotation.z = Math.sin(elapsed * 5.2) * 0.45;
        if (Math.random() < 0.08) {
          spawnBanyaSteamBurst(1);
        }
      } else if (item.type === 'wave_pulse') {
        // Coastal shoreline surf & foam ring pulsing
        const wave = Math.sin(elapsed * 1.45 + item.phase);
        const s = item.baseScale + wave * 0.018;
        item.mesh.scale.set(s, s, 1);
        if (item.mesh.material) {
          item.mesh.material.opacity = 0.24 + (wave * 0.5 + 0.5) * 0.28;
        }
      } else if (item.type === 'cloud_drift') {
        item.angle += item.speed * dt;
        item.mesh.position.x = Math.cos(item.angle) * item.radius;
        item.mesh.position.z = Math.sin(item.angle) * item.radius;
        item.mesh.position.y = item.baseY + Math.sin(elapsed * 0.6 + item.phase) * 0.35;
        item.mesh.rotation.y = -item.angle + Math.PI / 2;
      }
    }

    // Subtle Neva / Lake Ladoga water surface breathing
    if (waterMesh) {
      waterMesh.position.y = -0.35 + Math.sin(elapsed * 1.35) * 0.045;
    }

    // 5. Update Beer Foam Bubbles Physics
    for (let i = foamBubbles.length - 1; i >= 0; i--) {
      const b = foamBubbles[i];
      b.life -= dt;
      if (b.life <= 0) {
        scene.remove(b.mesh);
        foamBubbles.splice(i, 1);
      } else {
        b.vel.y -= 6.5 * dt;
        b.mesh.position.addScaledVector(b.vel, dt);
        b.mesh.scale.setScalar(Math.max(0.1, b.life * 0.65));
      }
    }

    // 6. Update Buoyant Banya Steam Puffs Physics
    for (let i = steamPuffs.length - 1; i >= 0; i--) {
      const s = steamPuffs[i];
      s.life -= dt;
      if (s.life <= 0) {
        scene.remove(s.mesh);
        steamPuffs.splice(i, 1);
      } else {
        s.mesh.position.addScaledVector(s.vel, dt);
        const scale = 1.0 + (2.5 - s.life) * 0.65;
        s.mesh.scale.setScalar(scale);
        s.mesh.material.opacity = Math.max(0, s.life * 0.32);
      }
    }

    // 7. Update Confetti Particles Physics
    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const p = confettiParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.mesh);
        confettiParticles.splice(i, 1);
      } else {
        p.vel.y -= 9.8 * dt * 0.65;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.rotation.x += dt * 5;
        p.mesh.rotation.y += dt * 4;
      }
    }

    if (camRig.mode === 'follow') {
      camRig.target.copy(partyCurrentPos).add(new THREE.Vector3(0, 1.4, 0));
    } else if (camRig.mode === 'orbit') {
      camRig.desiredSpherical.theta += dt * 0.22;
    }

    camRig.currentTarget.lerp(camRig.target, Math.min(1, dt * 5));
    camRig.spherical.radius += (camRig.desiredSpherical.radius - camRig.spherical.radius) * Math.min(1, dt * 6);
    camRig.spherical.theta += (camRig.desiredSpherical.theta - camRig.spherical.theta) * Math.min(1, dt * 6);
    camRig.spherical.phi += (camRig.desiredSpherical.phi - camRig.spherical.phi) * Math.min(1, dt * 6);

    const r = camRig.spherical.radius;
    const phi = camRig.spherical.phi;
    const theta = camRig.spherical.theta;

    camera.position.x = camRig.currentTarget.x + r * Math.sin(phi) * Math.sin(theta);
    camera.position.y = camRig.currentTarget.y + r * Math.cos(phi);
    camera.position.z = camRig.currentTarget.z + r * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(camRig.currentTarget);

    renderer.render(scene, camera);
  }

  window.Mishland3D = {
    init: init,
    syncWithGameState: syncWithGameState,
    setCameraMode: setCameraMode,
    triggerConfettiExplosion: triggerConfettiExplosion,
    triggerPhysicalImpulse: triggerPhysicalImpulse,
    kickSoccerBall: kickSoccerBall,
    triggerBarToast: function () {
      spawnBeerFoamBurst(24);
      if (locationObjects.bar) {
        locationObjects.bar.velY = 5.0;
        locationObjects.bar.wobbleAmp = 0.18;
      }
    },
    triggerBanyaSteam: function () {
      spawnBanyaSteamBurst(22);
      if (locationObjects.banya) {
        locationObjects.banya.velY = 4.8;
        locationObjects.banya.wobbleAmp = 0.18;
      }
    }
  };
})();
