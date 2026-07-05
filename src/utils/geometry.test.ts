import type { Feature, FeatureCollection, Point, Polygon } from "geojson"
import { describe, expect, it } from "vitest"
import { runGeometryOp } from "./geometry"

function square(id: string, x: number, y: number, size = 2): Feature<Polygon> {
	return {
		type: "Feature",
		id,
		properties: { name: id },
		geometry: {
			type: "Polygon",
			coordinates: [
				[
					[x, y],
					[x + size, y],
					[x + size, y + size],
					[x, y + size],
					[x, y],
				],
			],
		},
	}
}

function point(id: string, x: number, y: number): Feature<Point> {
	return {
		type: "Feature",
		id,
		properties: {},
		geometry: { type: "Point", coordinates: [x, y] },
	}
}

const collect = (...features: Feature[]): FeatureCollection => ({
	type: "FeatureCollection",
	features,
})

describe("runGeometryOp", () => {
	it("buffers a point into a polygon", () => {
		const result = runGeometryOp("buffer", collect(point("p", 0, 0)), [], { distance: 1 })
		expect(result.error).toBeUndefined()
		expect(result.data?.features[0].geometry.type).toBe("Polygon")
	})

	it("unions two overlapping squares into one polygon", () => {
		const result = runGeometryOp("union", collect(square("a", 0, 0), square("b", 1, 1)), [])
		expect(result.error).toBeUndefined()
		expect(result.data?.features).toHaveLength(1)
	})

	it("intersects two overlapping squares", () => {
		const result = runGeometryOp("intersect", collect(square("a", 0, 0), square("b", 1, 1)), [])
		expect(result.error).toBeUndefined()
		expect(result.data?.features).toHaveLength(1)
	})

	it("explodes a MultiPoint into single points", () => {
		const multi: Feature = {
			type: "Feature",
			id: "m",
			properties: { name: "multi" },
			geometry: {
				type: "MultiPoint",
				coordinates: [
					[0, 0],
					[1, 1],
					[2, 2],
				],
			},
		}
		const result = runGeometryOp("explode", collect(multi), [])
		expect(result.error).toBeUndefined()
		expect(result.data?.features).toHaveLength(3)
		expect(result.data?.features.every((f) => f.geometry.type === "Point")).toBe(true)
	})

	it("measures area of a polygon", () => {
		const result = runGeometryOp("area", collect(square("a", 0, 0)), [])
		expect(result.data).toBeUndefined()
		expect(result.message).toMatch(/Area/)
	})

	it("translates coordinates", () => {
		const fc = collect(point("p", 0, 0))
		const result = runGeometryOp("translate", fc, [], { distance: 100, direction: 90 })
		expect(result.error).toBeUndefined()
		const moved = result.data?.features[0].geometry as Point
		expect(moved.coordinates[0]).toBeGreaterThan(0.5)
	})

	it("operates only on the selection when ids are given", () => {
		const fc = collect(point("p1", 0, 0), point("p2", 5, 5))
		const result = runGeometryOp("buffer", fc, ["p1"], { distance: 1 })
		expect(result.error).toBeUndefined()
		const types = result.data?.features.map((f) => f.geometry.type).sort()
		expect(types).toEqual(["Point", "Polygon"])
	})

	it("keeps feature identity after per-feature ops", () => {
		const fc = collect(square("a", 0, 0))
		const result = runGeometryOp("rotate", fc, [], { angle: 45 })
		expect(result.data?.features[0].id).toBe("a")
		expect(result.data?.features[0].properties?.name).toBe("a")
	})
})
