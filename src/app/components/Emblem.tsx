/**
 * The full Shellback emblem (assets/brand/emblem-*.png with the backdrop outside the circle made
 * transparent, scaled for the UI), one per theme. Inlined as data: URLs by tools/build.mjs.
 */
import emblemDark from '../assets/emblem-dark.png';
import emblemLight from '../assets/emblem-light.png';
import { cn } from './ui/primitives';

export function Emblem({ size, className, alt = 'Shellback' }: { size: number; className?: string; alt?: string }) {
  return (
    <>
      <img src={emblemLight} alt={alt} width={size} height={size} className={cn('only-light', className)} />
      <img src={emblemDark} alt={alt} width={size} height={size} className={cn('only-dark', className)} />
    </>
  );
}
