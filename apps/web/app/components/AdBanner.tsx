'use client'

import { useEffect, useRef } from 'react'

export default function AdBanner() {
  const containerRef = useRef<HTMLDivElement>(null)
  const injected = useRef(false)

  useEffect(() => {
    if (injected.current || !containerRef.current) return
    injected.current = true

    const script = document.createElement('script')
    script.src = 'https://pl29414402.profitablecpmratenetwork.com/fc65c42a017e754be7ff51f918dd69cf/invoke.js'
    script.async = true
    script.setAttribute('data-cfasync', 'false')
    containerRef.current.appendChild(script)
  }, [])

  return (
    /*
      Outer wrapper acts as a hard boundary:
      - `relative` + `z-index: 0` creates a new stacking context so the ad
        cannot bleed its z-index onto neighbouring wallpaper cards.
      - `overflow-hidden` clips any oversized ad creative that would
        otherwise extend its hit area outside this box.
      - Clicks inside the ad area are intentionally allowed (pointer-events:auto
        is the default); nothing here blocks legitimate ad clicks.
    */
    <div
      className="relative w-full overflow-hidden rounded-xl"
      style={{ zIndex: 0, isolation: 'isolate' }}
    >
      <div
        id="container-fc65c42a017e754be7ff51f918dd69cf"
        ref={containerRef}
        className="w-full"
      />
    </div>
  )
}