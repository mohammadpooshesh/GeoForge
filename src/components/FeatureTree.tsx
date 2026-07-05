import type { Feature } from "geojson"
import { useMemo, useRef, useState } from "react"
import { useStore } from "../store/useStore"

const ROW_HEIGHT = 26
const OVERSCAN = 12

const TYPE_ICONS: Record<string, string> = {
	Point: "\u25c9",
	MultiPoint: "\u2058",
	LineString: "\u2500",
	MultiLineString: "\u2261",
	Polygon: "\u2b20",
	MultiPolygon: "\u2b21",
	GeometryCollection: "\u229e",
}

type Row =
	| { kind: "feature"; feature: Feature; id: string }
	| { kind: "detail"; text: string; id: string; parentId: string }

/**
 * VS Code-style explorer with lightweight virtual scrolling, so even very
 * large collections (50k+ features) stay smooth.
 */
export function FeatureTree() {
	const data = useStore((s) => s.data)
	const selectedIds = useStore((s) => s.selectedIds)
	const filteredIds = useStore((s) => s.filteredIds)
	const setSelected = useStore((s) => s.setSelected)
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
	const [scrollTop, setScrollTop] = useState(0)
	const viewportRef = useRef<HTMLDivElement | null>(null)

	const visibleFeatures = useMemo(() => {
		if (!filteredIds) return data.features
		const set = new Set(filteredIds)
		return data.features.filter((f) => set.has(String(f.id)))
	}, [data, filteredIds])

	const rows = useMemo<Row[]>(() => {
		const out: Row[] = []
		for (const f of visibleFeatures) {
			const id = String(f.id)
			out.push({ kind: "feature", feature: f, id })
			if (expanded.has(id)) {
				out.push({
					kind: "detail",
					id: `${id}:geometry`,
					parentId: id,
					text: `Geometry \u00b7 ${f.geometry?.type ?? "null"}`,
				})
				const props = (f.properties ?? {}) as Record<string, unknown>
				const keys = Object.keys(props)
				out.push({
					kind: "detail",
					id: `${id}:props`,
					parentId: id,
					text: `Properties \u00b7 ${keys.length}`,
				})
				for (const k of keys.slice(0, 25)) {
					out.push({
						kind: "detail",
						id: `${id}:prop:${k}`,
						parentId: id,
						text: `${k} = ${JSON.stringify(props[k])}`,
					})
				}
			}
		}
		return out
	}, [visibleFeatures, expanded])

	const viewportHeight = viewportRef.current?.clientHeight ?? 600
	const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
	const endIndex = Math.min(
		rows.length,
		Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN,
	)
	const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

	const toggleExpand = (id: string) => {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	return (
		<div className="feature-tree" data-testid="feature-tree">
			<div className="tree-header">
				EXPLORER
				<span className="tree-count">
					{visibleFeatures.length}
					{filteredIds ? ` / ${data.features.length}` : ""} features
				</span>
			</div>
			<div
				className="tree-viewport"
				ref={viewportRef}
				onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
			>
				<div className="tree-spacer" style= height: rows.length * ROW_HEIGHT >
					{rows.slice(startIndex, endIndex).map((row, i) => {
						const top = (startIndex + i) * ROW_HEIGHT
						if (row.kind === "detail") {
							return (
								<div
									key={row.id}
									className="tree-row tree-detail"
									style= top, height: ROW_HEIGHT 
								>
									{row.text}
								</div>
							)
						}
						const f = row.feature
						const props = (f.properties ?? {}) as Record<string, unknown>
						const label = props.name != null ? String(props.name) : row.id
						const icon = TYPE_ICONS[f.geometry?.type ?? ""] ?? "\u2b1a"
						return (
							<div
								key={row.id}
								className={`tree-row tree-feature${selectedSet.has(row.id) ? " selected" : ""}`}
								style= top, height: ROW_HEIGHT 
								onClick={(e) => setSelected([row.id], e.ctrlKey || e.metaKey)}
							>
								<button
									className="tree-toggle"
									onClick={(e) => {
										e.stopPropagation()
										toggleExpand(row.id)
									}}
									aria-label="Toggle details"
								>
									{expanded.has(row.id) ? "\u25be" : "\u25b8"}
								</button>
								<span className="tree-icon">{icon}</span>
								<span className="tree-label" title={label}>
									{label}
								</span>
								<span className="tree-type">{f.geometry?.type ?? "null"}</span>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}
