import * as T from "three";
import { GLTFLoader } from "/addons/loaders/GLTFLoader.js";
import { buildSalon } from "../salong-v1.mjs";
import { buildTable, textiles } from "../../bord/filtdjup-v1/bord.mjs";
import { buildDrawShoe } from "../../../studio/lib/card-shoe.mjs";

export async function compareRooms({cal, layout, shoeLayout}) {
  const renderer = new T.WebGLRenderer({antialias: true});
  renderer.setSize(cal.width, cal.height, false);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  const scene = new T.Scene();
  buildSalon(scene);
  const salon = new T.Group();
  // Lock key, fill and environmental reflections to the original set.
  // The sconces are visible geometry in both rooms.
  for (const object of [...scene.children]) {
    if (!object.isLight) salon.add(object);
  }
  salon.traverse(obj => { if (obj.isLight) obj.visible = false; });
  scene.add(salon);
  const cube = new T.WebGLCubeRenderTarget(128, {type: T.HalfFloatType});
  const probe = new T.CubeCamera(0.02, 25, cube);
  probe.position.set(0, 0.10, 0);
  probe.update(renderer, scene);
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromCubemap(cube.texture);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.48;

  const loader = new GLTFLoader();
  const asset = await loader.loadAsync("/room.glb");
  const room = asset.scene;
  room.traverse(obj => { if (obj.isMesh) obj.receiveShadow = true; });
  scene.add(room);
  scene.updateMatrixWorld(true);
  const cameras = {};
  const checks = {};
  const {shoe, draw} = buildDrawShoe(shoeLayout);
  const pitch = T.MathUtils.degToRad(shoeLayout.feedAngleDegrees);
  const cardHeadY = shoeLayout.cardTopY - (shoeLayout.initialLeadZ - shoeLayout.mouthZ) * Math.tan(pitch);
  const curve = [shoeLayout.cardLength, 0].map(offset => [
    shoeLayout.initialLeadZ - offset * Math.cos(pitch), cardHeadY + offset * Math.sin(pitch)
  ]);
  draw(curve);
  scene.add(shoe);
  const outlet = shoe.localToWorld(new T.Vector3(0, shoeLayout.cardTopY, shoeLayout.mouthZ));
  for (const id of [4, 1]) {
    const ref = cal.cameras[id];
    const camera = new T.PerspectiveCamera(ref.fovVertical, cal.width / cal.height, 0.02, 20);
    camera.position.fromArray(ref.eye);
    camera.lookAt(new T.Vector3(...ref.aim));
    camera.updateMatrixWorld();
    const embedded = asset.cameras.find(c => c.name === 'Seat_' + id + '_camera' || c.name === 'Seat ' + id + ' camera');
    if (!embedded) throw Error("Den inbyggda kameran för stol " + id + " saknas.");
    const rotationError = embedded.getWorldDirection(new T.Vector3()).angleTo(camera.getWorldDirection(new T.Vector3()));
    const eyeError = embedded.getWorldPosition(new T.Vector3()).distanceTo(camera.position);
    if (eyeError > 0.00001 || rotationError > 0.00001 || Math.abs(embedded.fov - camera.fov) > 0.0001)
      throw Error("Kameran i GLB-filen avviker från bordsprovet.");
    const targets = {mynning: outlet, kortmål: new T.Vector3(...cal.points.kortmal), dealer: new T.Vector3(0, .45, -.35)};
    for (const [name, target] of Object.entries(targets)) {
      const delta = target.clone().sub(camera.position);
      const ray = new T.Raycaster(camera.position, delta.clone().normalize(), 0.001, delta.length() - .001);
      if (ray.intersectObject(room, true).length) throw Error("Rummet skymmer " + name + " från stol " + id);
    }
    checks[id] = {eyeErrorMetres: eyeError, directionErrorRadians: rotationError, unoccluded: Object.keys(targets)};
    cameras[id] = camera;
  }
  const floorRay = new T.Raycaster(new T.Vector3(0, .01, 0), new T.Vector3(0, -1, 0));
  const floor = floorRay.intersectObject(room, true)[0]?.point.y;
  if (!Number.isFinite(floor) || Math.abs(floor - cal.floorY) > .01) throw Error("Fel golvhöjd i GLB-filen: " + floor);
  const top = new T.OrthographicCamera(-.63, .63, .354375, -.354375, .01, 4);
  top.position.set(.06, 1.6, -.235);
  top.up.set(0, 0, -1);
  top.lookAt(.06, 0, -.235);
  cameras.topp = top;
  const arrow = new T.ArrowHelper(new T.Vector3(0, 0, 1),
    new T.Vector3(0, .042, shoeLayout.initialLeadZ + .009), .118, 0xffd15a, .03, .022);
  shoe.add(arrow);
  const body = (await loader.loadAsync("/dealer.glb")).scene;
  const skin = new T.MeshStandardMaterial({color: 0xc0d2ce, roughness: .90, side: T.DoubleSide});
  body.traverse(m => { if (m.isMesh) { m.geometry.computeVertexNormals(); m.material = skin; m.receiveShadow = m.castShadow = true; } });
  scene.add(body);
  const seatBase = new T.Mesh(new T.BoxGeometry(.32,.045,.27), new T.MeshStandardMaterial({color:0x3b4b45,roughness:.9}));
  seatBase.position.set(layout.dealerSeat.x, cal.floorY+.406-.045/2, layout.dealerSeat.z);
  scene.add(seatBase);
  const cloth = textiles(layout);
  const tables = [buildTable(layout, false, cloth), buildTable(layout, true, cloth)];
  scene.add(...tables);
  scene.updateMatrixWorld(true);
  checks.frigang = {};
  const halfW = shoeLayout.width/2, halfD = shoeLayout.depth/2;
  for (const angle of [shoeLayout.yawDegrees, -45, 0]) {
    shoe.rotation.y = T.MathUtils.degToRad(angle);
    shoe.updateMatrixWorld(true);
    // Enclose the stock and housing. Beyond the opening test the actual
    // thin, inclined card at each extraction frame of the studio rig.
    const envelope = new T.Box3(new T.Vector3(-halfW, 0, -halfD),
      new T.Vector3(halfW, .081, halfD));
    const cardBox = new T.Box3(new T.Vector3(-shoeLayout.cardWidth/2,-shoeLayout.cardThickness/2,-shoeLayout.cardLength/2),
      new T.Vector3(shoeLayout.cardWidth/2,shoeLayout.cardThickness/2,shoeLayout.cardLength/2));
    const samples = Array.from({length:11}, (_,frame) => {
      const t=frame/10, travel=shoeLayout.travel*t*t*(3-2*t);
      const z=shoeLayout.initialLeadZ+travel;
      const y=Math.max(shoeLayout.cardThickness, shoeLayout.cardTopY-(z-shoeLayout.mouthZ)*Math.tan(pitch));
      const position=new T.Vector3(0,y-shoeLayout.cardThickness+shoeLayout.cardLength*Math.sin(pitch)/2
        +shoeLayout.cardThickness*Math.cos(pitch)/2,z-shoeLayout.cardLength*Math.cos(pitch)/2);
      return new T.Matrix4().makeRotationX(pitch).setPosition(position).invert();
    });
    let triangles = 0, hits = 0, cardHits=0;
    const tri = new T.Triangle(), cardTri = new T.Triangle();
    body.traverse(mesh => {
      if (!mesh.isMesh) return;
      const intoShoe = shoe.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
      const points = mesh.geometry.attributes.position, indices = mesh.geometry.index;
      const n = indices ? indices.count : points.count;
      for (let k=0; k<n; k+=3) {
        [tri.a,tri.b,tri.c].forEach((p,i) => p.fromBufferAttribute(points, indices ? indices.getX(k+i) : k+i).applyMatrix4(intoShoe));
        if (envelope.intersectsTriangle(tri)) hits++;
        if (Math.min(tri.a.x,tri.b.x,tri.c.x)<=halfW && Math.max(tri.a.x,tri.b.x,tri.c.x)>=-halfW)
          for (const inverse of samples) {
            cardTri.copy(tri);
            for (const point of [cardTri.a,cardTri.b,cardTri.c]) point.applyMatrix4(inverse);
            if (cardBox.intersectsTriangle(cardTri)) cardHits++;
          }
        triangles++;
      }
    });
    if (hits || cardHits) throw Error("Sittmodellen skär skons omslutning eller kortet vid " + angle + "°: " + hits + " / " + cardHits);
    for (const table of tables) for (const x of [-halfW,0,halfW]) for (const z of [-halfD,0,halfD]) {
      const point = shoe.localToWorld(new T.Vector3(x,.12,z));
      const ray = new T.Raycaster(point, new T.Vector3(0,-1,0));
      const surface = ray.intersectObject(table,true).find(hit => hit.object.isMesh)?.point.y;
      if (!Number.isFinite(surface) || Math.abs(surface) > .0001) throw Error("Sko mot filt: vinkel " + angle + ", höjd " + surface + ", XYZ " + point.toArray());
    }
    checks.frigang[angle] = {triangles, hits, cardHits};
  }
  const photos = {};
  for (const place of ["kasinorum", "salong"]) {
    room.visible = place === "kasinorum";
    salon.visible = !room.visible;
    for (const depth of [108, 96]) {
      tables[0].visible = depth === 108;
      tables[1].visible = !tables[0].visible;
      for (const present of [1, 0]) {
        body.visible = Boolean(present);
        seatBase.visible = body.visible;
        for (const angle of [shoeLayout.yawDegrees, -45, 0]) {
          shoe.rotation.y = T.MathUtils.degToRad(angle);
          for (const seat of [4, 1, "topp"]) {
            arrow.visible = seat === "topp";
            renderer.render(scene, cameras[seat]);
            photos[[place, depth, present, angle, seat].join("/")] = renderer.domElement.toDataURL("image/webp", .89);
          }
        }
      }
    }
  }
  environment.dispose();
  pmrem.dispose();
  cube.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return {photos, checks, floor};
}
