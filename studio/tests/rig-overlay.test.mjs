import assert from "node:assert/strict";
import test from "node:test";
import { Bone, BufferGeometry, Group, Matrix4, MeshBasicMaterial, Skeleton, SkinnedMesh } from "three";
import { makeRigOverlay } from "../lib/rig-overlay.ts";

test("handledens kedja syns även när vridleden döljs och markörstorleken följer visningsskalan", () => {
  const body = new Group();
  const mesh = new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial());
  body.add(mesh);
  const bones = ["body_world", "l_lowarm", "l_wrist_twist", "l_wrist"].map(name => {
    const bone = new Bone();
    bone.name = name;
    return bone;
  });
  mesh.add(bones[0]);
  bones[0].add(bones[1]);
  bones[1].add(bones[2]);
  bones[2].add(bones[3]);
  bones[1].position.y = 0.2;
  bones[2].position.y = 0.12;
  bones[3].position.y = 0.08;
  mesh.bind(new Skeleton(bones));
  const overlay = makeRigOverlay(body);
  try {
    for (const all of [false, true]) {
      overlay.show({ skeleton: true, joints: true, surface: true, all });
      overlay.refresh(0.001);
      const [segments, markers] = overlay.group.children;
      assert.equal(markers.count, all ? 4 : 2);
      const matrix = new Matrix4();
      const intervals = Array.from({ length: segments.count }, (_, i) => {
        segments.getMatrixAt(i, matrix);
        const centre = matrix.elements[13];
        const halfLength = matrix.elements[5] / 2;
        return [centre - halfLength, centre + halfLength];
      }).sort((a, b) => a[0] - b[0]);
      assert.ok(intervals.length > 0);
      assert.ok(Math.abs(intervals[0][0] - 0.2) < 1e-6);
      assert.ok(Math.abs(intervals.at(-1)[1] - 0.4) < 1e-6);
      for (let i = 1; i < intervals.length; i++) {
        assert.ok(Math.abs(intervals[i][0] - intervals[i - 1][1]) < 1e-6);
      }
      markers.getMatrixAt(0, matrix);
      const firstRadius = matrix.elements[0];
      overlay.refresh(0.0005);
      markers.getMatrixAt(0, matrix);
      assert.ok(Math.abs(matrix.elements[0] - firstRadius / 2) < 1e-8);
    }
  } finally {
    overlay.dispose();
    mesh.skeleton.dispose();
    mesh.material.dispose();
    mesh.geometry.dispose();
  }
});
