/**
 *
 */
export class Rect {
    /**
     *
     */
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;

    /**
     *
     */
    constructor({
        left = 0,
        top = 0,
        right,
        bottom,
        width,
        height,
    }: {
        left?: number;
        top?: number;
        right?: number;
        bottom?: number;
        width?: number;
        height?: number;
    }) {
        if (!this.#isValid({ left, top, right, bottom, width, height })) {
            throw new Error("Invalid rect");
        }

        this.left = left;
        this.top = top;

        this.right = right !== undefined ? right : left + width!;
        this.bottom = bottom !== undefined ? bottom : top + height!;

        this.width = width !== undefined ? width : right! - left;
        this.height = height !== undefined ? height : bottom! - top;
    }

    /**
     *
     */
    #isValid({
        left = 0,
        top = 0,
        right,
        bottom,
        width,
        height,
    }: {
        left?: number;
        top?: number;
        right?: number;
        bottom?: number;
        width?: number;
        height?: number;
    }): boolean {
        // No negative values
        if (left < 0 || top < 0) return false;
        if (right !== undefined && right < 0) return false;
        if (bottom !== undefined && bottom < 0) return false;
        if (width !== undefined && width < 0) return false;
        if (height !== undefined && height < 0) return false;
        // Can't compute width
        if (right === undefined && width === undefined) return false;
        // Can't compute height
        if (bottom === undefined && height === undefined) return false;
        // Invalid values provided
        if (right !== undefined && left >= right) return false;
        if (bottom !== undefined && top >= bottom) return false;
        if (width !== undefined && right !== undefined && left + width !== right) return false;
        if (height !== undefined && bottom !== undefined && top + height !== bottom) return false;

        return true;
    }
}

/**
 *
 */
export class RelativeRect extends Rect {
    /**
     *
     */
    constructor({
        left = 0,
        top = 0,
        right,
        bottom,
        width = 1,
        height = 1,
    }: {
        left?: number;
        top?: number;
        right?: number;
        bottom?: number;
        width?: number;
        height?: number;
    }) {
        super({ left, top, right, bottom, width, height });

        if (!this.#areValuesRelative()) {
            throw new Error("Relative rect values must fall in [0,1] range");
        }
    }

    /**
     *
     */
    #areValuesRelative(): boolean {
        return (
            this.left < 1 && this.top < 1 && this.right <= 1 && this.bottom <= 1 && this.width <= 1 && this.height <= 1
        );
    }
}
