import type { Feature, Geometry } from "geojson"

const GEOMETRY_TYPES = [
	"Point",
	"MultiPoint",
	"LineString",
	"MultiLineString",
	"Polygon",
	"MultiPolygon",
	"GeometryCollection",
]

export interface PasteResult {
	features: Feature[]
	error?: string
}

/**
 * Parse clipboard text as GeoJSON. Accepts a FeatureCollection, a single
 * Feature, a bare Geometry, or an array of any of those, and normalizes
 * everything to a list of features.
 */
export function parsePastedGeoJSON(text: string): PasteResult {
	let parsed: unknown
	try {
		parsed = JSON.parse(text)
	} catch {
		return { features: [], error: "Clipboard does not contain valid JSON" }
	}
	const features = collectFeatures(parsed)
	if (features === null) {
		return {
			features: [],
			error: "Clipboard JSON is not GeoJSON (expected FeatureCollection, Feature, or Geometry)",
		}
	}
	if (features.length === 0) {
		return { features: [], error: "Clipboard GeoJSON contains no features" }
	}
	return { features }
}

function collectFeatures(value: unknown): Feature[] | null {
	if (Array.isArray(value)) {
		const collected: Feature[] = []
		for (const item of value) {
			const features = collectFeatures(item)
			if (features === null) return null
			collected.push(...features)
		}
		return collected
	}
	if (typeof value !== "object" || value === null) return null
	const obj = value as Record<string, unknown>
	if (obj.type === "FeatureCollection" && Array.isArray(obj.features)) {
		return collectFeatures(obj.features)
	}
	if (obj.type === "Feature" && "geometry" in obj) {
		return [obj as unknown as Feature]
	}
	if (typeof obj.type === "string" && GEOMETRY_TYPES.includes(obj.type)) {
		return [
			{
				type: "Feature",
				properties: {},
				geometry: obj as unknown as Geometry,
			},
		]
	}
	return null
}
