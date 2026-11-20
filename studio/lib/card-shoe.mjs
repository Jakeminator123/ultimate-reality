import * as T from "three";

// The exit axis is local +Z. Only the body of the shoe rotates, never the table.
export function buildDrawShoe(cfg) {
  const pitch=T.MathUtils.degToRad(cfg.feedAngleDegrees ?? 0);
  const outletPlane=z=>cfg.cardTopY+(cfg.mouthZ-z)*Math.tan(pitch);
  const shoe=new T.Group();
  shoe.position.set(cfg.shoeCenterXZ[0],0,cfg.shoeCenterXZ[1]);
  shoe.rotation.y=T.MathUtils.degToRad(cfg.yawDegrees);
  const wood=new T.MeshStandardMaterial({color:0x50382c,roughness:.37});
  const brass=new T.MeshStandardMaterial({color:0xb59b64,roughness:.30,metalness:.56});
  const dark=new T.MeshStandardMaterial({color:0x282922,roughness:.4});
  const paper=new T.MeshStandardMaterial({color:0xfff5dc,roughness:.83});
  const cube=new T.BoxGeometry(1,1,1);
  function block(mat,x,y,z,w,h,d) {
    const m=new T.Mesh(cube,mat);
    m.position.set(x,y,z);m.scale.set(w,h,d);
    m.castShadow=m.receiveShadow=true;shoe.add(m);return m;
  }
  block(wood,0,.005,0,cfg.width,.010,cfg.depth);
  block(brass,0,.0126,.061,.068,.003,.028);
  // Restrained side cheeks leave a 68 mm channel for a 63 mm card.
  for (const side of [-1,1]) {
    const profile=new T.Shape();
    profile.moveTo(-.075,.009);profile.lineTo(.075,.009);
    profile.lineTo(.075,.034);profile.lineTo(.053,.053);
    profile.lineTo(-.035,.080);profile.lineTo(-.075,.080);profile.closePath();
    const sidewall=new T.Mesh(new T.ExtrudeGeometry(profile,{depth:.006,bevelEnabled:false}),wood);
    sidewall.rotation.y=-Math.PI/2;
    sidewall.position.x=side<0?-.034:.040;sidewall.castShadow=sidewall.receiveShadow=true;shoe.add(sidewall);
    // Faceplate with a wide central finger cutout, above a through slot.
    const cheekX=pitch ? .035 : .025, cheekWidth=pitch ? .004 : .018;
    block(dark,side*cheekX,.030,.068,cheekWidth,.018,.009);
    block(brass,side*cheekX,.039,.068,cheekWidth,.0014,.009);
  }
  block(wood,0,.044,-.071,.068,.070,.008);
  block(dark,0,.058,pitch ? -.043 : -.032,.068,.009,pitch ? .055 : .075);
  const stockZ=pitch ? cfg.mouthZ-.044*Math.cos(pitch) : .026;
  const stockY=pitch ? outletPlane(stockZ)-.005 : .0134;
  const stock=block(paper,0,stockY,stockZ,cfg.cardWidth,.006,.088);
  stock.rotation.x=pitch;
  const art=document.createElement("canvas");
  art.width=252;art.height=356;
  const ctx=art.getContext("2d");
  ctx.fillStyle="#fff6df";ctx.fillRect(0,0,252,356);
  ctx.fillStyle="#843137";ctx.fillRect(11,11,230,334);
  ctx.strokeStyle="#e5bd9c";ctx.lineWidth=2;
  ctx.save();ctx.beginPath();ctx.rect(19,19,214,318);ctx.clip();
  for(let i=-360;i<620;i+=18) {
    ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+356,356);
    ctx.moveTo(i,0);ctx.lineTo(i-356,356);ctx.stroke();
  }
  ctx.restore();ctx.strokeRect(18,18,216,320);
  const tex=new T.CanvasTexture(art);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;
  const back=new T.MeshStandardMaterial({map:tex,roughness:.82});
  const stackBack=new T.Mesh(new T.PlaneGeometry(cfg.cardWidth,.088),back);
  stackBack.rotation.x=-Math.PI/2+pitch;
  stackBack.position.set(0,stockY+.00305*Math.cos(pitch),stockZ+.00305*Math.sin(pitch));
  stackBack.receiveShadow=true;shoe.add(stackBack);
  const card=new T.Mesh(new T.BufferGeometry(),[back,paper]);
  card.castShadow=card.receiveShadow=true;shoe.add(card);
  function draw(curve) {
    const positions=[],uv=[],face=[],sides=[];
    for(let i=0;i<curve.length;i++){
      const [z,y]=curve[i],t=i/(curve.length-1),k=i*4;
      for(const height of [y,y-cfg.cardThickness])for(const x of [-.5,.5]){
        positions.push(x*cfg.cardWidth,height,z);uv.push(x+.5,t);
      }
      if(i<curve.length-1){
        face.push(k,k+4,k+1,k+4,k+5,k+1);
        sides.push(k+2,k+3,k+6,k+6,k+3,k+7,k,k+2,k+4,k+4,k+2,k+6,k+1,k+5,k+3,k+3,k+5,k+7);
      }
    }
    const k=(curve.length-1)*4;
    sides.push(0,1,2,2,1,3,k,k+2,k+1,k+1,k+2,k+3);
    const g=new T.BufferGeometry();
    g.setAttribute("position",new T.Float32BufferAttribute(positions,3));
    g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
    g.setIndex([...face,...sides]);g.addGroup(0,face.length,0);g.addGroup(face.length,sides.length,1);
    g.computeVertexNormals();card.geometry.dispose();card.geometry=g;
  }
  return { shoe, draw };
}
