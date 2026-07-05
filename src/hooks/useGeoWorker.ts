import { useCallback, useEffect, useRef } from "react"
import type { FeatureCollection } from "geojson"
import { runGeometryOp, type GeometryOp, type GeometryOpResult } from "../utils/geometry"

interface PendingRequest {
	resolve: (r: GeometryOpResult) => void
}

/**
 * Run geometry operations inside a Web Worker so the UI never freezes.
 * Falls back to synchronous execution when workers are unavailable.
 */
export function useGeoWorker() {
	const workerRef = useRef<Worker | null>(null)
	const pending = useRef(new Map<number, PendingRequest>())
	const nextId = useRef(1)

	useEffect(() => {
		if (typeof Worker === "undefined") return
		try {
			const worker = new Worker(new URL("../workers/geo.worker.ts", import.meta.url), {
				type: "module",
			})
			worker.onmessage = (e: MessageEvent) => {
				const { id, result, error } = e.data as {
					id: number
					result?: GeometryOpResult
					error?: string
				}
				const req = pending.current.get(id)
				if (!req) return
				pending.current.delete(id)
				req.resolve(error ? { error } : (result ?? { error: "Empty worker response" }))
			}
			worker.onerror = () => {
				// Fall back to sync execution for all outstanding + future requests
				for (const [, req] of pending.current) req.resolve({ error: "Worker crashed" })
				pending.current.clear()
				workerRef.current = null
			}
			workerRef.current = worker
			return () => {
				worker.terminate()
				workerRef.current = null
			}
		} catch {
			workerRef.current = null
		}
	}, [])

	return useCallback(
		(
			op: GeometryOp,
			fc: FeatureCollection,
			selectedIds: string[],
			params?: Record<string, number>,
		): Promise<GeometryOpResult> => {
			const worker = workerRef.current
			if (!worker) return Promise.resolve(runGeometryOp(op, fc, selectedIds, params ?? {}))
			return new Promise((resolve) => {
				const id = nextId.current++
				pending.current.set(id, { resolve })
				worker.postMessage({ id, op, fc, selectedIds, params })
			})
		},
		[],
	)
}
