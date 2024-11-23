import { BaseTest } from './base-test';
import { Color, Tile } from '../types';

export class RandomScanTest extends BaseTest {
    private currentX: number = 0;
    private currentY: number = 0;

    getName(): string {
        return "random-scan";
    }

    getDescription(): string {
        return "Scans through all tiles, replacing each with random characters and colors";
    }

    private getRandomColor(): Color {
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}FF`;
    }

    private getRandomASCII(): string {
        return String.fromCharCode(33 + Math.floor(Math.random() * 94));
    }

    private updateNextTile() {
        if (!this.isRunning) return;

        const tile: Tile = {
            symbol: this.getRandomASCII(),
            fgColor: this.getRandomColor(),
            bgColor: this.getRandomColor(),
            zIndex: 1
        };

        this.display.setTile(this.currentX, this.currentY, tile);
        
        this.currentX++;
        if (this.currentX >= 50) {
            this.currentX = 0;
            this.currentY++;
            if (this.currentY >= 50) {
                this.currentY = 0;
            }
        }

        this.display.render();

        if (this.isRunning) {
            requestAnimationFrame(() => this.updateNextTile());
        }
    }

    protected run(): void {
        this.currentX = 0;
        this.currentY = 0;
        this.updateNextTile();
    }

    protected cleanup(): void {
        // Nothing specific to clean up
    }
} 