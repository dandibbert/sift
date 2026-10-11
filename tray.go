package main

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"math"
)

// trayIcon draws a 36×36 (18 pt) template magnifier: a ring and a handle,
// anti-aliased by coverage so it sits crisply in the menu bar.
func trayIcon() []byte {
	const size = 36
	img := image.NewNRGBA(image.Rect(0, 0, size, size))
	cx, cy, r, stroke := 15.0, 15.0, 9.0, 3.2
	// The handle runs from the ring's edge toward the bottom-right corner.
	hx0, hy0 := cx+r*math.Cos(math.Pi/4), cy+r*math.Sin(math.Pi/4)
	hx1, hy1 := 30.0, 30.0
	const samples = 4
	for y := range size {
		for x := range size {
			hit := 0
			for sy := range samples {
				for sx := range samples {
					px := float64(x) + (float64(sx)+0.5)/samples
					py := float64(y) + (float64(sy)+0.5)/samples
					d := math.Hypot(px-cx, py-cy)
					if math.Abs(d-r) <= stroke/2 || segmentDist(px, py, hx0, hy0, hx1, hy1) <= stroke/2+0.4 {
						hit++
					}
				}
			}
			if hit > 0 {
				img.SetNRGBA(x, y, color.NRGBA{A: uint8(255 * hit / (samples * samples))})
			}
		}
	}
	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
}

func segmentDist(px, py, x0, y0, x1, y1 float64) float64 {
	dx, dy := x1-x0, y1-y0
	t := ((px-x0)*dx + (py-y0)*dy) / (dx*dx + dy*dy)
	t = math.Max(0, math.Min(1, t))
	return math.Hypot(px-(x0+t*dx), py-(y0+t*dy))
}
