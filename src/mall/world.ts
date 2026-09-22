import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { drawFace, initialPose, movePose, type Expression } from '../face';
import { easeGaze, getAttention } from '../attention';
import { visitors, type VisitorId, type MallPhase } from './visitors';
import { routeToStore, type StoreDestination, type FloorPoint } from './navigation';
export type MallInput = { destination?: { store: StoreDestination; requestId: number }; qrUrl?: string; expression: Expression; paused: boolean; selected: VisitorId | null; cameraReset: number; visible: boolean; cameraMode: 'story' | 'explore' | 'firstPerson' | 'conversation' };
export type MallEvent = { phase: MallPhase; visitor: VisitorId | null };
export function createMall(host: HTMLDivElement, input: { current: MallInput }, onEvent: (event: MallEvent) => void, onSelect: (id: VisitorId) => void, onError: () => void, onExplore: () => void) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#e9edf0'); scene.fog = new THREE.Fog('#e9edf0', 38, 75);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.domElement.setAttribute('aria-label', 'Valley Fair inspired two-level atrium with glass balconies, real store names, walking visitors and Ruru');
  renderer.domElement.setAttribute('role', 'img'); host.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 120);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .07;
  controls.minDistance = 6; controls.maxDistance = 40; controls.maxPolarAngle = Math.PI * .455; controls.minPolarAngle = .2;
  controls.enablePan = false;
  function resetCamera() { camera.position.set(9, 15, 25); controls.target.set(0, .2, -1.3); controls.update(); }
  resetCamera();
  const handleExplore = () => onExplore();
  controls.addEventListener('start', handleExplore);
  scene.add(new THREE.HemisphereLight('#ffffff', '#a8b4b9', 2.1));
  const sun = new THREE.DirectionalLight('#fffaf1', 2.3); sun.position.set(-7, 17, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -17; sun.shadow.camera.right = 17; sun.shadow.camera.top = 17; sun.shadow.camera.bottom = -17; sun.shadow.normalBias = .025; sun.shadow.bias = -.00008; scene.add(sun);
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  function mat(color: string, roughness = .75) { const key = color + roughness; if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness })); return mats.get(key)!; }
  function box(parent: THREE.Object3D, size: [number, number, number], pos: [number, number, number], color: string, round = 0) {
    const geometry = round ? new RoundedBoxGeometry(...size, 2, round) : new THREE.BoxGeometry(...size);
    const mesh = new THREE.Mesh(geometry, mat(color)); mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function sphere(parent: THREE.Object3D, radius: number, pos: [number, number, number], color: string, scale?: [number, number, number]) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), mat(color)); mesh.position.set(...pos); if (scale) mesh.scale.set(...scale); mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  function cylinder(parent: THREE.Object3D, top: number, bottom: number, height: number, pos: [number, number, number], color: string) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 24), mat(color)); mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  const textures: THREE.Texture[] = [];
  function label(text: string, width: number, height: number, color: string, background?: string) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = Math.round(1024 * height / width);
    const ctx = canvas.getContext('2d')!;
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.fillStyle = color; ctx.font = `500 ${Math.floor(canvas.height * .51)}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width * .92);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: !background, side: THREE.DoubleSide })); return mesh;
  }
  // Stylized Valley Fair atrium: the real mall's pale diamond flooring, glass
  // galleries and skylight structure, composed as a cutaway rather than a map.
  box(scene, [24, .45, 20], [0, -.3, -.8], '#cecac3', .15);
  box(scene, [23.8, .1, 19.8], [0, -.035, -.8], '#ecebe7');
  const vertices: number[] = [], tileColors: number[] = [];
  const tilePalette = ['#f4f3ee', '#d5d2cc', '#bdbab3', '#e7e4df'].map(c => new THREE.Color(c));
  for (let x = -11; x <= 10; x += 1.2) for (let z = -9.7; z <= 7.9; z += 1.2) {
    const color = tilePalette[(Math.round((x + 11) / 1.2) + Math.round((z + 9.7) / 1.2)) % 4];
    const diamond = [[x, z + .6], [x + .6, z], [x + 1.2, z + .6], [x + .6, z + 1.2]];
    for (const i of [0, 2, 1, 0, 3, 2]) { vertices.push(diamond[i][0], .023, diamond[i][1]); tileColors.push(color.r, color.g, color.b); }
  }
  const tileGeometry = new THREE.BufferGeometry();
  tileGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  tileGeometry.setAttribute('color', new THREE.Float32BufferAttribute(tileColors, 3)); tileGeometry.computeVertexNormals();
  const tiles = new THREE.Mesh(tileGeometry, new THREE.MeshStandardMaterial({vertexColors:true, roughness:.48})); tiles.receiveShadow = true; scene.add(tiles);
  const floorMark = label('WESTFIELD  /  VALLEY FAIR', 5.3, .27, '#8a8986'); floorMark.rotation.x = -Math.PI / 2; floorMark.position.set(0, .04, 7.4); scene.add(floorMark);

  function store(x: number, name: string, accent: string, kind: 'clothes' | 'tech' | 'beauty') {
    const shop = new THREE.Group(); shop.position.set(x, 0, -7.5); scene.add(shop);
    box(shop, [6.6, .12, 4.6], [0, .04, 0], '#d2c2ab');
    box(shop, [6.65, 4.35, .2], [0, 2.2, -2.2], '#eeeae3');
    box(shop, [.2, 4.35, 4.55], [-3.3, 2.2, 0], '#f4f3f0'); box(shop, [.2, 4.35, 4.55], [3.3, 2.2, 0], '#f4f3f0');
    box(shop, [6.9, .85, .3], [0, 3.8, 2.2], accent, .03);
    const sign = label(name, 5.6, .61, name === 'lululemon' ? '#ffffff' : '#343332'); sign.position.set(0, 3.8, 2.36); shop.add(sign);
    box(shop, [6.8, .14, 4.7], [0, 4.32, 0], '#fafaf7');
    for (const side of [-1, 1]) {
      box(shop, [.11, 3.3, .16], [side * 3.15, 1.68, 2.23], '#aca797');
      box(shop, [.08, 3.3, .1], [side * 1.15, 1.68, 2.23], '#b8b5a7');
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 3.18), new THREE.MeshPhysicalMaterial({ color: '#b8d3c7', transparent: true, opacity: .12, roughness: .12, side: THREE.DoubleSide, depthWrite: false })); pane.position.set(side * 2.15, 1.67, 2.26); shop.add(pane);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(6, .025, .16), new THREE.MeshBasicMaterial({ color: '#fff1c1' })); beam.position.set(0, 3.34, 1.98); shop.add(beam);
    if (kind === 'clothes') {
      for (const rackX of [-2.05, 2.05]) {
        box(shop, [.07, 2, .07], [rackX - .7, 1.1, -.45], '#63594f'); box(shop, [.07, 2, .07], [rackX + .7, 1.1, -.45], '#63594f'); box(shop, [1.6, .06, .06], [rackX, 2.1, -.45], '#63594f');
        for (let i = 0; i < 5; i++) {
          const shirt = box(shop, [.23, .65, .28], [rackX - .56 + i * .28, 1.69, -.45], ['#877f91', '#d2b99d', '#677c71', '#e7dccc', '#a77270'][i], .04); shirt.rotation.z = .05;
        }
      }
      box(shop, [2.6, .85, .9], [0, .5, -1.4], '#baa388', .05);
      for (let i = 0; i < 3; i++) box(shop, [.55, .13, .5], [-.7 + i * .7, .99, -1.4], '#e8d3c1', .025);
      const poster = label('lululemon  /  Valley Fair', 4.9, .4, '#786758'); poster.position.set(0, 2.9, -2.07); shop.add(poster);
    } else if (kind === 'tech') {
      for (const z of [-.9, .8]) {
        box(shop, [4.6, .13, .9], [0, .93, z], '#c8a27b', .025);
        for (const side of [-1,1]) box(shop, [.12, .9, .7], [side*1.8, .47, z], '#c8a27b');
        for (let i=0;i<4;i++) {
          box(shop, [.6, .025, .38], [-1.5+i, 1.02, z], '#b6b8ba', .01);
          const screen = box(shop, [.56, .4, .025], [-1.5+i, 1.22, z-.16], '#334e60', .01); screen.rotation.x = -.18;
        }
      }
      const poster=label('Apple',3, .7,'#404448');poster.position.set(0,2.7,-2.08);shop.add(poster);
    } else {
      box(shop,[5.6,2.4,.35],[0,1.6,-1.92],'#b69775',.025);
      for (let row=0;row<3;row++) {
        box(shop,[5.7,.07,.46],[0,.95+row*.68,-1.68],'#dfc9aa');
        for (let i=0;i<16;i++) cylinder(shop,.045,.045,.23,[-2.5+i*.33,1.11+row*.68,-1.63], i%4===0?'#f2e8d0':'#61462f');
      }
      box(shop,[3.7,.95,.85],[0,.52,.5],'#ccbba3',.06);
      for (let i=0;i<7;i++) cylinder(shop,.06,.06,.2,[-1.2+i*.4,1.11,.5],'#59412d');
    }
  }

  function plant(x: number, z: number, size = 1) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(size); scene.add(group);
    cylinder(group, .49, .34, .67, [0, .34, 0], '#ccbea4'); cylinder(group, .43, .43, .04, [0, .68, 0], '#635a46');
    cylinder(group, .065, .09, 1.65, [0, 1.32, 0], '#857553');
    for (let i = 0; i < 7; i++) { const angle = i * 2.4; const leaf = sphere(group, .45, [Math.sin(angle) * .4, 1.8 + (i % 3) * .3, Math.cos(angle) * .4], ['#91a875', '#728e62', '#a4b886'][i % 3], [1, .7, .9]); leaf.rotation.z = angle; }
  }
  store(-7, 'Apple', '#e8e9e8', 'tech'); store(0, 'lululemon', '#343333', 'clothes'); store(7, 'Aēsop', '#e5dccd', 'beauty');
  // A second-storey gallery and glass balustrades establish the interior scale.
  box(scene,[24,.3,4.8],[0,4.55,-7.4],'#faf9f5',.04);
  box(scene,[24,.10,.16],[0,4.38,-4.98],'#ded7c9');
  const glass = new THREE.MeshPhysicalMaterial({color:'#c5dce1',transparent:true,opacity:.2,roughness:.06,side:THREE.DoubleSide,depthWrite:false});
  function railing(x:number,z:number,width:number,rotate=false) {
    const rail=new THREE.Group();rail.position.set(x,4.74,z);if(rotate)rail.rotation.y=Math.PI/2;scene.add(rail);
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(width,1.1),glass);pane.position.y=.56;rail.add(pane);
    box(rail,[width,.045,.07],[0,1.14,0],'#bbbcb9');
    for(let i=0;i<=width;i+=2)box(rail,[.028,1.08,.045],[-width/2+i,.55,0],'#c2c2ba');
  }
  railing(0,-4.94,24);
  for(const x of [-11.35,11.35]) {
    box(scene,[1.3,.28,12],[x,4.55,1],'#fbfaf7');railing(x+(x<0?.65:-.65),1,12,true);
    for(const z of [-4.9,5.8])box(scene,[.28,8,.28],[x,4,z],'#efeeeb',.035);
  }
  for(const [x,name] of [[-7,'NORDSTROM'],[0,'EATALY'],[7,'BLOOMINGDALE’S']] as const) {
    box(scene,[6.7,2.65,.15],[x,6.12,-9.55],'#dbd7d0');
    box(scene,[6.55,2.1,.1],[x,5.93,-9.42],x===0?'#b29b7d':'#535756');
    const sign=label(name,5.4,.39,'#faf9f2');sign.position.set(x,7.05,-9.34);scene.add(sign);
    for(const dx of [-2.1,0,2.1])box(scene,[.055,2.15,.09],[x+dx,5.97,-9.3],'#babcb5');
  }
  // White oculus ribs suggest Valley Fair's skylight without a solid roof hiding Ruru.
  const oculus = new THREE.Mesh(new THREE.TorusGeometry(5.8,.13,8,64),mat('#fafafa'));
  oculus.rotation.x=Math.PI/2;oculus.scale.set(1.6,1,1);oculus.position.set(0,8.2,-3);scene.add(oculus);
  const innerOculus=oculus.clone();innerOculus.scale.set(1.48,.87,1);innerOculus.position.y=8.26;scene.add(innerOculus);
  for(let i=-3;i<=3;i++)box(scene,[.065,.085,4.8],[i*2.45,8.23,-5.1],'#d8e0e1');
  box(scene,[24,.22,.6],[0,7.65,-9.65],'#f9faf8');
  const westfield=label('Westfield',4.8,.8,'#b23238');westfield.position.set(0,6.55,-4.81);scene.add(westfield);
  const valley=label('V A L L E Y   F A I R',4.7,.32,'#45494a');valley.position.set(0,6.04,-4.8);scene.add(valley);
  box(scene,[5.4,1.6,.12],[0,6.45,-4.92],'#f7f5ee',.045);
  function escalator(x:number,z:number) {
    const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
    const length=6.7,height=4.5,angle=Math.atan2(height,length),span=Math.hypot(height,length);
    for(let i=0;i<22;i++)box(group,[1.4,.16,length/22+.035],[0,.14+i*height/22, -i*length/22],'#8b9395');
    for(const side of [-1,1]) {
      const flank=box(group,[.12,.62,span],[side*.8,height/2+.45,-length/2],'#ced7d8');flank.rotation.x=angle;
      const rail=box(group,[.14,.1,span],[side*.8,height/2+.86,-length/2],'#444a4b',.025);rail.rotation.x=angle;
    }
  }
  escalator(9.5,2.1);
  function bench(x:number,z:number) {
    box(scene,[2.8,.25,.9],[x,.57,z],'#b08e68',.10);
    for(const dx of [-1,1])box(scene,[.2,.44,.65],[x+dx,.26,z],'#bcb8ae');
  }
  bench(-8,3.6);bench(7.7,5.3);plant(-9.2,5.3,1.1);plant(9.2,6.5,1.1);plant(-10.5,-3.4,1.2);
  // Mall name and directory are landmarks, not a claim of an exact floorplan.
  box(scene,[1.3,2.5,.18],[-8.8,1.25,-.8],'#333b3b',.05);
  const directory=label('VALLEY FAIR',1.12,.19,'#faf9f2');directory.position.set(-8.8,2.18,-.69);scene.add(directory);
  for(const [i,name] of ['lululemon','Apple','Aēsop','Dining & cafés'].entries()) {const line=label(name,1.02,.13,'#dbded9');line.position.set(-8.8,1.76-i*.29,-.69);scene.add(line);}
  box(scene,[1.05,1.9,.13],[3.7,1.16,-3.7],'#363d38',.04);
  const board=label('MEET RURU',.91,.23,'#f8f3df');board.position.set(3.7,1.8,-3.62);scene.add(board);
  const board2=label('your mall companion',.87,.12,'#dedbc7');board2.position.set(3.7,1.3,-3.62);scene.add(board2);

  type Person = { root: THREE.Group; legs: THREE.Group[]; arms: THREE.Group[]; phase: number; data: typeof visitors[number] | null; baseX: number; baseZ: number };
  const people: Person[] = []; const pickable: THREE.Object3D[] = [];
  function person(x: number, z: number, color: string, skin: string, hair: string, index: number, data: typeof visitors[number] | null = null) {
    const root = new THREE.Group(); root.position.set(x, 0, z); scene.add(root);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.24, .45, 4, 12), mat(color)); torso.position.y = 1.18; torso.castShadow = true; root.add(torso);
    sphere(root, .24, [0, 1.82, 0], skin, [.92, 1.08, .95]);
    sphere(root, .244, [0, 1.93, -.04], hair, [1, .72, 1]);
    sphere(root, .046, [0, 1.8, .23], skin);
    for (const side of [-1, 1]) sphere(root, .018, [side * .075, 1.88, .213], '#34332e');
    box(root, [.065, .018, .018], [0, 1.72, .214], '#80584b', .007);
    const legs: THREE.Group[] = [], arms: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * .14, .88, 0); root.add(leg); legs.push(leg);
      box(leg, [.18, .65, .2], [0, -.32, 0], '#555e56', .05); box(leg, [.23, .15, .35], [0, -.71, .05], '#fff7e5', .04);
      const arm = new THREE.Group(); arm.position.set(side * .32, 1.4, 0); root.add(arm); arms.push(arm);
      box(arm, [.15, .46, .17], [0, -.2, 0], color, .05); sphere(arm, .095, [0, -.49, 0], skin);
    }
    if (index % 2 === 0) { box(root, [.34, .46, .15], [0, 1.2, -.29], '#ddbc84', .06); }
    if (data) { root.traverse(child => { child.userData.visitor = data.id; if (child instanceof THREE.Mesh) pickable.push(child); }); }
    const p = { root, legs, arms, phase: index * 1.7, data, baseX: x, baseZ: z }; people.push(p); return p;
  }
  visitors.forEach((v, i) => person(v.x, v.z, v.color, v.skin, v.hair, i, v));
  person(-7, -2.8, '#b6a37c', '#b98560', '#493d34', 3); person(6.6, -2.1, '#93a17e', '#d4a17a', '#473129', 4); person(-5.8, 6, '#9ea9bd', '#805b41', '#242a29', 5); person(6.3, 6.2, '#c19275', '#e5bb96', '#625244', 6);

  // Compact armless robot: expressive display, articulated neck and two rubber tracks.
  const lulu = new THREE.Group(); lulu.position.set(0, 0, 3.4); scene.add(lulu);
  const chassis = new THREE.Group(); lulu.add(chassis);
  box(chassis, [1.12, .78, .85], [0, .79, 0], '#dcc18a', .14);
  box(chassis, [1.02, .13, .8], [0, 1.16, 0], '#f2dfb3', .055);
  box(chassis, [.91, .39, .035], [0, .83, .444], '#efe1bf', .04);
  const badge = label('ruru', .46, .18, '#766644'); badge.position.set(0, .85, .467); chassis.add(badge);
  box(chassis, [1.12, .12, .12], [0, .49, .45], '#6e7161', .035);
  for (const side of [-1, 1]) sphere(chassis, .045, [side * .38, .61, .462], '#e8f3c5');
  for (let i = 0; i < 4; i++) box(chassis, [.5, .024, .025], [0, .76 + i * .075, -.44], '#a48e65', .008);
  cylinder(chassis, .11, .14, .27, [0, 1.32, 0], '#697361');
  const neckJoint = cylinder(chassis, .14, .14, .44, [0, 1.39, 0], '#a3ac92'); neckJoint.rotation.z = Math.PI / 2;
  const trackSides: { side: number; wheels: THREE.Mesh[]; treads: THREE.Mesh[]; phase: number }[] = [];
  for (const side of [-1, 1]) {
    const x = side * .66;
    box(chassis, [.33, .51, 1.24], [x, .3, 0], '#424a41', .23);
    const wheels: THREE.Mesh[] = [];
    for (const z of [-.35, 0, .35]) {
      const wheel = cylinder(chassis, .18, .18, .035, [x + side * .185, .3, z], '#939b82'); wheel.rotation.z = Math.PI / 2; wheels.push(wheel);
      const hub = cylinder(chassis, .065, .065, .045, [x + side * .21, .3, z], '#ddd1ad'); hub.rotation.z = Math.PI / 2;
      box(wheel, [.27, .04, .04], [0, side * .023, 0], '#5b6454', .012);
    }
    const treads = Array.from({ length: 24 }, () => box(chassis, [.37, .065, .11], [x, .3, 0], '#58604f', .015));
    trackSides.push({ side, wheels, treads, phase: 0 });
  }
  const screen = new THREE.Group(); screen.position.y = 1.78; lulu.add(screen);
  box(screen, [1.68, 1.12, .34], [0, 0, -.08], '#d8b77b', .13);
  box(screen, [1.56, 1, .03], [0, 0, .1], '#25352e', .1);
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 400;
  const faceCtx = canvas.getContext('2d')!; const faceTexture = new THREE.CanvasTexture(canvas); faceTexture.colorSpace = THREE.SRGBColorSpace; textures.push(faceTexture);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.42, .8875), new THREE.MeshBasicMaterial({ map: faceTexture, toneMapped: false })); face.position.z = .12; screen.add(face);
  sphere(screen, .019, [0, -.49, .121], '#dcf6bd');
  const luluShadow = new THREE.Mesh(new THREE.CircleGeometry(.87, 32), new THREE.MeshBasicMaterial({ color: '#648061', transparent: true, opacity: .14, depthWrite: false })); luluShadow.rotation.x = -Math.PI / 2; luluShadow.position.y = .055; lulu.add(luluShadow);
  const luluTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const mesh = label('RURU', 1, .32, '#526744', '#f6f3e7'); const material = mesh.material as THREE.MeshBasicMaterial; const texture = material.map!; mesh.geometry.dispose(); material.dispose(); return texture; })(), depthTest: false })); luluTag.scale.set(1, .32, 1); luluTag.position.y = 2.56; lulu.add(luluTag);
  const selectedRing = new THREE.Mesh(new THREE.RingGeometry(.48, .53, 40), new THREE.MeshBasicMaterial({ color: '#ba7663', side: THREE.DoubleSide })); selectedRing.rotation.x = -Math.PI / 2; selectedRing.position.y = .06; selectedRing.visible = false; scene.add(selectedRing);

  const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let down = { x: 0, y: 0 };
  function pointerDown(event: PointerEvent) { down = { x: event.clientX, y: event.clientY }; }
  function pointerUp(event: PointerEvent) {
    if (input.current.cameraMode === 'conversation') return;
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) return;
    const bounds = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera); const hits = raycaster.intersectObjects(pickable, false);
    if (hits[0]?.object.userData.visitor) onSelect(hits[0].object.userData.visitor as VisitorId);
  }
  renderer.domElement.addEventListener('pointerdown', pointerDown); renderer.domElement.addEventListener('pointerup', pointerUp);
  function contextLost(event: Event) { event.preventDefault(); renderer.setAnimationLoop(null); onError(); }
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  const resize = new ResizeObserver(() => { const { width, height } = host.getBoundingClientRect(); if (width < 1 || height < 1) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); }); resize.observe(host);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let previousCameraMode: MallInput['cameraMode'] = 'story';
  const roamingPosition = new THREE.Vector3(); let roamingHeading = 0;
  const cameraGaze = { x: 0, y: 0 };
  const eyePosition = new THREE.Vector3(), eyeForward = new THREE.Vector3();
  const pose = initialPose(); let last = performance.now(), elapsed = 0, phaseTime = 0, roamingIndex = 0, phase: MallPhase = 'roaming', currentVisitor: VisitorId | null = null, explicitSelection: VisitorId | null = null, oldReset = 0, stopped = false;
  let navigationCommand: MallInput['destination'];
  let navigationPath: FloorPoint[] = [];
  let navigationStep = 0;
  const route = [new THREE.Vector3(-3.5, 0, 1.7), new THREE.Vector3(3.8, 0, 2.4), new THREE.Vector3(-.4, 0, 4.4)];
  function emit(next: MallPhase, visitor: VisitorId | null) { phase = next; phaseTime = 0; currentVisitor = visitor; onEvent({ phase, visitor }); host.dataset.phase = phase; host.dataset.visitor = visitor ?? ''; }
  function animate(now: number) {
    if (stopped) return;
    if (!input.current.visible || document.hidden) { last = now; return; }
    if (now - last < 1000 / 30) return;
    const dt = Math.min((now - last) / 1000, .1); last = now;
    const conversation = input.current.cameraMode === 'conversation';
    const firstPerson = input.current.cameraMode === 'firstPerson';
    if (input.current.cameraMode !== previousCameraMode) {
      if (conversation) { roamingPosition.copy(lulu.position); roamingHeading = lulu.rotation.y; lulu.position.set(0, 0, 6.5); }
      else if (previousCameraMode === 'conversation' && !input.current.destination) { lulu.position.copy(roamingPosition); lulu.rotation.y = roamingHeading; }
      if (firstPerson) { controls.enableDamping = false; controls.update(); controls.enableDamping = true; controls.saveState(); }
      else if (previousCameraMode === 'firstPerson') controls.reset();
      controls.enabled = !firstPerson && !conversation; lulu.visible = !firstPerson;
      camera.fov = firstPerson ? 65 : 40; camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate = true; previousCameraMode = input.current.cameraMode;
    }
    if (input.current.cameraReset !== oldReset) { oldReset = input.current.cameraReset; resetCamera(); }
    const commanded = input.current.destination;
    if (commanded?.requestId !== navigationCommand?.requestId || commanded?.store !== navigationCommand?.store) {
      navigationCommand = commanded;
      navigationPath = commanded ? routeToStore(lulu.position, commanded.store) : [];
      navigationStep = 0;
      host.dataset.destination = commanded?.store ?? '';
      host.dataset.navigationState = commanded ? (navigationPath.length ? 'walking' : 'blocked') : '';
      emit('roaming', null);
    }
    if (!commanded && input.current.selected !== explicitSelection) {
      explicitSelection = input.current.selected;
      if (explicitSelection) emit('approaching', explicitSelection); else emit('roaming', null);
    }
    const active = !input.current.paused && !conversation;
    const follow = input.current.cameraMode === 'story' && !reduced;
    if (active) { elapsed += dt; phaseTime += dt; }
    const targetPerson = currentVisitor ? people.find(p => p.data?.id === currentVisitor) : undefined;
    people.forEach(p => {
      const engaged = p === targetPerson && phase !== 'roaming';
      if (active && !engaged) {
        const t = elapsed * .2 + p.phase; const newX = p.baseX + Math.sin(t) * .85, newZ = p.baseZ + Math.cos(t * .8) * .58;
        const dirX = newX - p.root.position.x, dirZ = newZ - p.root.position.z;
        if (Math.hypot(dirX, dirZ) > .0001) p.root.rotation.y = Math.atan2(dirX, dirZ);
        p.root.position.set(newX, 0, newZ);
      }
      if (engaged) p.root.rotation.y = Math.atan2(lulu.position.x - p.root.position.x, lulu.position.z - p.root.position.z);
      const stride = active && !engaged ? Math.sin(elapsed * 5 + p.phase) * .35 : 0;
      p.legs[0].rotation.x = stride; p.legs[1].rotation.x = -stride; p.arms[0].rotation.x = -stride * .65; p.arms[1].rotation.x = stride * .65;
    });
    let destination = route[roamingIndex % route.length].clone();
    if (targetPerson) destination = targetPerson.root.position.clone().add(new THREE.Vector3(.85, 0, -1.15));
    if (commanded) {
      const waypoint = navigationPath[navigationStep];
      destination = waypoint ? new THREE.Vector3(waypoint.x, 0, waypoint.z) : lulu.position.clone();
    }
    const direction = destination.sub(lulu.position); direction.y = 0; const distance = direction.length();
    const previousPosition = lulu.position.clone();
    const previousHeading = lulu.rotation.y;
    if (active && phase !== 'greeting') {
      if (distance > (commanded ? .01 : .08)) {
        const desired = Math.atan2(direction.x, direction.z);
        const headingError = Math.atan2(Math.sin(desired - lulu.rotation.y), Math.cos(desired - lulu.rotation.y));
        const speed = Math.min(1.5, distance * 2.3) * Math.max(0, Math.cos(headingError));
        lulu.position.add(direction.normalize().multiplyScalar(Math.min(distance, dt * speed)));
        lulu.rotation.y += Math.atan2(Math.sin(desired - lulu.rotation.y), Math.cos(desired - lulu.rotation.y)) * Math.min(1, dt * 5);
      } else if (commanded) {
        if (navigationStep < navigationPath.length) navigationStep++;
        if (navigationPath.length && navigationStep === navigationPath.length) {
          if (host.dataset.navigationState !== 'arrived') {
            host.dataset.navigationState = 'arrived';
            host.dispatchEvent(new CustomEvent('lulu-arrived', { bubbles: true, detail: { store: commanded.store, requestId: commanded.requestId } }));
          }
          // Face the storefront after stopping at its entrance.
          lulu.rotation.y += Math.atan2(Math.sin(Math.PI - lulu.rotation.y), Math.cos(Math.PI - lulu.rotation.y)) * Math.min(1, dt * 5);
        }
      } else if (phase === 'approaching') {
        emit('greeting', currentVisitor);
      } else {
        emit('approaching', visitors[roamingIndex % visitors.length].id);
      }
    }
    if (active && phase === 'greeting' && targetPerson) {
      const desired = Math.atan2(targetPerson.root.position.x - lulu.position.x, targetPerson.root.position.z - lulu.position.z);
      lulu.rotation.y += Math.atan2(Math.sin(desired - lulu.rotation.y), Math.cos(desired - lulu.rotation.y)) * Math.min(1, dt * 5);
      if (phaseTime > 13 && !explicitSelection) { roamingIndex++; emit('roaming', null); }
    }
    const travelled = lulu.position.distanceTo(previousPosition);
    const turned = lulu.rotation.y - previousHeading;
    for (const track of trackSides) {
      const rotation = (travelled + track.side * turned * .66) / .3;
      track.phase += rotation;
      track.wheels.forEach(wheel => wheel.rotateY(rotation));
      track.treads.forEach((tread, index) => {
        const angle = index / track.treads.length * Math.PI * 2 + track.phase;
        tread.position.set(track.side * .66, .3 + Math.cos(angle) * .25, Math.sin(angle) * .58);
        tread.rotation.x = Math.atan2(-.25 * Math.sin(angle), .58 * Math.cos(angle));
      });
    }
    // A small head tilt gives listening intent without making the chassis float.
    if (input.current.qrUrl) { screen.rotation.z = 0; screen.rotation.x = 0; }
    else if (!reduced && (active || conversation)) {
      const tilt = input.current.expression === 'listening' ? -.09 : input.current.expression === 'happy' ? .055 : 0;
      screen.rotation.z += (tilt - screen.rotation.z) * Math.min(1, dt * 3);
      screen.rotation.x += ((conversation ? -.04 : phase === 'greeting' ? -.09 : 0) - screen.rotation.x) * Math.min(1, dt * 3);
    }
    selectedRing.visible = !!targetPerson; if (targetPerson) selectedRing.position.set(targetPerson.root.position.x, .06, targetPerson.root.position.z);
    easeGaze(cameraGaze, reduced ? { x: 0, y: 0 } : getAttention() ?? { x: input.current.expression === 'listening' ? .18 : input.current.expression === 'thinking' ? -.25 : 0, y: input.current.expression === 'thinking' ? -.12 : 0 }, dt);
    face.position.z = input.current.qrUrl ? .18 : .12;
    movePose(pose, input.current.expression, dt); drawFace(faceCtx, pose, input.current.expression, now / 1000, cameraGaze, reduced, input.current.qrUrl); host.dataset.screen = input.current.qrUrl ? 'qr' : 'face'; faceTexture.magFilter = input.current.qrUrl ? THREE.NearestFilter : THREE.LinearFilter; faceTexture.minFilter = input.current.qrUrl ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter; faceTexture.needsUpdate = true;
    host.dataset.gazeX = cameraGaze.x.toFixed(3); host.dataset.gazeY = cameraGaze.y.toFixed(3);
    host.dataset.luluX = lulu.position.x.toFixed(3); host.dataset.luluZ = lulu.position.z.toFixed(3); host.dataset.rendered = 'true';
    if (conversation) {
      lulu.rotation.y = 0;
      // The visitor is looking directly at Ruru; leave the bottom of the scene for dialogue.
      const portrait = camera.aspect < 1;
      if (input.current.qrUrl) {
        camera.position.set(lulu.position.x, 1.78, lulu.position.z + (portrait ? 5.7 : 3.2));
        camera.lookAt(lulu.position.x, portrait ? 1.35 : 1.55, lulu.position.z);
      } else {
        camera.position.set(lulu.position.x, 2.45, lulu.position.z + (portrait ? 10 : 7.7));
        camera.lookAt(lulu.position.x, portrait ? -.05 : .3, lulu.position.z);
      }
      renderer.shadowMap.needsUpdate = true;
    } else if (firstPerson) {
      // Body heading keeps the horizon level; facial tilts do not shake the view.
      lulu.updateWorldMatrix(true, false);
      eyePosition.set(0, 1.78, .28).applyMatrix4(lulu.matrixWorld);
      eyeForward.set(Math.sin(lulu.rotation.y), 0, Math.cos(lulu.rotation.y));
      camera.position.copy(eyePosition); camera.up.set(0, 1, 0);
      camera.lookAt(eyePosition.clone().add(eyeForward));
    } else if (follow) {
      const focus = lulu.position.clone();
      if (targetPerson && phase === 'greeting') focus.lerp(targetPerson.root.position, .35);
      focus.y = phase === 'greeting' ? 2.4 : 3.1;
      const distance = phase === 'greeting' ? 1 : 1.2;
      const offset = phase === 'greeting' ? new THREE.Vector3(2.2,5.2,13.4) : new THREE.Vector3(4.5,7.3,17).multiplyScalar(distance / 1.2);
      // Portrait view gets a wider lens so both participants remain visible.
      if (camera.aspect < 1) offset.multiplyScalar(1.45);
      const easing = 1 - Math.exp(-dt * 1.15);
      controls.target.lerp(focus, easing);
      camera.position.lerp(focus.clone().add(offset), easing);
    }
    host.dataset.cameraMode = input.current.cameraMode;
    if (active) renderer.shadowMap.needsUpdate = true;
    if (!firstPerson && !conversation) controls.update();
    const facing = camera.getWorldDirection(new THREE.Vector3());
    host.dataset.cameraX = camera.position.x.toFixed(3); host.dataset.cameraY = camera.position.y.toFixed(3); host.dataset.cameraZ = camera.position.z.toFixed(3);
    host.dataset.cameraForwardX = facing.x.toFixed(3); host.dataset.cameraForwardZ = facing.z.toFixed(3);
    host.dataset.luluHeading = lulu.rotation.y.toFixed(3); host.dataset.robotVisible = String(lulu.visible);
    renderer.render(scene, camera);
  }
  emit('roaming', null); renderer.setAnimationLoop(animate);
  return () => {
    stopped = true; renderer.setAnimationLoop(null); resize.disconnect(); controls.removeEventListener('start', handleExplore); controls.dispose(); renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    scene.traverse(object => { if (object instanceof THREE.Mesh) { geometry.add(object.geometry); const list = Array.isArray(object.material) ? object.material : [object.material]; list.forEach(m => materials.add(m)); } else if (object instanceof THREE.Sprite) materials.add(object.material); });
    geometry.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose(); renderer.domElement.remove();
  };
}
