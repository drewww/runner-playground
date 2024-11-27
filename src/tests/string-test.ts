import { BaseTest } from './base-test';
import { TileId } from '../types';
import { LogLevel } from '../matrix-display';

interface ActiveString {
    tileIds: TileId[];
    text: string;
    zIndex: number;
}

export class StringTest extends BaseTest {
    private activeStrings: ActiveString[] = [];

    constructor(logLevel?: LogLevel) {
        super({
            worldWidth: 60,
            worldHeight: 25,
            viewportWidth: 60,
            viewportHeight: 25,
            cellSize: 24,
            logLevel
        });
    }

    getName(): string {
        return "string";
    }

    getDescription(): string {
        return "Renders colored text strings with movement";
    }

    protected run(): void {
        // Set dark gray background with dots
        this.display.setBackground('.', '#AAAAAAFF', '#222222FF');

        const strings = [
            { text: "{r}Hello{/}, {b}Matrix{/} {g}Display!{/}", zIndex: 5 },
            { text: "{g}Lorem ipsum{/} {y}dolor{/} {r}sit amet{/}", zIndex: 4 },
            { text: "{b}This is a {y}very{/} long string{/}", zIndex: 3 },
            { text: "{y}Short{/} {m}text{/}", zIndex: 2 },
            { text: "{#FF00FF}Custom{/} {r}colored{/} {b}string{/}", zIndex: 1 }
        ];

        // Add initial strings
        strings.forEach((str, index) => {
            const tileIds = this.display.createString(
                2, 
                index * 3 + 2, 
                str.text,
                str.zIndex
            );
            this.activeStrings.push({ tileIds, text: str.text, zIndex: str.zIndex });
        });

        const wrappedText = "{r}This is a very long string that will {g}automatically wrap{/} at word boundaries when it reaches the edge of its container{/}";
        const tileIds = this.display.createWrappedString(
            2,  // x
            2,  // y
            20, // width in cells
            5,  // height in cells
            wrappedText,
            5   // zIndex
        );
        this.activeStrings.push({ tileIds, text: wrappedText, zIndex: 5 });

        // Set up periodic movement
        this.moveStringsRandomly();
    }

    private moveStringsRandomly(): void {
        if (!this.isRunning) return;

        this.activeStrings.forEach(str => {
            // Get current position of first tile
            const firstTile = this.display.getTile(str.tileIds[0]);
            if (!firstTile) return;

            // Calculate string dimensions
            const stringLength = str.tileIds.length;
            
            // Calculate safe bounds for movement
            const maxX = this.display.getWorldWidth() - stringLength;
            const maxY = this.display.getWorldHeight() - 1;
            
            // Generate new position within safe bounds
            const newX = Math.max(0, Math.min(maxX, Math.floor(Math.random() * maxX)));
            const newY = Math.max(0, Math.min(maxY, Math.floor(Math.random() * maxY)));
            
            // Calculate movement delta
            const dx = newX - firstTile.x;
            const dy = newY - firstTile.y;
            
            // Only move if the new position is valid
            if (newX >= 0 && newX + stringLength <= this.display.getWorldWidth() && 
                newY >= 0 && newY < this.display.getWorldHeight()) {
                this.display.moveTiles(str.tileIds, dx, dy);
            }
        });

        // Schedule next movement
        setTimeout(() => this.moveStringsRandomly(), 2000);
    }

    protected cleanup(): void {
        this.activeStrings.forEach(str => {
            this.display.removeTiles(str.tileIds);
        });
        this.activeStrings = [];
    }
} 