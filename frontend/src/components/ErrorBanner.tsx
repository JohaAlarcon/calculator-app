interface ErrorBannerProps {
  message: string | null
}

/** Explains why the display shows "Error"; announced to assistive technology. */
export function ErrorBanner({ message }: ErrorBannerProps) {
  if (message === null) return null
  return (
    <p className="error-banner" role="alert">
      {message}
    </p>
  )
}
