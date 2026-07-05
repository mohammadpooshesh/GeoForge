import MapboxDraw from "@mapbox/mapbox-gl-draw"
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css"
import * as turf from "@turf/turf"
import type { FeatureCollection } from "geojson"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { useEffect, useRef, useState } from "react"
import { useStore, type Theme, type Tool } from "../store/useStore"

// --- Make mapbox-gl-draw play nicely with MapLibre GL ---
const DrawCtor = MapboxDraw as unknown as {
	constants: { classes: Record<string, string> }
	modes: Record<string, unknown>
	new (options?: Record<string, unknown>): unknown
}
try {
	DrawCtor.constants.classes.CANVAS = "maplibregl-canvas"
	DrawCtor.constants.classes.CONTROL_BASE = "maplibregl-ctrl"
	DrawCtor.constants.classes.CONTROL_PREFIX = "maplibregl-ctrl-"
	DrawCtor.constants.classes.CONTROL_GROUP = "maplibregl-ctrl-group"
	DrawCtor.constants.classes.ATTRIBUTION = "maplibregl-ctrl-attrib"
} catch {
	/* constants shape changed — defaults still mostly work */
}

function baseStyle(theme: Theme): maplibregl.StyleSpecification {
	const variant = theme === "dark" ? "dark_all" : "light_all"
	return {
		version: 8,
		sources: {
			carto: {
				type: "raster",
				tiles: ["a", "b", "c", "d"].map(
					(s) => `https://${s}.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`,
				),
				tileSize: 256,
				attribution: "\u00a9 OpenStreetMap contributors \u00a9 CARTO",
			},
		},
		layers: [
			{
				id: "background",
				type: "background",
				paint: { "background-color": theme === "dark" ? "#0b0e14" : "#e8ecef" },
			},
			{ id: "carto", type: "raster", source: "carto" },
		],
	}
}

/* Two-click rectangle draw mode */
function createRectangleMode(): Record<string, unknown> {
	return {
		onSetup(this: any) {
			const rect = this.newFeature({
				type: "Feature",
				properties: {},
				geometry: { type: "Polygon", coordinates: [[]] },
			})
			this.addFeature(rect)
			this.clearSelectedFeatures()
			this.updateUIClasses({ mouse: "add" })
			this.setActionableState({ trash: true })
			return { rect, startPoint: null, finished: false }
		},
		onClick(this: any, state: any, e: any) {
			if (!state.startPoint) {
				state.startPoint = [e.lngLat.lng, e.lngLat.lat]
				return
			}
			state.finished = true
			this.changeMode("simple_select", { featureIds: [state.rect.id] })
		},
		onMouseMove(this: any, state: any, e: any) {
			if (!state.startPoint) return
			const [x0, y0] = state.startPoint
			const x1 = e.lngLat.lng
			const y1 = e.lngLat.lat
			state.rect.setCoordinates([
				[
					[x0, y0],
					[x1, y0],
					[x1, y1],
					[x0, y1],
					[x0, y0],
				],
			])
		},
		onKeyUp(this: any, _state: any, e: any) {
			if (e.keyCode === 27) this.changeMode("simple_select")
		},
		onStop(this: any, state: any) {
			this.updateUIClasses({ mouse: "none" })
			if (!state.finished) {
				this.deleteFeature([state.rect.id], { silent: true })
				return
			}
			this.map.fire("draw.create", { features: [state.rect.toGeoJSON()] })
		},
		toDisplayFeatures(_state: any, geojson: any, display: (f: any) => void) {
			display(geojson)
		},
	}
}

/* Center + radius circle mode (saved as a Polygon) */
function createCircleMode(): Record<string, unknown> {
	return {
		onSetup(this: any) {
			const circle = this.newFeature({
				type: "Feature",
				properties: {},
				geometry: { type: "Polygon", coordinates: [[]] },
			})
			this.addFeature(circle)
			this.clearSelectedFeatures()
			this.updateUIClasses({ mouse: "add" })
			this.setActionableState({ trash: true })
			return { circle, center: null, finished: false }
		},
		onClick(this: any, state: any, e: any) {
			if (!state.center) {
				state.center = [e.lngLat.lng, e.lngLat.lat]
				return
			}
			state.finished = true
			this.changeMode("simple_select", { featureIds: [state.circle.id] })
		},
		onMouseMove(this: any, state: any, e: any) {
			if (!state.center) return
			const radius = turf.distance(state.center, [e.lngLat.lng, e.lngLat.lat], {
				units: "kilometers",
			})
			if (radius <= 0) return
			const ring = turf.circle(state.center, radius, { steps: 64, units: "kilometers" }).geometry
				.coordinates
			state.circle.setCoordinates(ring)
			state.circle.setProperty("radius_km", Number(radius.toFixed(3)))
			state.circle.setProperty("geoforge_shape", "circle")
		},
		onKeyUp(this: any, _state: any, e: any) {
			if (e.keyCode === 27) this.changeMode("simple_select")
		},
		onStop(this: any, state: any) {
			this.updateUIClasses({ mouse: "none" })
			if (!state.finished) {
				this.deleteFeature([state.circle.id], { silent: true })
				return
			}
			this.map.fire("draw.create", { features: [state.circle.toGeoJSON()] })
		},
		toDisplayFeatures(_state: any, geojson: any, display: (f: any) => void) {
			display(geojson)
		},
	}
}

const MODE_BY_TOOL: Record<Tool, string> = {
	select: "simple_select",
	point: "draw_point",
	line: "draw_line_string",
	polygon: "draw_polygon",
	rectangle: "draw_rectangle",
	circle: "draw_circle",
}

function fitToData(map: maplibregl.Map, data: FeatureCollection): void {
	if (!data.features.length) return
	try {
		const [minX, minY, maxX, maxY] = turf.bbox(data)
		if ([minX, minY, maxX, maxY].every(Number.isFinite)) {
			map.fitBounds(
				[
					[minX, minY],
					[maxX, maxY],
				],
				{ padding: 60, maxZoom: 14, duration: 0 },
			)
		}
	} catch {
		/* empty/degenerate bbox */
	}
}

export function MapView() {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const mapRef = useRef<maplibregl.Map | null>(null)
	const drawRef = useRef<any>(null)
	const loadedRef = useRef(false)
	const themeRef = useRef<Theme | null>(null)
	const [mapError, setMapError] = useState<string | null>(null)

	const mapSyncCounter = useStore((s) => s.mapSyncCounter)
	const filteredIds = useStore((s) => s.filteredIds)
	const selectedIds = useStore((s) => s.selectedIds)
	const activeTool = useStore((s) => s.activeTool)
	const theme = useStore((s) => s.theme)

	// ---- init map (once) ----
	useEffect(() => {
		if (!containerRef.current || mapRef.current) return
		const store = useStore.getState()
		themeRef.current = store.theme

		let map: maplibregl.Map
		try {
			map = new maplibregl.Map({
				container: containerRef.current,
				style: baseStyle(store.theme),
				center: store.center,
				zoom: store.zoom,
				attributionControl: false,
			})
		} catch (err) {
			setMapError(`Map unavailable: ${(err as Error).message}`)
			useStore.getState().setStatus("Map unavailable (WebGL not supported) \u2014 editor still works")
			return
		}
		mapRef.current = map
		map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right")
		map.addControl(new maplibregl.AttributionControl({ compact: true }))

		const draw = new (DrawCtor as any)({
			displayControlsDefault: false,
			userProperties: true,
			modes: {
				...(DrawCtor.modes as Record<string, unknown>),
				draw_rectangle: createRectangleMode(),
				draw_circle: createCircleMode(),
			},
		})
		drawRef.current = draw
		map.addControl(draw)

		const syncFromDraw = () => {
			const state = useStore.getState()
			const drawn = draw.getAll() as FeatureCollection
			let features = drawn.features
			if (state.filteredIds) {
				// hidden (filtered-out) features must survive map edits
				const visible = new Set(state.filteredIds)
				const hidden = state.data.features.filter((f) => !visible.has(String(f.id)))
				features = hidden.concat(drawn.features)
			}
			state.applyData({ type: "FeatureCollection", features }, { source: "map", message: "Map edit" })
		}

		map.on("draw.create" as any, () => {
			syncFromDraw()
			useStore.getState().setActiveTool("select")
		})
		map.on("draw.update" as any, syncFromDraw)
		map.on("draw.delete" as any, syncFromDraw)
		map.on("draw.selectionchange" as any, (e: any) => {
			const ids = (e.features ?? []).map((f: any) => String(f.id))
			useStore.getState().setSelected(ids)
		})
		map.on("mousemove", (e) => useStore.getState().setCursor([e.lngLat.lng, e.lngLat.lat]))
		map.on("move", () => {
			const c = map.getCenter()
			useStore.getState().setView(map.getZoom(), [c.lng, c.lat])
		})
		map.on("load", () => {
			loadedRef.current = true
			try {
				draw.set(useStore.getState().data)
			} catch (err) {
				console.error("draw.set failed", err)
			}
			fitToData(map, useStore.getState().data)
		})

		return () => {
			map.remove()
			mapRef.current = null
			drawRef.current = null
			loadedRef.current = false
		}
	}, [])

	// ---- data / filter -> draw ----
	useEffect(() => {
		const draw = drawRef.current
		if (!draw || !loadedRef.current) return
		const { data } = useStore.getState()
		const visible = filteredIds
			? {
					type: "FeatureCollection" as const,
					features: data.features.filter((f) => new Set(filteredIds).has(String(f.id))),
				}
			: data
		try {
			draw.set(visible)
		} catch (err) {
			console.error("draw.set failed", err)
		}
	}, [mapSyncCounter, filteredIds])

	// ---- selection -> draw ----
	useEffect(() => {
		const draw = drawRef.current
		if (!draw || !loadedRef.current) return
		try {
			const current = draw.getSelectedIds() as string[]
			const same =
				current.length === selectedIds.length && current.every((id) => selectedIds.includes(id))
			if (same) return
			draw.changeMode("simple_select", { featureIds: selectedIds })
			// zoom to the first selected feature when it is off-screen
			if (selectedIds.length) {
				const { data } = useStore.getState()
				const feature = data.features.find((f) => String(f.id) === selectedIds[0])
				const map = mapRef.current
				if (feature?.geometry && map) {
					const [minX, minY, maxX, maxY] = turf.bbox(feature)
					const bounds = map.getBounds()
					if (
						[minX, minY, maxX, maxY].every(Number.isFinite) &&
						(maxX < bounds.getWest() ||
							minX > bounds.getEast() ||
							maxY < bounds.getSouth() ||
							minY > bounds.getNorth())
					) {
						map.fitBounds(
							[
								[minX, minY],
								[maxX, maxY],
							],
							{ padding: 100, maxZoom: 14 },
						)
					}
				}
			}
		} catch (err) {
			console.error("selection sync failed", err)
		}
	}, [selectedIds])

	// ---- active tool -> draw mode ----
	useEffect(() => {
		const draw = drawRef.current
		if (!draw || !loadedRef.current) return
		const target = MODE_BY_TOOL[activeTool]
		try {
			if (draw.getMode() !== target) draw.changeMode(target)
		} catch (err) {
			console.error("changeMode failed", err)
		}
	}, [activeTool])

	// ---- theme -> map style (draw must be re-added after setStyle) ----
	useEffect(() => {
		const map = mapRef.current
		const draw = drawRef.current
		if (!map || !draw || themeRef.current === theme || !loadedRef.current) return
		themeRef.current = theme
		const data = useStore.getState().data
		try {
			map.removeControl(draw)
			map.setStyle(baseStyle(theme))
			map.once("style.load", () => {
				map.addControl(draw)
				try {
					draw.set(data)
				} catch (err) {
					console.error("draw.set after theme change failed", err)
				}
			})
		} catch (err) {
			console.error("theme switch failed", err)
		}
	}, [theme])

	return (
		<div className="map-view" data-testid="map-view">
			<div ref={containerRef} className="map-container" />
			{mapError && <div className="map-error">{mapError}</div>}
		</div>
	)
}
