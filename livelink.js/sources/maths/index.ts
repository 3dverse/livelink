export * from './quaternion';

/**
 *
 */
export function copySign(a: number, b: number): number {
    return b < 0 ? -Math.abs(a) : Math.abs(a);
}
