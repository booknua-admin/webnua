import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/ui/BrandMark';
import { Eyebrow } from '@/components/ui/eyebrow';

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-paper px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center text-ink">
        <BrandMark size="lg" className="text-ink" />

        <div className="flex flex-col items-center gap-3">
          <Eyebrow tone="rust">{'// 404'}</Eyebrow>
          <h1 className="text-[32px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
            Page not found.
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-ink-quiet">
            The page you&apos;re looking for doesn&apos;t exist or has moved.
            Double-check the URL, or head back to safer ground.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href="/dashboard">Back to dashboard →</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
