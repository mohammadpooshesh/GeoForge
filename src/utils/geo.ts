import type { Feature, FeatureCollection } from "geojson"

export const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] }

let counter = 0

export function generateId(): string {
	counter += 1
	return `feature-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Guarantee every feature has a unique string id (stable ids are kept).
 */
export function ensureIds(fc: FeatureCollection): FeatureCollection {
	const seen = new Set<string>()
	const features = fc.features.map((f: Feature) => {
		let id = f.id != null ? String(f.id) : ""
		if (!id || seen.has(id)) id = generateId()
		seen.add(id)
		return { ...f, id }
	})
	return { type: "FeatureCollection", features }
}

export function serializePretty(fc: FeatureCollection): string {
	return JSON.stringify(fc, null, 2)
}

export function serializeMinified(fc: FeatureCollection): string {
	return JSON.stringify(fc)
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** Trigger a client-side file download. */
export function download(filename: string, content: string, mime = "application/geo+json"): void {
	const blob = new Blob([content], { type: mime })
	const url = URL.createObjectURL(blob)
	const a = document.createElement("a")
	a.href = url
	a.download = filename
	document.body.appendChild(a)
	a.click()
	a.remove()
	URL.revokeObjectURL(url)
}

/** First-run sample document. */
export const SAMPLE_DATA: FeatureCollection = {
	type: "FeatureCollection",
	features: [
		{
			type: "Feature",
			id: "city-park",
			properties: { name: "City Park", type: "park", population: 0, color: "#2ecc71" },
			geometry: {
				type: "Polygon",
				coordinates: [
					[
						[-73.9812, 40.7681],
						[-73.9581, 40.8003],
						[-73.9495, 40.7968],
						[-73.9729, 40.7642],
						[-73.9812, 40.7681],
					],
				],
			},
		},
		{
			type: "Feature",
			id: "river-walk",
			properties: { name: "River Walk", type: "trail", length_km: 4.2, color: "#3498db" },
			geometry: {
				type: "LineString",
				coordinates: [
					[-74.0132, 40.7006],
					[-74.0086, 40.7126],
					[-73.9985, 40.7266],
					[-73.9855, 40.7355],
				],
			},
		},
		{
			type: "Feature",
			id: "downtown-station",
			properties: { name: "Downtown Station", type: "station", population: 25000 },
			geometry: { type: "Point", coordinates: [-73.9772, 40.7527] },
		},
		{
			type: "Feature",
			id: "harbor-view",
			properties: { name: "Harbor View", type: "viewpoint", population: 1200 },
			geometry: { type: "Point", coordinates: [-74.0445, 40.6892] },
		},
	],
}
