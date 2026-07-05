import { describe, expect, it } from "vitest"
import { SAMPLE_DATA, serializePretty } from "./geo"
import { featureIndexAtOffset, findFeatureRanges } from "./editorRange"

const text = serializePretty(SAMPLE_DATA)

describe("findFeatureRanges", () => {
	it("finds one range per feature", () => {
		const ranges = findFeatureRanges(text)
		expect(ranges).toHaveLength(SAMPLE_DATA.features.length)
	})

	it("returns ranges that parse as the matching feature", () => {
		const ranges = findFeatureRanges(text)
		ranges.forEach((range, i) => {
			const parsed = JSON.parse(text.slice(range.start, range.end))
			expect(parsed.type).toBe("Feature")
			expect(parsed.geometry.type).toBe(SAMPLE_DATA.features[i].geometry?.type)
		})
	})

	it("handles braces inside strings", () => {
		const tricky = JSON.stringify({
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					id: "x",
					properties: { note: 'has "quotes" and {braces} inside' },
					geometry: { type: "Point", coordinates: [0, 0] },
				},
			],
		})
		expect(findFeatureRanges(tricky)).toHaveLength(1)
	})
})

describe("featureIndexAtOffset", () => {
	it("maps an offset inside the second feature to index 1", () => {
		const ranges = findFeatureRanges(text)
		const mid = Math.floor((ranges[1].start + ranges[1].end) / 2)
		expect(featureIndexAtOffset(text, mid)).toBe(1)
	})

	it("returns -1 outside any feature", () => {
		expect(featureIndexAtOffset(text, 0)).toBe(-1)
	})
})
