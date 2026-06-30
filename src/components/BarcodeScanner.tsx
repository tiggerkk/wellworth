import { useBarcodeScanner } from '../hooks/useBarcodeScanner'

interface BarcodeScannerProps {
  onScan: (code: string) => void
}

/** Live camera barcode scanner. Camera starts on a button tap (iOS requirement). */
export function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const { videoRef, status, error, start } = useBarcodeScanner(onScan)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-card bg-black">
        <video ref={videoRef} playsInline muted className="size-full object-cover" />
        {status !== 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center">
            {status === 'idle' && (
              <button
                onClick={start}
                className="rounded-pill bg-fill px-5 py-2.5 text-body font-medium text-bg"
              >
                Start camera
              </button>
            )}
            {status === 'starting' && (
              <span className="text-body text-text-secondary">Starting…</span>
            )}
            {status === 'error' && (
              <span role="alert" className="px-6 text-center text-body text-danger">
                {error ?? 'Camera unavailable'}
              </span>
            )}
          </div>
        )}
      </div>
      <p className="text-caption text-text-secondary">
        Point the camera at a product barcode.
      </p>
    </div>
  )
}
