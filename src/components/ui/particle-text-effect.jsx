import { useEffect, useRef, useState } from "react"

class Particle {
  constructor() {
    this.pos = { x: 0, y: 0 }
    this.vel = { x: 0, y: 0 }
    this.acc = { x: 0, y: 0 }
    this.target = { x: 0, y: 0 }
    this.closeEnoughTarget = 100
    this.maxSpeed = 1.0
    this.maxForce = 0.1
    this.particleSize = 10
    this.isKilled = false
    this.startColor = { r: 0, g: 0, b: 0 }
    this.targetColor = { r: 0, g: 0, b: 0 }
    this.colorWeight = 0
    this.colorBlendRate = 0.01
  }

  move() {
    let proximityMult = 1
    const distance = Math.sqrt(
      Math.pow(this.pos.x - this.target.x, 2) + Math.pow(this.pos.y - this.target.y, 2)
    )

    if (distance < this.closeEnoughTarget) {
      proximityMult = distance / this.closeEnoughTarget
    }

    const towardsTarget = {
      x: this.target.x - this.pos.x,
      y: this.target.y - this.pos.y,
    }

    const magnitude = Math.sqrt(towardsTarget.x * towardsTarget.x + towardsTarget.y * towardsTarget.y)
    if (magnitude > 0) {
      towardsTarget.x = (towardsTarget.x / magnitude) * this.maxSpeed * proximityMult
      towardsTarget.y = (towardsTarget.y / magnitude) * this.maxSpeed * proximityMult
    }

    const steer = {
      x: towardsTarget.x - this.vel.x,
      y: towardsTarget.y - this.vel.y,
    }

    const steerMagnitude = Math.sqrt(steer.x * steer.x + steer.y * steer.y)
    if (steerMagnitude > 0) {
      steer.x = (steer.x / steerMagnitude) * this.maxForce
      steer.y = (steer.y / steerMagnitude) * this.maxForce
    }

    this.acc.x += steer.x
    this.acc.y += steer.y

    this.vel.x += this.acc.x
    this.vel.y += this.acc.y
    this.pos.x += this.vel.x
    this.pos.y += this.vel.y
    this.acc.x = 0
    this.acc.y = 0
  }

  draw(ctx, drawAsPoints) {
    if (this.colorWeight < 1.0) {
      this.colorWeight = Math.min(this.colorWeight + this.colorBlendRate, 1.0)
    }

    const currentColor = {
      r: Math.round(this.startColor.r + (this.targetColor.r - this.startColor.r) * this.colorWeight),
      g: Math.round(this.startColor.g + (this.targetColor.g - this.startColor.g) * this.colorWeight),
      b: Math.round(this.startColor.b + (this.targetColor.b - this.startColor.b) * this.colorWeight),
    }

    if (drawAsPoints) {
      ctx.fillStyle = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`
      ctx.fillRect(this.pos.x, this.pos.y, 2, 2)
    } else {
      ctx.fillStyle = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`
      ctx.beginPath()
      ctx.arc(this.pos.x, this.pos.y, this.particleSize / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  kill(width, height) {
    if (!this.isKilled) {
      const randomPos = this.generateRandomPos(width / 2, height / 2, (width + height) / 2)
      this.target.x = randomPos.x
      this.target.y = randomPos.y

      this.startColor = {
        r: this.startColor.r + (this.targetColor.r - this.startColor.r) * this.colorWeight,
        g: this.startColor.g + (this.targetColor.g - this.startColor.g) * this.colorWeight,
        b: this.startColor.b + (this.targetColor.b - this.startColor.b) * this.colorWeight,
      }
      this.targetColor = { r: 255, g: 255, b: 255 }
      this.colorWeight = 0

      this.isKilled = true
    }
  }

  generateRandomPos(x, y, mag) {
    const randomX = Math.random() * 1000
    const randomY = Math.random() * 500

    const direction = {
      x: randomX - x,
      y: randomY - y,
    }

    const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
    if (magnitude > 0) {
      direction.x = (direction.x / magnitude) * mag
      direction.y = (direction.y / magnitude) * mag
    }

    return {
      x: x + direction.x,
      y: y + direction.y,
    }
  }
}

const TEAL_COLORS = [
  { r: 8, g: 145, b: 178 },
  { r: 34, g: 211, b: 238 },
  { r: 102, g: 165, b: 173 },
  { r: 6, g: 182, b: 212 },
  { r: 45, g: 212, b: 191 },
]

const DEFAULT_WORDS = ["VENDER", "INVENTARIO", "REPORTES", "FACTURAR", "COBRAR"]

function generateRandomPos(x, y, mag) {
  const randomX = Math.random() * 1000
  const randomY = Math.random() * 500

  const direction = {
    x: randomX - x,
    y: randomY - y,
  }

  const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
  if (magnitude > 0) {
    direction.x = (direction.x / magnitude) * mag
    direction.y = (direction.y / magnitude) * mag
  }

  return {
    x: x + direction.x,
    y: y + direction.y,
  }
}

export function ParticleTextEffect({ words = DEFAULT_WORDS, colors = TEAL_COLORS }) {
  const canvasRef = useRef(null)
  const animationRef = useRef()
  const particlesRef = useRef([])
  const frameCountRef = useRef(0)
  const wordIndexRef = useRef(0)
  const colorIndexRef = useRef(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [currentWordIndex, setCurrentWordIndex] = useState(0)

  const pixelSteps = 6
  const drawAsPoints = true

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (e) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion) return

    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const container = canvas.parentElement
      if (container) {
        const containerWidth = container.clientWidth
        const aspectRatio = 2
        canvas.width = Math.min(containerWidth, 1000)
        canvas.height = canvas.width / aspectRatio
      }
    }

    resizeCanvas()

    const nextWord = (word) => {
      const offscreenCanvas = document.createElement("canvas")
      offscreenCanvas.width = canvas.width
      offscreenCanvas.height = canvas.height
      const offscreenCtx = offscreenCanvas.getContext("2d")

      const fontSize = Math.max(40, canvas.width / 8)
      offscreenCtx.fillStyle = "white"
      offscreenCtx.font = `bold ${fontSize}px Inter, Arial, sans-serif`
      offscreenCtx.textAlign = "center"
      offscreenCtx.textBaseline = "middle"
      offscreenCtx.fillText(word, canvas.width / 2, canvas.height / 2)

      const imageData = offscreenCtx.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = imageData.data

      const newColor = colors[colorIndexRef.current % colors.length]
      colorIndexRef.current++

      const particles = particlesRef.current
      let particleIndex = 0

      const coordsIndexes = []
      for (let i = 0; i < pixels.length; i += pixelSteps * 4) {
        coordsIndexes.push(i)
      }

      for (let i = coordsIndexes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [coordsIndexes[i], coordsIndexes[j]] = [coordsIndexes[j], coordsIndexes[i]]
      }

      for (const coordIndex of coordsIndexes) {
        const pixelIndex = coordIndex
        const alpha = pixels[pixelIndex + 3]

        if (alpha > 0) {
          const x = (pixelIndex / 4) % canvas.width
          const y = Math.floor(pixelIndex / 4 / canvas.width)

          let particle

          if (particleIndex < particles.length) {
            particle = particles[particleIndex]
            particle.isKilled = false
            particleIndex++
          } else {
            particle = new Particle()

            const randomPos = generateRandomPos(
              canvas.width / 2,
              canvas.height / 2,
              (canvas.width + canvas.height) / 2
            )
            particle.pos.x = randomPos.x
            particle.pos.y = randomPos.y

            particle.maxSpeed = Math.random() * 6 + 4
            particle.maxForce = particle.maxSpeed * 0.05
            particle.particleSize = Math.random() * 6 + 6
            particle.colorBlendRate = Math.random() * 0.0275 + 0.0025

            particles.push(particle)
          }

          particle.startColor = {
            r: particle.startColor.r + (particle.targetColor.r - particle.startColor.r) * particle.colorWeight,
            g: particle.startColor.g + (particle.targetColor.g - particle.startColor.g) * particle.colorWeight,
            b: particle.startColor.b + (particle.targetColor.b - particle.startColor.b) * particle.colorWeight,
          }
          particle.targetColor = newColor
          particle.colorWeight = 0

          particle.target.x = x
          particle.target.y = y
        }
      }

      for (let i = particleIndex; i < particles.length; i++) {
        particles[i].kill(canvas.width, canvas.height)
      }
    }

    const animate = () => {
      const ctx = canvas.getContext("2d")
      const particles = particlesRef.current

      ctx.fillStyle = "rgba(255, 255, 255, 0.12)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i]
        particle.move()
        particle.draw(ctx, drawAsPoints)

        if (particle.isKilled) {
          if (
            particle.pos.x < 0 ||
            particle.pos.x > canvas.width ||
            particle.pos.y < 0 ||
            particle.pos.y > canvas.height
          ) {
            particles.splice(i, 1)
          }
        }
      }

      frameCountRef.current++
      if (frameCountRef.current % 240 === 0) {
        wordIndexRef.current = (wordIndexRef.current + 1) % words.length
        setCurrentWordIndex(wordIndexRef.current)
        nextWord(words[wordIndexRef.current])
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    nextWord(words[0])
    animate()

    const handleResize = () => {
      resizeCanvas()
      particlesRef.current = []
      frameCountRef.current = 0
      wordIndexRef.current = 0
      nextWord(words[0])
    }

    window.addEventListener("resize", handleResize)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener("resize", handleResize)
    }
  }, [words, colors, prefersReducedMotion])

  if (prefersReducedMotion) {
    return (
      <div className="flex items-center justify-center py-8">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-primary sm:text-6xl">
          {words[currentWordIndex]}
        </h1>
      </div>
    )
  }

  return (
    <div className="relative w-full flex items-center justify-center">
      <div className="relative w-full h-[400px]">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ background: "#ffffff" }}
        />
      </div>
    </div>
  )
}
