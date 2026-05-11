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
    <div className="w-full my-6 flex justify-center">
      <div
        id="container-fc65c42a017e754be7ff51f918dd69cf"
        ref={containerRef}
      />
    </div>
  )
}