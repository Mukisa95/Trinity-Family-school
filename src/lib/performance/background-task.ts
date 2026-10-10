/** A real task boundary lets pending input/paint run between processing batches. */
export function yieldToInterface(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}
