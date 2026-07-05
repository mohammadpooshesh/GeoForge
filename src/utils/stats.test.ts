import type { FeatureCollection } from "geojson"
import { describe, expect, it } from "vitest"
import { computeStats } from "./stats"

const fc: FeatureCollection = {
	type: "FeatureCollection",
	features: [
		{ type: "Feature", id: "1", properties: {}, geometry: { type: "Point", coordinates: [10, 20] } },
		{
			type: "Feature",
			id: "2",
			properties: {},
			geometry: {
				type: "LineString",
				coordinates: [
					[0, 0],
					[5, 5],
					[10, 0],
				],
			},
		},
		{
			type: "Feature",
			id: "3",
			properties: {},
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[0, 0],
						[4, 0],
						[4, 4],
						[0, 4],
						[0, 0],
					],
				],
			},
		},
	],
}

describe("computeStats", () => {
	it("counts feature types", () => {
		const s = computeStats(fc)
		expect(s.features).toBe(3)
		expect(s.points).toBe(1)
		expect(s.lines).toBe(1)
		expect(s.polygons).toBe(1)
	})

	it("counts vertices", () => {
		const s = computeStats(fc)
		expect(s.vertices).toBe(1 + 3 + 5)
	})

	it("computes bounds and center", () => {
		const s = computeStats(fc)
		expect(s.bounds).toEqual([0, 0, 10, 20])
		expect(s.center).toEqual([5, 10])
	})

	it("measures byte size from the provided text", () => {
		const s = computeStats(fc, "abcd")
		expect(s.byteSize).toBe(4)
	})
})
