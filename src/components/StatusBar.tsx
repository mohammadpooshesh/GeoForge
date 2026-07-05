import { useMemo } from "react"
import { useStore } from "../store/useStore"
import { formatBytes } from "../utils/geo"
import { computeStats } from "../utils/stats"

export function StatusBar() {
	const issues = useStore((s) => s.issues)
	const valid = useStore((s) => s.valid)
	const zoom = useStore((s) => s.zoom)
	const center = useStore((s) => s.center)
	const cursor = useStore((s) => s.cursor)
	const selectedIds = useStore((s) => s.selectedIds)
	const statusMessage = useStore((s) => s.statusMessage)
	const data = useStore((s) => s.data)
	const text = useStore((s) => s.text)

	const stats = useMemo(() => computeStats(data, text), [data, text])
	const errors = issues.filter((i) => i.severity === "error").length
	const warnings = issues.filter((i) => i.severity === "warning").length

	return (
		<footer className="status-bar" data-testid="status-bar">
			<span className={`status-chip ${valid ? "ok" : "err"}`} data-testid="validation-status">
				{valid ? "\u2714 Valid GeoJSON" : `\u2716 ${errors} error${errors === 1 ? "" : "s"}`}
				{warnings > 0 && ` \u00b7 \u26a0 ${warnings}`}
			</span>
			<span className="status-chip">EPSG:4326</span>
			<span className="status-chip">Zoom {zoom.toFixed(2)}</span>
			<span className="status-chip">
				Center {center[0].toFixed(4)}, {center[1].toFixed(4)}
			</span>
			<span className="status-chip">
				{cursor ? `Cursor ${cursor[0].toFixed(4)}, ${cursor[1].toFixed(4)}` : "Cursor \u2014"}
			</span>
			<span className="status-chip" data-testid="selected-count">
				{selectedIds.length} selected
			</span>
			<span className="status-chip">{stats.vertices.toLocaleString()} vertices</span>
			<span className="status-chip">{formatBytes(stats.byteSize)}</span>
			<span className="status-message" data-testid="status-message">
				{statusMessage}
			</span>
		</footer>
	)
}
