import * as T from "three";

// Metres, Y up. The subject looks along +Z; anatomical left is +X.
const vector = (x, y, z) => new T.Vector3(x, y, z);
const up = vector(0, 1, 0);
const sphere = new T.SphereGeometry(1, 40, 28);

function canvasTexture(width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"), width, height);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const grain = canvasTexture(512, 512, (ctx, width, height) => {
  const pixels = ctx.createImageData(width, height);
  let seed = 273201;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const u = x * 2 * Math.PI / width;
    const v = y * 2 * Math.PI / height;
    const flow = u + .023 * Math.sin(2 * v + Math.sin(3 * u)) + .009 * Math.sin(4 * v - 2 * u);
    const grainLine = Math.pow((1 + Math.cos(24 * flow + 2 * Math.sin(5 * u))) / 2, 6);
    const tint = 4.5 * Math.sin(8 * flow) - 8 * grainLine + 2 * Math.cos(115 * flow) + 2.5 * (seed / 4294967296 - .5);
    const i = 4 * (y * width + x);
    pixels.data.set([220 + tint, 173 + tint, 122 + tint, 255], i);
  }
  ctx.putImageData(pixels, 0, 0);
});

const surface = (color, roughness = .62, extra = {}) => new T.MeshStandardMaterial({color, roughness, ...extra});
const maple = surface(0xffffff, .46, {map: grain});
const endGrain = surface(0xd3b393, .55, {map: grain});
const peg = surface(0x967b5c, .52);
const felt = surface(0x829b8c, .96);
const walnut = surface(0x634e3e, .55, {map: grain});
const chairFabric = surface(0x60786c, .95);
const paper = surface(0xf2eee6, .85);

function attach(parent, geometry, material, position) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function ball(parent, position, x, y, z, material = endGrain) {
  const mesh = attach(parent, sphere, material, position);
  mesh.scale.set(x, y, z);
  return mesh;
}
function lathe(points) {
  const curve = new T.SplineCurve(points.map(([r, y]) => new T.Vector2(r, y)));
  return new T.LatheGeometry(curve.getPoints(45).map(p => new T.Vector2(Math.max(0, p.x), p.y)), 54);
}
function carve(parent, position, profile, scaleX, scaleZ, material = maple) {
  const mesh = attach(parent, lathe(profile), material, position);
  mesh.scale.set(scaleX, 1, scaleZ);
  return mesh;
}

// Individual lengths are fitted between the pivots, with the ball showing at each end.
const segmentShape = lathe([[0, 0], [.60, .015], [.89, .08], [1, .25], [.93, .52], [.76, .83], [.67, .965], [.5, .99], [0, 1]]);
function segment(parent, a, b, radius, depth = radius, material = maple, trimA = .06, trimB = .075) {
  const delta = b.clone().sub(a);
  const mesh = attach(parent, segmentShape, material, a.clone().addScaledVector(delta, trimA));
  mesh.quaternion.setFromUnitVectors(up, delta.clone().normalize());
  mesh.scale.set(radius, delta.length() * (1 - trimA - trimB), depth);
  return mesh;
}
function joint(parent, at, radius, side) {
  ball(parent, at, radius, radius, radius);
  if (side) {
    const pin = new T.CylinderGeometry(radius * .30, radius * .30, .0022, 36);
    attach(parent, pin, peg, at.clone().add(vector(side * radius * .947, 0, 0))).rotation.z = Math.PI / 2;
  }
}
function roundedPanel(parent, x, z, thickness, corner, material, position) {
  const shape = new T.Shape();
  const a = x/2, b = z/2, r = corner;
  shape.moveTo(-a + r, -b);
  shape.lineTo(a - r, -b); shape.quadraticCurveTo(a, -b, a, -b+r);
  shape.lineTo(a, b-r); shape.quadraticCurveTo(a, b, a-r, b);
  shape.lineTo(-a+r, b); shape.quadraticCurveTo(-a, b, -a, b-r);
  shape.lineTo(-a, -b+r); shape.quadraticCurveTo(-a, -b, -a+r, -b);
  const geometry = new T.ExtrudeGeometry(shape, {depth: thickness, bevelEnabled: false, curveSegments: 12});
  const group = attach(parent, geometry, material, position);
  group.rotation.x = -Math.PI / 2;
  return group;
}

// Two-way engraved-style back. The cream keylines and suits are integral to the card art.
const back = canvasTexture(420, 588, (ctx, w, h) => {
  ctx.fillStyle = "#f5f0e5";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#913d42";
  ctx.beginPath(); ctx.roundRect(17, 17, w-34, h-34, 13); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(33, 33, w-66, h-66, 7); ctx.clip();
  ctx.strokeStyle = "#c88979"; ctx.lineWidth = 1.8;
  for (let u=-h;u<w+h;u+=20) {
    ctx.beginPath(); ctx.moveTo(u,0);ctx.lineTo(u+h,h);ctx.stroke();
    ctx.beginPath(); ctx.moveTo(u,0);ctx.lineTo(u-h,h);ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "#f4d9b8"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(27,27,w-54,h-54,8); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(37,37,w-74,h-74,7); ctx.stroke();
  for (const y of [h*.31,h*.69]) {
    ctx.fillStyle = "#913d42"; ctx.beginPath(); ctx.arc(w/2,y,63,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(w/2,y,54,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle = "#f3cfaa"; ctx.beginPath(); ctx.moveTo(w/2,y-34);ctx.lineTo(w/2+19,y);ctx.lineTo(w/2,y+34);ctx.lineTo(w/2-19,y);ctx.closePath();ctx.fill();
  }
});
const backMaterial = surface(0xffffff, .70, {map: back});
const cardWidth = .063, cardLength = .089, cardThickness = .00035;

function addCard(parent, x, surfaceY, z, yaw = 0) {
  const card = new T.Group();
  card.position.set(x, surfaceY + .00005, z);
  card.rotation.y = yaw;
  parent.add(card);
  roundedPanel(card, cardWidth, cardLength, cardThickness, .0032, paper, vector(0, 0, 0));
  const face = attach(card, new T.PlaneGeometry(cardWidth-.0024, cardLength-.0024), backMaterial, vector(0, cardThickness+.00002, 0));
  face.rotation.x = -Math.PI / 2;
  return card;
}

const palmShape = [[0,0],[.64,.003],[.88,.015],[.96,.032],[1,.055],[.95,.072],[.80,.083],[.55,.087],[0,.089]];
function hand(parent, wrist, side, posture = "rest") {
  const group = new T.Group();
  group.position.copy(wrist);
  parent.add(group);
  ball(group, vector(0, 0, 0), .024, .017, .020);
  const palm = carve(group, vector(0, 0, .003), palmShape, .036, .0135);
  palm.rotation.x = Math.PI / 2;
  const gripping = posture === "grip";
  const hanging = posture === "hang";
  // Each finger has a separate metacarpal pivot, proximal, middle and distal phalanx.
  const fingers = [
    {base:-.024, start:.078, lengths:[.035,.023,.018], spread:-.008},
    {base:-.007, start:.083, lengths:[.038,.026,.018], spread:-.002},
    {base: .011, start:.081, lengths:[.034,.023,.017], spread: .006},
    {base: .027, start:.072, lengths:[.026,.018,.015], spread: .014},
  ];
  fingers.forEach((f, i) => {
    const radius = [.0084,.0087,.0080,.0069][i];
    const extended = gripping && i < 2;
    const bent = gripping && i >= 2;
    const bends = extended ? [.13,.29,.24] : bent ? [-.15,.32,.62] : hanging ? [.10,.25,.45] : [.16,.24,.16];
    let p = vector(side*f.base, 0, f.start);
    f.lengths.forEach((length, j) => {
      const r = radius * (1-.12*j);
      ball(group, p, r*.90, r*.87, r*.90);
      const q = p.clone().add(vector(side*f.spread*[.48,.32,.20][j], -length*Math.sin(bends[j]), length*Math.cos(bends[j])));
      if (extended && j === 2) {
        const contactY = .00012 + cardThickness + r*.68;
        q.y = (contactY - .0229 - q.x*Math.sin(.033))/Math.cos(.033);
      }
      segment(group, p, q, r, r*.92, maple, .035, .04);
      if (j === 2) ball(group, q, r*.68, r*.68, r*.72, maple);
      p = q;
    });
  });
  const thumb = [vector(-side*.026,-.002,.026), vector(-side*.041,-.005,.044),
    vector(-side*(gripping?.047:.057),-.007,.066), vector(-side*(gripping?.044:.061),gripping?-.013:-.012,.086)];
  for (let i=0;i<thumb.length-1;i++) {
    const r = .0105 - i*.00125;
    ball(group, thumb[i], r*.89,r*.89,r*.89);
    segment(group, thumb[i], thumb[i+1], r, r*.95, maple, .03,.03);
  }
  ball(group, thumb[3], .0055,.0055,.0055,maple);
  return group;
}

function chair(scene) {
  const seat = roundedPanel(scene,.40,.39,.028,.043,walnut,vector(0,.424,-.008));
  roundedPanel(scene,.39,.38,.015,.039,chairFabric,vector(0,.451,-.008));
  for (const side of [-1,1]) {
    for (const front of [-1,1]) {
      segment(scene,vector(side*.185,.012,front*.173),vector(side*.152,.439,front*.145),.020,.019,walnut,0,0);
    }
    segment(scene,vector(side*.156,.433,-.152),vector(side*.159,.932,-.228),.016,.015,walnut,0,0);
  }
  const backrest = roundedPanel(scene,.365,.155,.024,.032,walnut,vector(0,.84,-.209));
  backrest.rotation.x = -.13;
  return seat;
}

function table(scene) {
  roundedPanel(scene,.81,.43,.022,.049,walnut,vector(0,.697,.38));
  roundedPanel(scene,.8,.42,.008,.046,felt,vector(0,.719,.38));
  for (const x of [-.31,.31]) for(const z of [.24,.53]) {
    segment(scene,vector(x*1.07,.012,z), vector(x,.70,z),.021,.021,walnut,0,0);
  }
}

const pelvisProfile = [[0,0],[.55,.008],[.87,.037],[1,.088],[.94,.136],[.80,.167],[.56,.178],[0,.179]];
const ribProfile = [[0,0],[.65,.007],[.77,.037],[.81,.098],[.96,.177],[1,.235],[.97,.273],[.75,.307],[.45,.337],[0,.341]];
const headProfile = [[0,0],[.53,.006],[.68,.021],[.78,.048],[.89,.082],[.98,.117],[1,.153],[.90,.186],[.69,.209],[.39,.223],[0,.228]];
function figure(scene, mode) {
  const sitt = mode !== "standing";
  const dy = sitt ? -.415 : 0, dz = sitt ? -.075 : 0;
  const mid = (y, z = 0) => vector(0,y+dy,z+dz);
  carve(scene, mid(.883),pelvisProfile,.150,.109);
  ball(scene,mid(1.063),.095,.079,.076);
  carve(scene,mid(1.087),ribProfile,.166,.102);
  ball(scene,mid(1.426),.059,.049,.051);
  carve(scene,mid(1.436),[[0,0],[.85,.002],[.95,.015],[1,.045],[.86,.064],[0,.067]],.040,.040);
  ball(scene,mid(1.499),.043,.040,.040);
  carve(scene,mid(1.505,.008),headProfile,.080,.090);
  // A narrow bridge and an understated tip make forward and side views identifiable.
  const nose = ball(scene,mid(1.602,.088),.018,.029,.017,maple);
  nose.rotation.x = .25;
  ball(scene,mid(1.585,.096),.014,.013,.012,maple);
  for (const s of [-1,1]) {
    ball(scene,vector(s*.078,1.615+dy,.004+dz),.012,.024,.014,maple);
    const hip=vector(s*.09,.957+dy,.015+dz);
    const knee=sitt ? vector(s*.112,.503,.328+s*.026) : vector(s*.105,.504,.020+s*.006);
    const ankle=sitt ? vector(s*.120,.078,.359+s*.038) : vector(s*.122,.078,-.014+s*.012);
    joint(scene,hip,.064,s);
    segment(scene,hip,knee,.076,.068,maple,.106,.089);
    joint(scene,knee,.046,s);
    segment(scene,knee,ankle,.051,.047,maple,.09,.069);
    joint(scene,ankle,.033,s);
    const foot=ball(scene,ankle.clone().add(vector(s*.005,-.040,.052)),.044,.035,.102,maple);
    foot.rotation.y = s*.08;
    const shoulder=vector(s*.162,1.356+dy,-.002+dz);
    let elbow,wrist;
    if (!sitt) {
      elbow=vector(s*.223,1.088,-.012); wrist=vector(s*.245,.851,.033);
    } else if (mode === "table") {
      elbow=vector(s*.218,.773,.100); wrist=vector(s*.183,.752,.320);
    } else {
      elbow=vector(s*.198,.705,.044); wrist=vector(s*.135,.565,.238);
    }
    joint(scene,shoulder,.052,s); joint(scene,elbow,.033,s);
    segment(scene,shoulder,elbow,.047,.043,maple,.122,.091);
    segment(scene,elbow,wrist,.039,.036,maple,.105,.053);
    const h=hand(scene,wrist,s,sitt?"rest":"hang");
    h.rotation.order="YXZ";
    h.rotation.y=s*(sitt?-.09:.69);
    h.rotation.x=sitt?(mode==="table"?.013:.15):1.52;
    h.rotation.z=s*(sitt?-.07:.08);
  }
  if(sitt) chair(scene);
  if(mode==="table") table(scene);
}

function handStudy(scene, grip) {
  if (grip) {
    roundedPanel(scene,1.30,1.30,.016,.035,felt,vector(0,-.016,.04));
    // At reference scale, the pads of digits 2 and 3 meet the red back.
    const origin = vector(0,.0229,.0);
    const h = hand(scene,origin,1,"grip");
    h.rotation.z = .033;
    segment(scene,vector(.013,.043,-.175),origin,.032,.023,maple,0,.05);
    addCard(scene,-.023,.00005,.144,-.06);
  } else {
    for (const s of [-1,1]) {
      const wrist=vector(s*.064,.022,.0);
      const h=hand(scene,wrist,s,"rest");
      h.rotation.y=s*.15;
      segment(scene,vector(s*.057,.023,-.125),wrist,.034,.018,maple,.02,.065);
    }
    addCard(scene,0,.00005,.211,.10);
  }
}

// Height is the vertical orthographic field in metres. For level seated views,
// the optical axis stays at chest height and the off-axis frame includes the feet.
export const views = {
  "staende-front":    {body:"standing", target:[0,.86,0], angle:0, elevation:0, height:1.98},
  "sittande-front":   {body:"seated", target:[0,.905,.075], frameShiftY:-.255, angle:0, elevation:0, height:1.54},
  "sittande-profil":  {body:"seated", target:[0,.905,.110], frameShiftY:-.255, angle:90, elevation:0, height:1.54},
  "handryggar":       {study:"rest", target:[0,.017,.086], angle:180, elevation:90, height:.365},
  "staende-trekvart": {body:"standing", target:[0,.86,0], angle:45, elevation:0, height:1.98},
  "staende-profil":   {body:"standing", target:[0,.86,0], angle:90, elevation:0, height:1.98},
  "sittande-bord":    {body:"table", target:[0,.64,.145], angle:45, elevation:10, height:1.56},
  "nacke":            {body:"seated", target:[0,1.104,-.080], angle:180, elevation:0, height:.550},
  "kortgrepp":        {study:"grip", target:[-.013,.010,.083], angle:-42, elevation:20, height:.265},
};

function studioScene() {
  const scene=new T.Scene();
  scene.background=new T.Color("#dce5df");
  const floor=attach(scene,new T.PlaneGeometry(200,200),new T.ShadowMaterial({color:0x53675a,opacity:.29}),vector(0,-.001,0));
  floor.rotation.x=-Math.PI/2;
  floor.castShadow=false;
  scene.add(new T.HemisphereLight(0xfffaf0,0xb4c8bf,1.21));
  const key=new T.DirectionalLight(0xfff5e7,2.05);
  key.position.set(-2.5,4,2.8); key.castShadow=true; scene.add(key);
  const rim=new T.DirectionalLight(0xf1f9ff,1.04);
  rim.position.set(2,2.8,-2.5); scene.add(rim);
  return {scene,key};
}

export function render(name) {
  const view=views[name], {scene,key}=studioScene();
  const isHand=Boolean(view.study);
  if(isHand) handStudy(scene,view.study==="grip");
  else figure(scene,view.body);
  const height=view.height, width=height*720/880;
  const shift=view.frameShiftY ?? 0;
  const camera=new T.OrthographicCamera(-width/2,width/2,height/2+shift,-height/2+shift,.01,20);
  const target=vector(...view.target), a=T.MathUtils.degToRad(view.angle), e=T.MathUtils.degToRad(view.elevation);
  if (view.elevation === 90) {
    camera.position.copy(target).add(vector(0,3,0));
    camera.up.set(0,0,1);
  } else {
    camera.position.copy(target).add(vector(Math.sin(a)*Math.cos(e), Math.sin(e), Math.cos(a)*Math.cos(e)).multiplyScalar(3));
  }
  camera.lookAt(target);
  const shadowExtent=isHand?.34:1.48;
  Object.assign(key.shadow.camera,{left:-shadowExtent,right:shadowExtent,top:shadowExtent,bottom:-shadowExtent,near:.1,far:10});
  key.target.position.copy(target); scene.add(key.target);
  key.shadow.mapSize.set(2048,2048);
  key.shadow.bias=isHand?-.000025:-.00006;
  key.shadow.normalBias=isHand?.00019:.001;
  key.shadow.radius=4.5;
  key.shadow.intensity=.44;
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(1080,1320,false);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.96;
  renderer.render(scene,camera);
  const result=renderer.domElement.toDataURL("image/png");
  renderer.dispose(); renderer.forceContextLoss();
  return result;
}
