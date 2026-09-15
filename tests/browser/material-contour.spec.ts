import { test, expect } from 'playwright/test';

test('material cutouts conserve area without overlapping faces across a sleeve opening', async ({
  page,
}) => {
  await page.goto('/loongbones/');
  const result = await page.evaluate(async () => {
    const moduleUrl = '/loongbones/authoring/material-contour.ts';
    const { clipMaterialCell } = await import(moduleUrl);
    const rect = (x: number, y: number, w: number, h: number) => [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
    type Point = { x: number; y: number };
    const area = (polygons: Point[][]) =>
      polygons.reduce(
        (sum, p) =>
          sum +
          p.reduce((a, v, i) => {
            const q = p[(i + 1) % p.length];
            return a + v.x * q.y - q.x * v.y;
          }, 0) /
            2,
        0,
      );
    const cell = rect(0, 0, 10, 10);
    return {
      intact: area(clipMaterialCell(cell)),
      opening: area(clipMaterialCell(cell, undefined, [rect(3, 3, 4, 4)])),
      crossesEdge: area(
        clipMaterialCell(cell, undefined, [rect(-5, -5, 10, 20)]),
      ),
      coversCell: area(
        clipMaterialCell(cell, undefined, [rect(-5, -5, 20, 20)]),
      ),
      disjoint: area(clipMaterialCell(cell, undefined, [rect(20, 20, 10, 10)])),
      overlappingOpenings: area(
        clipMaterialCell(cell, undefined, [rect(3, 3, 4, 4), rect(5, 3, 4, 4)]),
      ),
      boundaryAndOpening: area(
        clipMaterialCell(cell, rect(2, 2, 6, 6), [rect(3, 3, 4, 4)]),
      ),
    };
  });
  for (const [name, expected] of Object.entries({
    intact: 100,
    opening: 84,
    crossesEdge: 50,
    coversCell: 0,
    disjoint: 100,
    overlappingOpenings: 76,
    boundaryAndOpening: 20,
  }))
    expect(result[name as keyof typeof result], name).toBeCloseTo(expected, 9);
});
