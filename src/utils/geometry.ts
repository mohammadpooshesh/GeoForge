import * as turf from "@turf/turf"
import type { Feature, FeatureCollection } from "geojson"
import { ensureIds, generateId } from "./geo"

export type GeometryOp =
	| "buffer"
	| "simplify"
	| "union"
	| "difference"
	| "intersect"
	| "centroid"
	| "convexHull"
	| "envelope"
	| "bboxPolygon"
	| "explode"
	| "combine"
	| "dissolve"
	| "cleanCoords"
	| "truncate"
	| "rotate"
	| "scale"
	| "translate"
	| "area"
	| "length"
	| "bearing"
	| "midpoint"
	| "bbox"

export interface GeometryOpResult {
	data?: FeatureCollection
	message?: string
	error?: string
}

const t = turf as unknown as Record<string, (...args: unknown[]) => any>

function selectedFeatures(fc: FeatureCollection, ids: string[]): Feature[] {
	if (!ids.length) return fc.features
	const set = new Set(ids)
	return fc.features.filter((f) => f.id != null && set.has(String(f.id)))
}

function polygonsOf(features: Feature[]): Feature[] {
	return features.filter(
		(f) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon",
	)
}

function keepIdentity(result: Feature | null | undefined, original: Feature): Feature | null {
	if (!result) return null
	return {
		...result,
		id: original.id,
		properties: { ...(original.properties ?? {}), ...(result.properties ?? {}) },
	}
}

function replaceFeatures(fc: FeatureCollection, removed: Feature[], added: Feature[]): FeatureCollection {
	const removeSet = new Set(removed.map((f) => String(f.id)))
	const features = fc.features.filter((f) => !removeSet.has(String(f.id))).concat(added)
	return ensureIds({ type: "FeatureCollection", features })
}

function appendFeatures(fc: FeatureCollection, added: Feature[]): FeatureCollection {
	return ensureIds({ type: "FeatureCollection", features: fc.features.concat(added) })
}

function mapEach(
	fc: FeatureCollection,
	targets: Feature[],
	fn: (f: Feature) => Feature | null | undefined,
	label: string,
): GeometryOpResult {
	const out: Feature[] = []
	let skipped = 0
	for (const f of targets) {
		try {
			const mapped = keepIdentity(fn(f), f)
			if (mapped) out.push(mapped)
			else skipped++
		} catch {
			out.push(f)
			skipped++
		}
	}
	if (!out.length) return { error: `${label}: no features could be processed` }
	const suffix = skipped ? ` (${skipped} skipped)` : ""
	return { data: replaceFeatures(fc, targets, out), message: `${label} applied to ${out.length} feature(s)${suffix}` }
}

/**
 * Run a Turf.js geometry operation. Operates on the selected features, or on
 * all features when the selection is empty. Measurement ops only return a message.
 */
export function runGeometryOp(
	op: GeometryOp,
	fc: FeatureCollection,
	selectedIds: string[] = [],
	params: Record<string, number> = {},
): GeometryOpResult {
	const targets = selectedFeatures(fc, selectedIds)
	if (!targets.length) return { error: "No features to operate on" }

	try {
		switch (op) {
			case "buffer": {
				const distance = params.distance ?? 1
				return mapEach(fc, targets, (f) => t.buffer(f, distance, { units: "kilometers" }), `Buffer ${distance} km`)
			}
			case "simplify": {
				const tolerance = params.tolerance ?? 0.01
				return mapEach(fc, targets, (f) => t.simplify(f, { tolerance, highQuality: true }), "Simplify")
			}
			case "cleanCoords":
				return mapEach(fc, targets, (f) => t.cleanCoords(f), "Clean coordinates")
			case "truncate": {
				const precision = params.precision ?? 6
				return mapEach(fc, targets, (f) => t.truncate(f, { precision, mutate: false }), "Truncate")
			}
			case "rotate": {
				const angle = params.angle ?? 15
				return mapEach(fc, targets, (f) => t.transformRotate(f, angle), `Rotate ${angle}\u00b0`)
			}
			case "scale": {
				const factor = params.factor ?? 1.5
				return mapEach(fc, targets, (f) => t.transformScale(f, factor), `Scale \u00d7${factor}`)
			}
			case "translate": {
				const distance = params.distance ?? 1
				const direction = params.direction ?? 90
				return mapEach(
					fc,
					targets,
					(f) => t.transformTranslate(f, distance, direction, { units: "kilometers" }),
					`Translate ${distance} km`,
				)
			}
			case "union": {
				const polys = polygonsOf(targets)
				if (polys.length < 2) return { error: "Union needs at least 2 polygons (select them first)" }
				const result = t.union(t.featureCollection(polys)) as Feature | null
				if (!result) return { error: "Union produced no result" }
				const merged = { ...result, id: generateId(), properties: { ...(polys[0].properties ?? {}) } }
				return { data: replaceFeatures(fc, polys, [merged]), message: `Union of ${polys.length} polygons` }
			}
			case "difference": {
				const polys = polygonsOf(targets)
				if (polys.length < 2) return { error: "Difference needs at least 2 polygons" }
				const result = t.difference(t.featureCollection(polys)) as Feature | null
				if (!result) return { error: "Difference produced an empty result" }
				const merged = { ...result, id: generateId(), properties: { ...(polys[0].properties ?? {}) } }
				return { data: replaceFeatures(fc, polys, [merged]), message: "Difference (first minus others)" }
			}
			case "intersect": {
				const polys = polygonsOf(targets)
				if (polys.length < 2) return { error: "Intersect needs at least 2 polygons" }
				const result = t.intersect(t.featureCollection(polys)) as Feature | null
				if (!result) return { error: "Polygons do not intersect" }
				const merged = { ...result, id: generateId(), properties: { ...(polys[0].properties ?? {}) } }
				return { data: replaceFeatures(fc, polys, [merged]), message: `Intersection of ${polys.length} polygons` }
			}
			case "centroid": {
				const pts = targets.map((f) => ({
					...(t.centroid(f) as Feature),
					id: generateId(),
					properties: { ...(f.properties ?? {}), geoforge_op: "centroid", source: String(f.id) },
				}))
				return { data: appendFeatures(fc, pts), message: `Added ${pts.length} centroid(s)` }
			}
			case "convexHull": {
				const hull = t.convex(t.featureCollection(targets)) as Feature | null
				if (!hull) return { error: "Could not compute convex hull" }
				hull.id = generateId()
				hull.properties = { geoforge_op: "convexHull" }
				return { data: appendFeatures(fc, [hull]), message: "Added convex hull" }
			}
			case "envelope": {
				const env = t.envelope(t.featureCollection(targets)) as Feature
				env.id = generateId()
				env.properties = { geoforge_op: "envelope" }
				return { data: appendFeatures(fc, [env]), message: "Added envelope" }
			}
			case "bboxPolygon": {
				const box = t.bboxPolygon(t.bbox(t.featureCollection(targets))) as Feature
				box.id = generateId()
				box.properties = { geoforge_op: "bbox" }
				return { data: appendFeatures(fc, [box]), message: "Added bounding-box polygon" }
			}
			case "explode": {
				const multis = targets.filter((f) => f.geometry?.type?.startsWith("Multi"))
				if (!multis.length) return { error: "No Multi* geometries to explode" }
				const exploded: Feature[] = []
				for (const f of multis) {
					const flat = t.flatten(f) as FeatureCollection
					for (const part of flat.features) {
						exploded.push({ ...part, id: generateId(), properties: { ...(f.properties ?? {}) } })
					}
				}
				return {
					data: replaceFeatures(fc, multis, exploded),
					message: `Exploded ${multis.length} feature(s) into ${exploded.length}`,
				}
			}
			case "combine": {
				const combined = t.combine(t.featureCollection(targets)) as FeatureCollection
				const features = combined.features.map((f) => ({
					...f,
					id: generateId(),
					properties: { ...(targets[0].properties ?? {}), geoforge_op: "combine" },
				}))
				if (!features.length) return { error: "Nothing to combine" }
				return {
					data: replaceFeatures(fc, targets, features),
					message: `Combined into ${features.length} multi-geometry feature(s)`,
				}
			}
			case "dissolve": {
				const polys = polygonsOf(targets)
				if (polys.length < 2) return { error: "Dissolve needs at least 2 polygons" }
				const flat: Feature[] = []
				for (const p of polys) {
					const f = t.flatten(p) as FeatureCollection
					flat.push(...f.features.map((x) => ({ ...x, properties: { ...(p.properties ?? {}) } })))
				}
				const dissolved = t.dissolve(t.featureCollection(flat)) as FeatureCollection
				const features = dissolved.features.map((f) => ({ ...f, id: generateId() }))
				return { data: replaceFeatures(fc, polys, features), message: `Dissolved into ${features.length} feature(s)` }
			}
			case "area": {
				let total = 0
				for (const f of targets) total += t.area(f) as number
				return { message: `Area: ${total.toFixed(1)} m\u00b2 (${(total / 1e6).toFixed(4)} km\u00b2)` }
			}
			case "length": {
				let total = 0
				for (const f of targets) total += t.length(f, { units: "kilometers" }) as number
				return { message: `Length: ${total.toFixed(3)} km` }
			}
			case "bearing": {
				const pts = targets.filter((f) => f.geometry?.type === "Point")
				if (pts.length < 2) return { error: "Bearing needs 2 selected points" }
				const bearing = t.bearing(pts[0], pts[1]) as number
				return { message: `Bearing: ${bearing.toFixed(2)}\u00b0` }
			}
			case "midpoint": {
				const pts = targets.filter((f) => f.geometry?.type === "Point")
				if (pts.length < 2) return { error: "Midpoint needs 2 selected points" }
				const mid = t.midpoint(pts[0], pts[1]) as Feature
				mid.id = generateId()
				mid.properties = { geoforge_op: "midpoint" }
				return { data: appendFeatures(fc, [mid]), message: "Added midpoint" }
			}
			case "bbox": {
				const box = t.bbox(t.featureCollection(targets)) as number[]
				return { message: `BBox: [${box.map((n) => n.toFixed(5)).join(", ")}]` }
			}
			default:
				return { error: `Unknown operation: ${op}` }
		}
	} catch (err) {
		return { error: (err as Error).message }
	}
}
