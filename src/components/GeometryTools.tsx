import { useState } from "react"
import { useGeoWorker } from "../hooks/useGeoWorker"
import { useStore } from "../store/useStore"
import type { GeometryOp } from "../utils/geometry"

interface OpConfig {
	id: GeometryOp
	label: string
	param?: { key: string; label: string; defaultValue: number; step?: number }
}

const OPS: OpConfig[] = [
	{ id: "buffer", label: "Buffer", param: { key: "distance", label: "km", defaultValue: 1, step: 0.1 } },
	{ id: "simplify", label: "Simplify", param: { key: "tolerance", label: "tol", defaultValue: 0.01, step: 0.005 } },
	{ id: "union", label: "Union" },
	{ id: "difference", label: "Difference" },
	{ id: "intersect", label: "Intersect" },
	{ id: "centroid", label: "Centroid" },
	{ id: "convexHull", label: "Convex Hull" },
	{ id: "envelope", label: "Envelope" },
	{ id: "bboxPolygon", label: "BBox Polygon" },
	{ id: "explode", label: "Explode Multi" },
	{ id: "combine", label: "Combine" },
	{ id: "dissolve", label: "Dissolve" },
	{ id: "cleanCoords", label: "Clean Coords" },
	{ id: "truncate", label: "Truncate", param: { key: "precision", label: "digits", defaultValue: 6, step: 1 } },
	{ id: "rotate", label: "Rotate", param: { key: "angle", label: "deg", defaultValue: 15, step: 5 } },
	{ id: "scale", label: "Scale", param: { key: "factor", label: "\u00d7", defaultValue: 1.5, step: 0.1 } },
	{ id: "translate", label: "Translate", param: { key: "distance", label: "km", defaultValue: 1, step: 0.5 } },
	{ id: "area", label: "Measure Area" },
	{ id: "length", label: "Measure Length" },
	{ id: "bearing", label: "Bearing (2 pts)" },
	{ id: "midpoint", label: "Midpoint (2 pts)" },
	{ id: "bbox", label: "Show BBox" },
]

/**
 * Turf.js toolbox. Operations run inside a Web Worker and apply to the
 * current selection (or the whole collection when nothing is selected).
 */
export function GeometryTools() {
	const [open, setOpen] = useState(false)
	const [params, setParams] = useState<Record<string, number>>({})
	const [busy, setBusy] = useState(false)
	const runOp = useGeoWorker()
	const selectedCount = useStore((s) => s.selectedIds.length)

	const run = async (config: OpConfig) => {
		const { data, selectedIds, applyData, setStatus } = useStore.getState()
		setBusy(true)
		setStatus(`Running ${config.label}\u2026`)
		const opParams = config.param
			? { [config.param.key]: params[config.id] ?? config.param.defaultValue }
			: {}
		const result = await runOp(config.id, data, selectedIds, opParams)
		setBusy(false)
		if (result.error) {
			setStatus(`\u26a0 ${result.error}`)
			return
		}
		if (result.data) {
			applyData(result.data, { message: result.message ?? `Applied ${config.label}` })
		} else if (result.message) {
			setStatus(result.message)
		}
		setOpen(false)
	}

	return (
		<div className="geometry-tools">
			<button
				className={`toolbar-button${open ? " active" : ""}`}
				onClick={() => setOpen((v) => !v)}
				title="Turf.js geometry operations"
				data-testid="geometry-tools-button"
			>
				⚙ Geometry
			</button>
			{open && (
				<div className="geometry-menu" data-testid="geometry-menu">
					<div className="geometry-menu-header">
						{selectedCount ? `${selectedCount} selected` : "all features"}
					</div>
					{OPS.map((config) => (
						<div key={config.id} className="geometry-menu-row">
							<button disabled={busy} onClick={() => run(config)} data-testid={`op-${config.id}`}>
								{config.label}
							</button>
							{config.param && (
								<label>
									<input
										type="number"
										step={config.param.step ?? 1}
										value={params[config.id] ?? config.param.defaultValue}
										onChange={(e) =>
											setParams((p) => ({ ...p, [config.id]: Number(e.target.value) }))
										}
									/>
									{config.param.label}
								</label>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	)
}
