import { useCallback, useEffect, useRef, useState } from 'react'
// onResult is kept in a ref so changing it doesn't restart the camera stream.
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

const HINTS = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E],
  ],
])

export type ScannerStatus = 'idle' | 'starting' | 'scanning' | 'error'

/**
 * Camera barcode scanner (EAN/UPC) via ZXing. `start()` MUST be called from a user gesture
 * (iOS requirement). Uses the rear camera; tears down the stream on stop/unmount (iOS leaks
 * the camera/LED otherwise). Requires HTTPS — localhost is exempt for dev.
 */
export function useBarcodeScanner(onResult: (code: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  const [status, setStatus] = useState<ScannerStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    const stream = videoRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((t) => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [])

  const start = useCallback(async () => {
    if (!videoRef.current) return
    setStatus('starting')
    setError(null)
    try {
      readerRef.current ??= new BrowserMultiFormatReader(HINTS)
      controlsRef.current = await readerRef.current.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result) => {
          if (result) onResultRef.current(result.getText())
        },
      )
      setStatus('scanning')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Camera unavailable')
      setStatus('error')
    }
  }, [])

  useEffect(() => () => stop(), [stop])

  return { videoRef, status, error, start, stop }
}
