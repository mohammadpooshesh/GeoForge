import Editor, { type OnMount } from "@monaco-editor/react"
import { useEffect, useRef } from "react"
import { useStore } from "../store/useStore"
import { featureIndexAtOffset, findFeatureRanges } from "../utils/editorRange"

type EditorInstance = Parameters<OnMount>[0]
type MonacoInstance = Parameters<OnMount>[1]

const EDIT_DEBOUNCE_MS = 350

export function CodeEditor() {
	const text = useStore((s) => s.text)
	const theme = useStore((s) => s.theme)
	const selectedIds = useStore((s) => s.selectedIds)
	const editorRef = useRef<EditorInstance | null>(null)
	const monacoRef = useRef<MonacoInstance | null>(null)
	const decorationsRef = useRef<string[]>([])
	const debounceRef = useRef<number | null>(null)
	const suppressCursorSync = useRef(false)

	const handleMount: OnMount = (editor, monaco) => {
		editorRef.current = editor
		monacoRef.current = monaco
		// clicking inside a feature selects it everywhere (tree + map + editor)
		editor.onDidChangeCursorPosition((e) => {
			if (suppressCursorSync.current) return
			if (e.source !== "mouse") return
			const model = editor.getModel()
			if (!model) return
			const state = useStore.getState()
			const offset = model.getOffsetAt(e.position)
			const index = featureIndexAtOffset(state.text, offset)
			if (index < 0 || index >= state.data.features.length) return
			const id = String(state.data.features[index].id)
			if (state.selectedIds.length === 1 && state.selectedIds[0] === id) return
			state.setSelected([id])
		})
	}

	// selection -> highlight + reveal
	useEffect(() => {
		const editor = editorRef.current
		const monaco = monacoRef.current
		if (!editor || !monaco) return
		const model = editor.getModel()
		if (!model) return
		const state = useStore.getState()
		const ranges = findFeatureRanges(state.text)
		const indices = selectedIds
			.map((id) => state.data.features.findIndex((f) => String(f.id) === id))
			.filter((i) => i >= 0 && i < ranges.length)
		const decorations = indices.map((i) => {
			const start = model.getPositionAt(ranges[i].start)
			const end = model.getPositionAt(ranges[i].end)
			return {
				range: new monaco.Range(start.lineNumber, 1, end.lineNumber, 1),
				options: {
					isWholeLine: true,
					className: "gf-selected-line",
					linesDecorationsClassName: "gf-selected-gutter",
				},
			}
		})
		decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations)
		if (indices.length > 0) {
			suppressCursorSync.current = true
			const pos = model.getPositionAt(ranges[indices[0]].start)
			editor.revealLineInCenterIfOutsideViewport(pos.lineNumber)
			suppressCursorSync.current = false
		}
	}, [selectedIds, text])

	return (
		<div className="code-editor" data-testid="code-editor">
			<Editor
				height="100%"
				defaultLanguage="json"
				value={text}
				theme={theme === "dark" ? "vs-dark" : "light"}
				onMount={handleMount}
				onChange={(value) => {
					if (value == null) return
					if (debounceRef.current) window.clearTimeout(debounceRef.current)
					debounceRef.current = window.setTimeout(() => {
						useStore.getState().setTextFromEditor(value)
					}, EDIT_DEBOUNCE_MS)
				}}
				options={{
					minimap: { enabled: false },
					fontSize: 13,
					wordWrap: "off",
					folding: true,
					lineNumbers: "on",
					scrollBeyondLastLine: false,
					automaticLayout: true,
					tabSize: 2,
					renderWhitespace: "none",
				}}
			/>
		</div>
	)
}
