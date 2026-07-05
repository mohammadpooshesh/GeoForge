import { describe, expect, it } from "vitest"
import { SAMPLE_DATA, serializePretty } from "./geo"
import { hasErrors, validateGeoJSON } from "./validation"

describe("validateGeoJSON", () => {
	it("accepts the bundled sample data", () => {
		const { data, issues } = validateGeoJSON(serializePretty(SAMPLE_DATA))
		expect(data).not.toBeNull()
		expect(hasErrors(issues)).toBe(false)
	})

	it("reports invalid JSON", () => {
		const { data, issues } = validateGeoJSON('{"type": "FeatureCollection",')
		expect(data).toBeNull()
		expect(issues.some((i) => i.severity === "error" && /json/i.test(i.message))).toBe(true)
	})

	it("rejects a root that is not a FeatureCollection", () => {
		const { issues } = validateGeoJSON(JSON.stringify({ type: "Feature", geometry: null, properties: {} }))
		expect(hasErrors(issues)).toBe(true)
	})

	it("flags an unclosed polygon ring", () => {
		const fc = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					id: "p1",
					properties: {},
					geometry: {
						type: "Polygon",
						coordinates: [
							[
								[0, 0],
								[1, 0],
								[1, 1],
								[0, 1],
							],
						],
					},
				},
			],
		}
		const { issues } = validateGeoJSON(JSON.stringify(fc))
		expect(issues.some((i) => /not closed/i.test(i.message))).toBe(true)
	})

	it("warns about out-of-range coordinates", () => {
		const fc = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					id: "pt",
					properties: {},
					geometry: { type: "Point", coordinates: [999, 10] },
				},
			],
		}
		const { issues } = validateGeoJSON(JSON.stringify(fc))
		expect(issues.some((i) => /range/i.test(i.message))).toBe(true)
	})

	it("detects duplicate feature ids", () => {
		const fc = {
			type: "FeatureCollection",
			features: [
				{ type: "Feature", id: "a", properties: {}, geometry: { type: "Point", coordinates: [0, 0] } },
				{ type: "Feature", id: "a", properties: {}, geometry: { type: "Point", coordinates: [1, 1] } },
			],
		}
		const { issues } = validateGeoJSON(JSON.stringify(fc))
		expect(issues.some((i) => /duplicate/i.test(i.message))).toBe(true)
	})

	it("warns about empty geometry", () => {
		const fc = {
			type: "FeatureCollection",
			features: [{ type: "Feature", id: "e", properties: {}, geometry: null }],
		}
		const { issues } = validateGeoJSON(JSON.stringify(fc))
		expect(issues.some((i) => /empty geometry/i.test(i.message))).toBe(true)
	})
})
