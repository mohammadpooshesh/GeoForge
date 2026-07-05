import type { Feature } from "geojson"
import { useState } from "react"
import { useStore } from "../store/useStore"

type PropType = "string" | "number" | "boolean"

function typeOf(v: unknown): PropType {
	if (typeof v === "number") return "number"
	if (typeof v === "boolean") return "boolean"
	return "string"
}

function coerce(raw: string, type: PropType): string | number | boolean {
	if (type === "number") {
		const n = Number(raw)
		return Number.isFinite(n) ? n : 0
	}
	if (type === "boolean") return raw === "true" || raw === "1"
	return raw
}

/**
 * Spreadsheet-like editor for the selected feature's properties:
 * add / rename / delete fields, change types, and sort keys.
 */
export function PropertyGrid() {
	const data = useStore((s) => s.data)
	const selectedIds = useStore((s) => s.selectedIds)
	const applyData = useStore((s) => s.applyData)
	const [newKey, setNewKey] = useState("")

	const feature =
		selectedIds.length === 1
			? data.features.find((f) => String(f.id) === selectedIds[0])
			: undefined

	if (!feature) {
		return (
			<div className="property-grid empty" data-testid="property-grid">
				{selectedIds.length > 1
					? `${selectedIds.length} features selected`
					: "Select a single feature to edit its properties"}
			</div>
		)
	}

	const props = (feature.properties ?? {}) as Record<string, unknown>
	const entries = Object.entries(props)

	const commit = (nextProps: Record<string, unknown>, message: string) => {
		const features = data.features.map((f): Feature => {
			if (String(f.id) !== String(feature.id)) return f
			return { ...f, properties: nextProps as Feature["properties"] }
		})
		applyData({ type: "FeatureCollection", features }, { message })
	}

	const renameKey = (oldKey: string, next: string) => {
		const trimmed = next.trim()
		if (!trimmed || trimmed === oldKey || trimmed in props) return
		const nextProps: Record<string, unknown> = {}
		for (const [k, v] of entries) nextProps[k === oldKey ? trimmed : k] = v
		commit(nextProps, `Renamed property "${oldKey}" \u2192 "${trimmed}"`)
	}

	return (
		<div className="property-grid" data-testid="property-grid">
			<table>
				<thead>
					<tr>
						<th>Field</th>
						<th>Value</th>
						<th>Type</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{entries.map(([key, value]) => (
						<tr key={`${feature.id}:${key}`}>
							<td>
								<input
									defaultValue={key}
									onBlur={(e) => renameKey(key, e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") (e.target as HTMLInputElement).blur()
									}}
								/>
							</td>
							<td>
								<input
									defaultValue={String(value ?? "")}
									onBlur={(e) => {
										const next = coerce(e.target.value, typeOf(value))
										if (next === value) return
										commit({ ...props, [key]: next }, `Updated "${key}"`)
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter") (e.target as HTMLInputElement).blur()
									}}
								/>
							</td>
							<td>
								<select
									value={typeOf(value)}
									onChange={(e) => {
										const nextType = e.target.value as PropType
										commit(
											{ ...props, [key]: coerce(String(value ?? ""), nextType) },
											`Changed type of "${key}" to ${nextType}`,
										)
									}}
								>
									<option value="string">str</option>
									<option value="number">num</option>
									<option value="boolean">bool</option>
								</select>
							</td>
							<td>
								<button
									className="icon-button"
									title={`Delete "${key}"`}
									onClick={() => {
										const nextProps = { ...props }
										delete nextProps[key]
										commit(nextProps, `Deleted property "${key}"`)
									}}
								>
									×
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<div className="property-actions">
				<input
					placeholder="new field name"
					value={newKey}
					onChange={(e) => setNewKey(e.target.value)}
					onKeyDown={(e) => {
						if (e.key !== "Enter") return
						const key = newKey.trim()
						if (!key || key in props) return
						commit({ ...props, [key]: "" }, `Added property "${key}"`)
						setNewKey("")
					}}
				/>
				<button
					onClick={() => {
						const key = newKey.trim()
						if (!key || key in props) return
						commit({ ...props, [key]: "" }, `Added property "${key}"`)
						setNewKey("")
					}}
				>
					Add Field
				</button>
				<button
					onClick={() => {
						const sorted = Object.fromEntries(
							entries.slice().sort(([a], [b]) => a.localeCompare(b)),
						)
						commit(sorted, "Sorted properties")
					}}
				>
					Sort
				</button>
			</div>
		</div>
	)
}
