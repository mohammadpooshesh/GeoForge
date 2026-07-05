import { useEffect } from "react"
import { CodeEditor } from "./components/CodeEditor"
import { FeatureTree } from "./components/FeatureTree"
import { MapView } from "./components/MapView"
import { PropertyGrid } from "./components/PropertyGrid"
import { StatsPanel } from "./components/StatsPanel"
import { StatusBar } from "./components/StatusBar"
import { Toolbar } from "./components/Toolbar"
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts"
import { useStore } from "./store/useStore"

export default function App() {
	useKeyboardShortcuts()
	const theme = useStore((s) => s.theme)
	const issues = useStore((s) => s.issues)

	useEffect(() => {
		document.documentElement.dataset.theme = theme
	}, [theme])

	return (
		<div className="app">
			<Toolbar />
			<div className="main">
				<aside className="sidebar">
					<FeatureTree />
					<details open className="sidebar-section">
						<summary>PROPERTIES</summary>
						<PropertyGrid />
					</details>
					<details className="sidebar-section">
						<summary>STATISTICS</summary>
						<StatsPanel />
					</details>
					{issues.length > 0 && (
						<details open className="sidebar-section">
							<summary>PROBLEMS ({issues.length})</summary>
							<ul className="problems" data-testid="problems">
								{issues.slice(0, 50).map((issue, i) => (
									<li key={i} className={issue.severity}>
										{issue.severity === "error" ? "\u2716" : "\u26a0"} {issue.message}
										{issue.featureIndex != null && ` (feature ${issue.featureIndex})`}
									</li>
								))}
							</ul>
						</details>
					)}
				</aside>
				<CodeEditor />
				<MapView />
			</div>
			<StatusBar />
		</div>
	)
}
