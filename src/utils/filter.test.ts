import type { FeatureCollection } from "geojson"
import { describe, expect, it } from "vitest"
import { applyFilter } from "./filter"

const fc: FeatureCollection = {
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			id: "a",
			properties: { name: "Central Park", type: "park", population: 0 },
			geometry: { type: "Point", coordinates: [0, 0] },
		},
		{
			type: "Feature",
			id: "b",
			properties: { name: "Downtown", type: "district", population: 25000 },
			geometry: { type: "Point", coordinates: [1, 1] },
		},
		{
			type: "Feature",
			id: "c",
			properties: { name: "Harbor", type: "district", population: 1200 },
			geometry: { type: "Point", coordinates: [2, 2] },
		},
	],
}

describe("applyFilter", () => {
	it("filters numerically with >", () => {
		expect(applyFilter(fc, "population > 10000")).toEqual(["b"])
	})

	it("filters numerically with >=", () => {
		expect(applyFilter(fc, "population >= 1200")).toEqual(["b", "c"])
	})

	it("filters by equality", () => {
		expect(applyFilter(fc, "type == park")).toEqual(["a"])
	})

	it("filters by inequality", () => {
		expect(applyFilter(fc, "type != park")).toEqual(["b", "c"])
	})

	it("supports contains", () => {
		expect(applyFilter(fc, "name contains park")).toEqual(["a"])
	})

	it("matches bare terms against ids, keys, and values", () => {
		expect(applyFilter(fc, "harbor")).toEqual(["c"])
	})

	it("returns empty array when nothing matches", () => {
		expect(applyFilter(fc, "population > 99999999")).toEqual([])
	})
})
