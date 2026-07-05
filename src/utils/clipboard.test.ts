import { describe, expect, it } from "vitest"
import { parsePastedGeoJSON } from "./clipboard"

const point = (id: string) => ({
	type: "Feature",
	id,
	properties: {},
	geometry: { type: "Point", coordinates: [0, 0] },
})

describe("parsePastedGeoJSON", () => {
	it("accepts a FeatureCollection", () => {
		const result = parsePastedGeoJSON(
			JSON.stringify({ type: "FeatureCollection", features: [point("a"), point("b")] }),
		)
		expect(result.error).toBeUndefined()
		expect(result.features).toHaveLength(2)
	})

	it("accepts a single Feature", () => {
		const result = parsePastedGeoJSON(JSON.stringify(point("a")))
		expect(result.error).toBeUndefined()
		expect(result.features).toHaveLength(1)
	})

	it("wraps a bare geometry into a Feature", () => {
		const result = parsePastedGeoJSON(
			JSON.stringify({
				type: "LineString",
				coordinates: [
					[0, 0],
					[1, 1],
				],
			}),
		)
		expect(result.error).toBeUndefined()
		expect(result.features[0].type).toBe("Feature")
		expect(result.features[0].geometry.type).toBe("LineString")
	})

	it("accepts an array of features and geometries", () => {
		const result = parsePastedGeoJSON(
			JSON.stringify([point("a"), point("b"), { type: "Point", coordinates: [5, 5] }]),
		)
		expect(result.error).toBeUndefined()
		expect(result.features).toHaveLength(3)
	})

	it("rejects invalid JSON", () => {
		expect(parsePastedGeoJSON("not json").error).toMatch(/JSON/)
	})

	it("rejects JSON that is not GeoJSON", () => {
		expect(parsePastedGeoJSON('{"hello": "world"}').error).toMatch(/not GeoJSON/)
	})

	it("rejects an empty FeatureCollection", () => {
		expect(parsePastedGeoJSON('{"type": "FeatureCollection", "features": []}').error).toMatch(
			/no features/,
		)
	})
})
