import { useMemo } from "react"
import { useStore } from "../store/useStore"
import { formatBytes } from "../utils/geo"
import { computeStats } from "../utils/stats"

export function StatsPanel() {
	const data = useStore((s) => s.data)
	const text = useStore((s) => s.text)
	const stats = useMemo(() => computeStats(data, text), [data, text])

	const rows: Array<[string, string]> = [
		["Features", String(stats.features)],
		["Points", String(stats.points + stats.multiPoints)],
		["Lines", String(stats.lines + stats.multiLines)],
		["Polygons", String(stats.polygons + stats.multiPolygons)],
		["Vertices", stats.vertices.toLocaleString()],
		["File Size", formatBytes(stats.byteSize)],
		[
			"Bounds",
			stats.bounds ? stats.bounds.map((n) => n.toFixed(4)).join(", ") : "\u2014",
		],
		[
			"Center",
			stats.center ? stats.center.map((n) => n.toFixed(4)).join(", ") : "\u2014",
		],
		["CRS", "EPSG:4326 (WGS84)"],
	]

	return (
		<div className="stats-panel" data-testid="stats-panel">
			{rows.map(([label, value]) => (
				<div key={label} className="stats-row">
					<span className="stats-label">{label}</span>
					<span className="stats-value">{value}</span>
				</div>
			))}
		</div>
	)
}
