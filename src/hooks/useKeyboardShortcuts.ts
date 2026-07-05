import { useEffect } from "react"
import { useStore } from "../store/useStore"

/**
 * Global VS Code-style shortcuts:
 * Ctrl+S save · Ctrl+Z undo · Ctrl+Y / Ctrl+Shift+Z redo · Delete remove
 * Ctrl+C copy · Ctrl+V paste · Ctrl+D duplicate · Ctrl+A select all
 * (ignored while typing in the code editor or inputs)
 */
export function useKeyboardShortcuts(): void {
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null
			const inEditor = !!target?.closest?.(".monaco-editor")
			const inInput = !!target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
			const mod = e.ctrlKey || e.metaKey
			const store = useStore.getState()
			const key = e.key.toLowerCase()

			if (mod && key === "s") {
				e.preventDefault()
				store.saveNow()
				return
			}
			if (inEditor || inInput) return

			if (mod && key === "z") {
				e.preventDefault()
				if (e.shiftKey) store.redo()
				else store.undo()
				return
			}
			if (mod && key === "y") {
				e.preventDefault()
				store.redo()
				return
			}
			if (mod && key === "a") {
				e.preventDefault()
				store.selectAll()
				return
			}
			if (mod && key === "c") {
				store.copySelected()
				return
			}
			if (mod && key === "v") {
				store.paste()
				return
			}
			if (mod && key === "d") {
				e.preventDefault()
				store.duplicateSelected()
				return
			}
			if (key === "delete" || key === "backspace") {
				store.deleteSelected()
			}
		}
		window.addEventListener("keydown", handler)
		return () => window.removeEventListener("keydown", handler)
	}, [])
}
