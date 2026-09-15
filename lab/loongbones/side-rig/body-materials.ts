/** Source-space ownership. These partitions only cut mesh topology; they do
 * not repaint pixels, change the source silhouette or move bind landmarks.
 * A vertex chosen by x alone made triangles stretch across the far arm and
 * between the legs when the pelvis began to move (visible zipper artifacts). */
export function bodyMaterials(pixels: Uint8ClampedArray, id: 'dan' | 'doug') {
  const quad = (
    name: string,
    y0: number,
    y1: number,
    l0: number,
    l1: number,
    r0: number,
    r1: number,
  ) => ({
    name,
    boundary: [
      { x: l0, y: y0 },
      { x: r0, y: y0 },
      { x: r1, y: y1 },
      { x: l1, y: y1 },
    ],
  });
  const materials = [quad('torso', 0, 445, 0, 0, 1254, 1254)];
  const far =
    id === 'dan'
      ? [
          [445, 576],
          [605, 582],
          [612, 581],
        ]
      : [
          [445, 576],
          [605, 597],
        ];
  // Below the shirt, follow the actual transparent gap between shorts and
  // far hand. A straight cut captured a thin shorts outline on the hand.
  for (let y = 616; y <= 740; y += 4) {
    let x = 565;
    while (x < 650 && pixels[(y * 1254 + x) * 4 + 3] > 0) x++;
    const edge = x;
    while (x < 655 && pixels[(y * 1254 + x) * 4 + 3] === 0) x++;
    // The fingers touch the shorts on a few source rows. Those are not a
    // transparent seam: interpolate between the valid rows on either side.
    // Following the merged outer edge would assign a stripe of hand to pelvis.
    if (edge > 610) continue;
    const split = x >= 655 ? edge + 3 : (edge + x) / 2;
    far.push([y, split]);
  }
  for (let i = 0; i < far.length - 1; i++) {
    const [y0, x0] = far[i],
      [y1, x1] = far[i + 1];
    materials.push(
      quad('torso', y0, y1, 0, 0, x0, x1),
      quad('far_arm', y0, y1, x0, x1, 1254, 1254),
    );
  }
  materials.push(quad('torso', 740, 766, 0, 0, 1254, 1254));
  for (const [y0, y1, x0, x1] of [
    [766, 805, 552, 552],
    [805, 850, 552, 518],
    [850, 910, 518, 493],
    [910, 1254, 493, 493],
  ]) {
    materials.push(
      quad('leg_L', y0, y1, 0, 0, x0, x1),
      quad('leg_R', y0, y1, x0, x1, 1254, 1254),
    );
  }
  const order = ['far_arm', 'leg_R', 'leg_L', 'torso'];
  return materials.sort(
    (a, b) => order.indexOf(a.name) - order.indexOf(b.name),
  );
}
