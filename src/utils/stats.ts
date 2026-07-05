import type { FeatureCollection } from "geojson"
import { eachPosition } from "./validation"

export interface GeoStats {
	features: number
	points: number
	lines: number
	polygons: number
	multiPoints: number
	multiLines: number
	multiPolygons: number
	geometryCollections: number
	nullGeometries: number
	vertices: number
	byteSize: number
	bounds: [number, number, number, number] | null
	center: [number, number] | null
}

export function computeStats(fc: FeatureCollection, text?: string): GeoStats {
	let points = 0
	let lines = 0
	let polygons = 0
	let multiPoints = 0
	let multiLines = 0
	let multiPolygons = 0
	let geometryCollections = 0
	let nullGeometries = 0
	let vertices = 0
	let minX = Infinity
	let minY = Infinity
	let maxX = -Infinity
	let maxY = -Infinity

	for (const f of fc.features) {
		switch (f.geometry?.type) {
			case "Point":
				points++
				break
			case "MultiPoint":
				multiPoints++
				break
			case "LineString":
				lines++
				break
			case "MultiLineString":
				multiLines++
				break
			case "Polygon":
				polygons++
				break
			case "MultiPolygon":
				multiPolygons++
				break
			case "GeometryCollection":
				geometryCollections++
				break
			default:
				nullGeometries++
		}
		eachPosition(f.geometry, ([lng, lat]) => {
			vertices++
			if (Number.isFinite(lng) && Number.isFinite(lat)) {
				if (lng < minX) minX = lng
				if (lng > maxX) maxX = lng
				if (lat < minY) minY = lat
				if (lat > maxY) maxY = lat
			}
		})
	}

	const hasBounds = Number.isFinite(minX) && Number.isFinite(minY)
	const byteSize = new TextEncoder().encode(text ?? JSON.stringify(fc)).length

	return {
		features: fc.features.length,
		points,
		lines,
		polygons,
		multiPoints,
		multiLines,
		multiPolygons,
		geometryCollections,
		nullGeometries,
		vertices,
		byteSize,
		bounds: hasBounds ? [minX, minY, maxX, maxY] : null,
		center: hasBounds ? [(minX + maxX) / 2, (minY + maxY) / 2] : null,
	}
}
