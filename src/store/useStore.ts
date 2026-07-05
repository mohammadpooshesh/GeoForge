import type { Feature, FeatureCollection } from "geojson"
import { create } from "zustand"
import { applyFilter } from "../utils/filter"
import { ensureIds, generateId, SAMPLE_DATA, serializeMinified, serializePretty } from "../utils/geo"
import { hasErrors, validateGeoJSON, type ValidationIssue } from "../utils/validation"

export type Theme = "dark" | "light"
export type Tool = "select" | "point" | "line" | "polygon" | "rectangle" | "circle"

const STORAGE_KEY = "geoforge:document"
const THEME_KEY = "geoforge:theme"
const MAX_HISTORY = 200

function safeLocalStorage(): Storage | null {
	try {
		if (typeof localStorage !== "undefined") return localStorage
	} catch {
		/* not available (tests / SSR) */
	}
	return null
}

function persist(text: string): void {
	try {
		safeLocalStorage()?.setItem(STORAGE_KEY, text)
	} catch {
		/* quota exceeded — ignore */
	}
}

function initialText(): string {
	const saved = safeLocalStorage()?.getItem(STORAGE_KEY)
	if (saved) return saved
	return serializePretty(ensureIds(SAMPLE_DATA))
}

function initialTheme(): Theme {
	const saved = safeLocalStorage()?.getItem(THEME_KEY)
	return saved === "light" ? "light" : "dark"
}

export interface GeoForgeStore {
	text: string
	data: FeatureCollection
	issues: ValidationIssue[]
	valid: boolean
	selectedIds: string[]
	activeTool: Tool
	filterExpr: string
	filteredIds: string[] | null
	theme: Theme
	statusMessage: string
	cursor: [number, number] | null
	zoom: number
	center: [number, number]
	clipboard: string | null
	history: string[]
	historyIndex: number
	/** Bumped whenever data changes from a non-map source, so the map re-syncs. */
	mapSyncCounter: number

	setTextFromEditor: (text: string) => void
	applyData: (data: FeatureCollection, options?: { source?: "map" | "app"; message?: string }) => void
	loadText: (text: string, label?: string) => void
	setSelected: (ids: string[], additive?: boolean) => void
	selectAll: () => void
	deleteSelected: () => void
	duplicateSelected: () => void
	copySelected: () => void
	paste: () => void
	undo: () => void
	redo: () => void
	setActiveTool: (tool: Tool) => void
	setFilterExpr: (expr: string) => void
	setTheme: (theme: Theme) => void
	setStatus: (msg: string) => void
	setCursor: (c: [number, number] | null) => void
	setView: (zoom: number, center: [number, number]) => void
	formatText: (pretty: boolean) => void
	saveNow: () => void
}

function pushHistory(
	s: { history: string[]; historyIndex: number },
	text: string,
): Partial<Pick<GeoForgeStore, "history" | "historyIndex">> {
	if (s.history[s.historyIndex] === text) return {}
	const history = s.history
		.slice(0, s.historyIndex + 1)
		.concat(text)
		.slice(-MAX_HISTORY)
	return { history, historyIndex: history.length - 1 }
}

const startText = initialText()
const startValidation = validateGeoJSON(startText)
const startData: FeatureCollection = startValidation.data
	? ensureIds(startValidation.data)
	: { type: "FeatureCollection", features: [] }

export const useStore = create<GeoForgeStore>((set, get) => {
	const restore = (text: string, index: number): void => {
		const { data, issues } = validateGeoJSON(text)
		set((s) => ({
			text,
			historyIndex: index,
			issues,
			valid: data !== null && !hasErrors(issues),
			selectedIds: [],
			...(data
				? {
						data: ensureIds(data),
						mapSyncCounter: s.mapSyncCounter + 1,
						filteredIds: s.filterExpr ? applyFilter(ensureIds(data), s.filterExpr) : null,
					}
				: {}),
		}))
		persist(text)
	}

	return {
		text: startText,
		data: startData,
		issues: startValidation.issues,
		valid: startValidation.data !== null && !hasErrors(startValidation.issues),
		selectedIds: [],
		activeTool: "select",
		filterExpr: "",
		filteredIds: null,
		theme: initialTheme(),
		statusMessage: "Ready",
		cursor: null,
		zoom: 2,
		center: [0, 20],
		clipboard: null,
		history: [startText],
		historyIndex: 0,
		mapSyncCounter: 0,

		setTextFromEditor: (text) => {
			const { data, issues } = validateGeoJSON(text)
			const ok = data !== null && !hasErrors(issues)
			set((s) => ({
				text,
				issues,
				valid: ok,
				...(ok && data
					? {
							data: ensureIds(data),
							mapSyncCounter: s.mapSyncCounter + 1,
							filteredIds: s.filterExpr ? applyFilter(ensureIds(data), s.filterExpr) : null,
						}
					: {}),
				...pushHistory(s, text),
			}))
			persist(text)
		},

		applyData: (data, options = {}) => {
			const normalized = ensureIds(data)
			const text = serializePretty(normalized)
			const { issues } = validateGeoJSON(text)
			set((s) => ({
				data: normalized,
				text,
				issues,
				valid: !hasErrors(issues),
				filteredIds: s.filterExpr ? applyFilter(normalized, s.filterExpr) : null,
				statusMessage: options.message ?? s.statusMessage,
				mapSyncCounter: options.source === "map" ? s.mapSyncCounter : s.mapSyncCounter + 1,
				...pushHistory(s, text),
			}))
			persist(text)
		},

		loadText: (text, label) => {
			const { data, issues } = validateGeoJSON(text)
			const ok = data !== null && !hasErrors(issues)
			set((s) => ({
				text,
				issues,
				valid: ok,
				selectedIds: [],
				statusMessage: label ?? "Loaded document",
				...(data
					? {
							data: ensureIds(data),
							mapSyncCounter: s.mapSyncCounter + 1,
							filteredIds: s.filterExpr ? applyFilter(ensureIds(data), s.filterExpr) : null,
						}
					: {}),
				...pushHistory(s, text),
			}))
			persist(text)
		},

		setSelected: (ids, additive = false) => {
			set((s) => {
				if (!additive) return { selectedIds: ids }
				const next = new Set(s.selectedIds)
				for (const id of ids) {
					if (next.has(id)) next.delete(id)
					else next.add(id)
				}
				return { selectedIds: [...next] }
			})
		},

		selectAll: () => {
			const { data, filteredIds } = get()
			const ids = filteredIds ?? data.features.map((f) => String(f.id))
			set({ selectedIds: [...ids], statusMessage: `Selected ${ids.length} feature(s)` })
		},

		deleteSelected: () => {
			const { data, selectedIds, applyData } = get()
			if (!selectedIds.length) return
			const removeSet = new Set(selectedIds)
			const features = data.features.filter((f) => !removeSet.has(String(f.id)))
			set({ selectedIds: [] })
			applyData(
				{ type: "FeatureCollection", features },
				{ message: `Deleted ${removeSet.size} feature(s)` },
			)
		},

		duplicateSelected: () => {
			const { data, selectedIds, applyData } = get()
			if (!selectedIds.length) return
			const selectedSet = new Set(selectedIds)
			const clones: Feature[] = data.features
				.filter((f) => selectedSet.has(String(f.id)))
				.map((f) => ({ ...structuredClone(f), id: generateId() }))
			applyData(
				{ type: "FeatureCollection", features: data.features.concat(clones) },
				{ message: `Duplicated ${clones.length} feature(s)` },
			)
			set({ selectedIds: clones.map((f) => String(f.id)) })
		},

		copySelected: () => {
			const { data, selectedIds } = get()
			if (!selectedIds.length) return
			const selectedSet = new Set(selectedIds)
			const features = data.features.filter((f) => selectedSet.has(String(f.id)))
			set({ clipboard: JSON.stringify(features), statusMessage: `Copied ${features.length} feature(s)` })
		},

		paste: () => {
			const { clipboard, data, applyData } = get()
			if (!clipboard) return
			try {
				const features = JSON.parse(clipboard) as Feature[]
				const pasted = features.map((f) => ({ ...f, id: generateId() }))
				applyData(
					{ type: "FeatureCollection", features: data.features.concat(pasted) },
					{ message: `Pasted ${pasted.length} feature(s)` },
				)
				set({ selectedIds: pasted.map((f) => String(f.id)) })
			} catch {
				set({ statusMessage: "Clipboard does not contain valid features" })
			}
		},

		undo: () => {
			const { history, historyIndex } = get()
			if (historyIndex <= 0) return
			restore(history[historyIndex - 1], historyIndex - 1)
			set({ statusMessage: "Undo" })
		},

		redo: () => {
			const { history, historyIndex } = get()
			if (historyIndex >= history.length - 1) return
			restore(history[historyIndex + 1], historyIndex + 1)
			set({ statusMessage: "Redo" })
		},

		setActiveTool: (tool) => set({ activeTool: tool }),

		setFilterExpr: (expr) => {
			const { data } = get()
			set({
				filterExpr: expr,
				filteredIds: expr.trim() ? applyFilter(data, expr) : null,
			})
		},

		setTheme: (theme) => {
			safeLocalStorage()?.setItem(THEME_KEY, theme)
			set({ theme })
		},

		setStatus: (msg) => set({ statusMessage: msg }),
		setCursor: (c) => set({ cursor: c }),
		setView: (zoom, center) => set({ zoom, center }),

		formatText: (pretty) => {
			const { data, valid } = get()
			if (!valid) {
				set({ statusMessage: "Fix validation errors before formatting" })
				return
			}
			const text = pretty ? serializePretty(data) : serializeMinified(data)
			set((s) => ({
				text,
				statusMessage: pretty ? "Formatted (pretty)" : "Minified",
				...pushHistory(s, text),
			}))
			persist(text)
		},

		saveNow: () => {
			persist(get().text)
			set({ statusMessage: "Saved to browser storage" })
		},
	}
})
