import { useRef, useState } from "react"
import { useStore, type Tool } from "../store/useStore"
import { download, serializeMinified, serializePretty } from "../utils/geo"
import { GeometryTools } from "./GeometryTools"

const DRAW_TOOLS: Array<{ id: Tool; label: string; title: string }> = [
	{ id: "select", label: "\u2196", title: "Select / edit (drag vertices, move features)" },
	{ id: "point", label: "\u25c9", title: "Draw Point" },
	{ id: "line", label: "\u2500", title: "Draw LineString" },
	{ id: "polygon", label: "\u2b20", title: "Draw Polygon" },
	{ id: "rectangle", label: "\u25ad", title: "Draw Rectangle" },
	{ id: "circle", label: "\u25cb", title: "Draw Circle (saved as Polygon)" },
]

export function Toolbar() {
	const activeTool = useStore((s) => s.activeTool)
	const setActiveTool = useStore((s) => s.setActiveTool)
	const theme = useStore((s) => s.theme)
	const setTheme = useStore((s) => s.setTheme)
	const historyIndex = useStore((s) => s.historyIndex)
	const historyLength = useStore((s) => s.history.length)
	const filterExpr = useStore((s) => s.filterExpr)
	const fileInputRef = useRef<HTMLInputElement | null>(null)
	const [exportOpen, setExportOpen] = useState(false)
	const [search, setSearch] = useState("")

	const runSearch = () => {
		const q = search.trim().toLowerCase()
		const { data, setSelected, setStatus } = useStore.getState()
		if (!q) return
		const ids = data.features
			.filter((f) => {
				if (String(f.id).toLowerCase().includes(q)) return true
				const props = (f.properties ?? {}) as Record<string, unknown>
				return Object.entries(props).some(
					([k, v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q),
				)
			})
			.map((f) => String(f.id))
		setSelected(ids)
		setStatus(ids.length ? `Found ${ids.length} feature(s) for "${search}"` : `No match for "${search}"`)
	}

	const exportAs = (kind: "pretty" | "minified" | "json") => {
		const { data } = useStore.getState()
		if (kind === "minified") download("geoforge-export.min.geojson", serializeMinified(data), "application/geo+json")
		else if (kind === "json") download("geoforge-export.json", serializePretty(data), "application/json")
		else download("geoforge-export.geojson", serializePretty(data), "application/geo+json")
		setExportOpen(false)
	}

	return (
		<header className="toolbar" data-testid="toolbar">
			<div className="brand">
				<img src="./favicon.svg" alt="" width={20} height={20} />
				<span className="brand-name">GeoForge</span>
				<span className="brand-tag">The Modern GeoJSON Editor</span>
			</div>

			<div className="toolbar-group">
				<button className="toolbar-button" title="Open .geojson / .json" onClick={() => fileInputRef.current?.click()}>
					Open
				</button>
				<input
					ref={fileInputRef}
					type="file"
					accept=".json,.geojson,application/geo+json,application/json"
					hidden
					onChange={async (e) => {
						const file = e.target.files?.[0]
						if (!file) return
						const text = await file.text()
						useStore.getState().loadText(text, `Opened ${file.name}`)
						e.target.value = ""
					}}
				/>
				<div className="dropdown">
					<button className="toolbar-button" onClick={() => setExportOpen((v) => !v)}>
						Export
					</button>
					{exportOpen && (
						<div className="dropdown-menu">
							<button onClick={() => exportAs("pretty")}>GeoJSON (pretty)</button>
							<button onClick={() => exportAs("minified")}>GeoJSON (minified)</button>
							<button onClick={() => exportAs("json")}>JSON</button>
						</div>
					)}
				</div>
				<button className="toolbar-button" title="Beautify JSON" onClick={() => useStore.getState().formatText(true)}>
					Format
				</button>
				<button className="toolbar-button" title="Minify JSON" onClick={() => useStore.getState().formatText(false)}>
					Minify
				</button>
			</div>

			<div className="toolbar-group">
				<button
					className="toolbar-button"
					title="Undo (Ctrl+Z)"
					disabled={historyIndex <= 0}
					onClick={() => useStore.getState().undo()}
				>
					{"\u21a9"} Undo
				</button>
				<button
					className="toolbar-button"
					title="Redo (Ctrl+Y)"
					disabled={historyIndex >= historyLength - 1}
					onClick={() => useStore.getState().redo()}
				>
					{"\u21aa"} Redo
				</button>
			</div>

			<div className="toolbar-group" data-testid="draw-tools">
				{DRAW_TOOLS.map((tool) => (
					<button
						key={tool.id}
						className={`toolbar-button tool${activeTool === tool.id ? " active" : ""}`}
						title={tool.title}
						onClick={() => setActiveTool(tool.id)}
					>
						{tool.label}
					</button>
				))}
				<button
					className="toolbar-button"
					title="Duplicate selected (Ctrl+D)"
					onClick={() => useStore.getState().duplicateSelected()}
				>
					Duplicate
				</button>
				<button
					className="toolbar-button"
					title="Delete selected (Del)"
					onClick={() => useStore.getState().deleteSelected()}
				>
					Delete
				</button>
				<GeometryTools />
			</div>

			<div className="toolbar-group grow">
				<input
					className="toolbar-input"
					placeholder="Search feature / property / value…"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") runSearch()
					}}
					data-testid="search-input"
				/>
				<input
					className="toolbar-input"
					placeholder='Filter: population > 10000 · type == park'
					defaultValue={filterExpr}
					onChange={(e) => {
						const value = e.target.value
						window.setTimeout(() => {
							if (value === (e.target as HTMLInputElement).value) {
								useStore.getState().setFilterExpr(value)
							}
						}, 300)
					}}
					data-testid="filter-input"
				/>
			</div>

			<button
				className="toolbar-button"
				title="Toggle dark / light mode"
				onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
				data-testid="theme-toggle"
			>
				{theme === "dark" ? "\u2600" : "\u263e"}
			</button>
		</header>
	)
}
