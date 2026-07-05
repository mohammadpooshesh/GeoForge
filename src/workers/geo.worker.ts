import { runGeometryOp, type GeometryOp } from "../utils/geometry"

interface GeoWorkerRequest {
	id: number
	op: GeometryOp
	fc: import("geojson").FeatureCollection
	selectedIds?: string[]
	params?: Record<string, number>
}

const ctx = self as unknown as {
	onmessage: ((e: MessageEvent<GeoWorkerRequest>) => void) | null
	postMessage: (msg: unknown) => void
}

ctx.onmessage = (e) => {
	const { id, op, fc, selectedIds, params } = e.data
	try {
		const result = runGeometryOp(op, fc, selectedIds ?? [], params ?? {})
		ctx.postMessage({ id, result })
	} catch (err) {
		ctx.postMessage({ id, error: (err as Error).message })
	}
}
