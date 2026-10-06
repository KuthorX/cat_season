/// <reference types="vite/client" />

interface Window {
  /** The inline boot loader (src/boot/bootLoader.ts); absent if the page was loaded without it. */
  CatBoot?: Pick<typeof import('./boot/bootLoader'), 'report' | 'finish'>;
}
