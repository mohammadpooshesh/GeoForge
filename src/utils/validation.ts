import type { FeatureCollection, Geometry, Position } from "geojson"

export interface ValidationIssue {
	severity: "error" | "warning"
	message: string
	featureIndex?: number
}

export interface ValidationResult {
	/** Parsed FeatureCollection, or null when the document is structurally unusable. */
	data: FeatureCollection | null
	issues: ValidationIssue[]
}

const GEOMETRY_TYPES = [
	"Point",
	"MultiPoint",
	"LineString",
	"MultiLineString",
	"Polygon",
	"MultiPolygon",
	"GeometryCollection",
]

/** Visit every coordinate position in a geometry. */
export function eachPosition(
	geometry: Geometry | null | undefined,
	cb: (pos: Position) => void,
): void {
	if (!geometry) return
	if (geometry.type === "GeometryCollection") {
		for (const g of geometry.geometries ?? []) eachPosition(g, cb)
		return
	}
	walk((geometry as { coordinates?: unknown }).coordinates, cb)
}

function walk(node: unknown, cb: (pos: Position) => void): void {
	if (!Array.isArray(node)) return
	if (node.length >= 2 && typeof node[0] === "number" && typeof node[1] === "number") {
		cb(node as Position)
		return
	}
	for (const child of node) walk(child, cb)
}

export function hasErrors(issues: ValidationIssue[]): boolean {
	return issues.some((i) => i.severity === "error")
}

/**
 * Validate a GeoJSON document (string or already-parsed object).
 * Structural problems (bad JSON / not a FeatureCollection) return data: null.
 * Feature-level problems are reported as issues but keep the data usable.
 */
export function validateGeoJSON(input: string | unknown): ValidationResult {
	let obj: unknown = input
	if (typeof input === "string") {
		try {
			obj = JSON.parse(input)
		} catch (err) {
			return {
				data: null,
				issues: [{ severity: "error", message: `Invalid JSON: ${(err as Error).message}` }],
			}
		}
	}

	if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
		return { data: null, issues: [{ severity: "error", message: "Root must be a JSON object" }] }
	}
	const root = obj as Record<string, unknown>
	if (root.type !== "FeatureCollection") {
		return {
			data: null,
			issues: [
				{
					severity: "error",
					message: `Invalid FeatureCollection: root "type" must be "FeatureCollection" (got ${JSON.stringify(root.type)})`,
				},
			],
		}
	}
	if (!Array.isArray(root.features)) {
		return {
			data: null,
			issues: [{ severity: "error", message: 'Invalid FeatureCollection: "features" must be an array' }],
		}
	}

	const issues: ValidationIssue[] = []
	const seenIds = new Map<string, number>()

	root.features.forEach((f: unknown, index: number) => {
		if (typeof f !== "object" || f === null) {
			issues.push({ severity: "error", message: `Feature ${index}: not an object`, featureIndex: index })
			return
		}
		const feature = f as Record<string, unknown>
		if (feature.type !== "Feature") {
			issues.push({
				severity: "error",
				message: `Feature ${index}: "type" must be "Feature"`,
				featureIndex: index,
			})
		}
		if (feature.id != null) {
			const id = String(feature.id)
			const firstIndex = seenIds.get(id)
			if (firstIndex !== undefined) {
				issues.push({
					severity: "warning",
					message: `Feature ${index}: duplicate id "${id}" (also used by feature ${firstIndex})`,
					featureIndex: index,
				})
			} else {
				seenIds.set(id, index)
			}
		}

		const geometry = feature.geometry as Geometry | null | undefined
		if (geometry == null) {
			issues.push({ severity: "warning", message: `Feature ${index}: empty geometry`, featureIndex: index })
			return
		}
		if (typeof geometry !== "object" || !GEOMETRY_TYPES.includes(geometry.type)) {
			issues.push({
				severity: "error",
				message: `Feature ${index}: invalid geometry type`,
				featureIndex: index,
			})
			return
		}
		if (geometry.type !== "GeometryCollection") {
			const coords = (geometry as { coordinates?: unknown }).coordinates
			if (!Array.isArray(coords) || coords.length === 0) {
				issues.push({
					severity: "warning",
					message: `Feature ${index}: empty coordinates`,
					featureIndex: index,
				})
				return
			}
		}

		let coordIssue = false
		eachPosition(geometry, (pos) => {
			if (coordIssue) return
			const [lng, lat] = pos
			if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
				issues.push({
					severity: "error",
					message: `Feature ${index}: invalid coordinates (non-numeric)`,
					featureIndex: index,
				})
				coordIssue = true
			} else if (Math.abs(lng) > 180 || Math.abs(lat) > 90) {
				issues.push({
					severity: "warning",
					message: `Feature ${index}: coordinate outside WGS84 range [${lng}, ${lat}]`,
					featureIndex: index,
				})
				coordIssue = true
			}
		})

		if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
			const polygons =
				geometry.type === "Polygon"
					? [geometry.coordinates]
					: (geometry.coordinates as Position[][][])
			for (const rings of polygons) {
				if (!Array.isArray(rings)) continue
				for (const ring of rings) {
					if (!Array.isArray(ring)) continue
					if (ring.length < 4) {
						issues.push({
							severity: "error",
							message: `Feature ${index}: polygon ring has fewer than 4 positions`,
							featureIndex: index,
						})
						continue
					}
					const first = ring[0] as Position
					const last = ring[ring.length - 1] as Position
					if (first[0] !== last[0] || first[1] !== last[1]) {
						issues.push({
							severity: "error",
							message: `Feature ${index}: polygon is not closed`,
							featureIndex: index,
						})
					}
				}
			}
		}
	})

	return { data: obj as FeatureCollection, issues }
}
